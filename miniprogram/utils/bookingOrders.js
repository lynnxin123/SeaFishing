var STORAGE_KEY = 'bookingOrders';
var CONTEXT_KEY = 'lastBookingSearch';
var PENDING_BOOK_KEY = 'pendingBookAfterVerify';
var PENDING_INDEX_RESERVE_KEY = 'pendingIndexReserve';

var STATUS_LABEL = {
  pending_pay: '待付款',
  pending_accept: '待接单',
  accepted: '已接单',
  departed: '待出海',
  completed: '已完成',
  cancelled: '已取消',
  no_show: '爽约'
};

var ORDER_TABS = [
  { key: 'all', label: '全部' },
  { key: 'pending_pay', label: '待付款' },
  { key: 'pending_accept', label: '待接单' },
  { key: 'departed', label: '待出海' },
  { key: 'completed', label: '已完成' },
  { key: 'cancelled', label: '已取消' },
  { key: 'no_show', label: '爽约' }
];

var CANCELABLE_STATUSES = ['pending_pay', 'pending_accept', 'accepted'];

function genId() {
  return 'HD' + Date.now() + String(Math.floor(Math.random() * 1000)).padStart(3, '0');
}

function getOrders() {
  try {
    var list = wx.getStorageSync(STORAGE_KEY);
    return Array.isArray(list) ? list : [];
  } catch (e) {
    return [];
  }
}

function saveOrders(list) {
  wx.setStorageSync(STORAGE_KEY, list);
}

function withStatusLabel(order) {
  var canCancel =
    order.canCancel != null
      ? order.canCancel
      : CANCELABLE_STATUSES.indexOf(order.status) >= 0;
  return Object.assign({}, order, {
    statusLabel: order.statusLabel || STATUS_LABEL[order.status] || order.status,
    canCancel: canCancel
  });
}

function saveBookingContext(ctx) {
  if (!ctx || typeof ctx !== 'object') return;
  var prev = getBookingContext();
  wx.setStorageSync(CONTEXT_KEY, {
    date: ctx.date != null ? ctx.date : prev.date || '',
    wharf: ctx.wharf != null ? ctx.wharf : prev.wharf || '',
    people: ctx.people != null ? ctx.people : prev.people || '',
    keyword: ctx.keyword != null ? ctx.keyword : prev.keyword || '',
    fromIndexReserve:
      ctx.fromIndexReserve != null ? !!ctx.fromIndexReserve : !!prev.fromIndexReserve
  });
}

function getBookingContext() {
  try {
    return wx.getStorageSync(CONTEXT_KEY) || {};
  } catch (e) {
    return {};
  }
}

function hasApiToken() {
  var api = require('../config/api');
  if (!api.USE_API) return false;
  return !!wx.getStorageSync('token');
}

function addBookingOrder(payload) {
  var api = require('../config/api');
  var token = wx.getStorageSync('token');
  if (api.USE_API && !token) {
    return Promise.reject({ message: '请先登录后再预约', code: 'NEED_LOGIN' });
  }
  if (api.USE_API && token) {
    return createBookingRemote(payload);
  }

  var order = buildLocalOrder(payload);
  var list = getOrders();
  list.unshift(order);
  saveOrders(list);
  return Promise.resolve(order);
}

function buildLocalOrder(payload) {
  var status = payload.status || 'pending_pay';
  return {
    id: genId(),
    orderNo: genId(),
    shipName: payload.shipName || '海钓预约',
    boatId: payload.boatId || '',
    coverImage: payload.coverImage || '/images/boat1.jpg',
    price: payload.price != null ? String(payload.price) : '',
    wharf: payload.wharf || payload.departWharf || '',
    departWharf: payload.departWharf || payload.wharf || '',
    date: payload.date || '',
    people: payload.people != null ? String(payload.people) : '',
    captainName: payload.captainName || '',
    status: status,
    statusLabel: STATUS_LABEL[status],
    createdAt: Date.now()
  };
}

function createBookingRemote(payload) {
  var request = require('./request');
  return request
    .post('/bookings', {
      boatId: payload.boatId || '',
      shipName: payload.shipName || '海钓预约',
      coverImage: payload.coverImage || '/images/boat1.jpg',
      price: payload.price != null ? String(payload.price) : '',
      wharf: payload.wharf || payload.departWharf || '',
      departWharf: payload.departWharf || payload.wharf || '',
      date: payload.date || '',
      people: Number(payload.people) || 1,
      captainName: payload.captainName || '',
      status: payload.status || 'pending_pay',
      bookingType: payload.bookingType || 'shared',
      sailSlotId: payload.sailSlotId || '',
      slotTime: payload.slotTime || ''
    })
    .then(function (order) {
      invalidateSlotCache(payload.boatId, payload.date);
      return withStatusLabel(order);
    });
}

var _slotCache = {};
var SLOT_CACHE_TTL = 30000;

function invalidateSlotCache(boatId, date) {
  if (boatId && date) {
    delete _slotCache[boatId + ':' + date];
    return;
  }
  _slotCache = {};
}

function fetchSlotAvailability(boatId, date, options) {
  options = options || {};
  var api = require('../config/api');
  if (!api.USE_API || !boatId || !date) {
    return Promise.resolve({ slots: [], rulesSummary: null });
  }
  var cacheKey = boatId + ':' + date;
  var now = Date.now();
  if (!options.force && _slotCache[cacheKey] && now - _slotCache[cacheKey].ts < SLOT_CACHE_TTL) {
    return Promise.resolve(_slotCache[cacheKey].data);
  }
  var request = require('./request');
  return request
    .get('/bookings/slots/availability', {
      boatId: boatId,
      date: date
    })
    .then(function (res) {
      _slotCache[cacheKey] = { data: res, ts: Date.now() };
      return res;
    });
}

var _bookingRulesCache = null;
var _bookingRulesInflight = null;

function fetchBookingRules() {
  var api = require('../config/api');
  if (!api.USE_API) {
    return Promise.resolve(null);
  }
  if (_bookingRulesCache) {
    return Promise.resolve(_bookingRulesCache);
  }
  if (_bookingRulesInflight) {
    return _bookingRulesInflight;
  }
  var request = require('./request');
  _bookingRulesInflight = request.get('/bookings/rules').then(function (res) {
    _bookingRulesCache = res;
    _bookingRulesInflight = null;
    return res;
  }).catch(function (err) {
    _bookingRulesInflight = null;
    throw err;
  });
  return _bookingRulesInflight;
}

function fetchBookingDetail(orderId) {
  var api = require('../config/api');
  var token = wx.getStorageSync('token');
  if (!api.USE_API || !token) {
    return Promise.reject({ message: '请先登录' });
  }
  var request = require('./request');
  return request.get('/bookings/' + orderId).then(withStatusLabel);
}

function fetchCancelPreview(orderId) {
  var api = require('../config/api');
  var token = wx.getStorageSync('token');
  if (!api.USE_API || !token) {
    return Promise.reject({ message: '请先登录' });
  }
  var request = require('./request');
  return request.get('/bookings/' + orderId + '/cancel-preview');
}

function fetchOrders(tabKey, options) {
  options = options || {};
  var api = require('../config/api');
  var token = wx.getStorageSync('token');
  if (api.USE_API && !token) {
    return Promise.resolve([]);
  }
  if (api.USE_API && token) {
    var request = require('./request');
    var params = {
      page: options.page || 1,
      pageSize: options.pageSize || 50
    };
    if (tabKey && tabKey !== 'all') {
      params.status = tabKey;
    }
    return request.get('/bookings', params).then(function (res) {
      var list = Array.isArray(res) ? res : (res && res.items) || [];
      if (!Array.isArray(list)) {
        list = [];
      }
      var page = (res && res.page) || options.page || 1;
      var pageSize = (res && res.pageSize) || options.pageSize || 50;
      var total = res && res.total != null ? res.total : list.length;
      return {
        items: list.map(withStatusLabel),
        total: total,
        page: page,
        pageSize: pageSize,
        hasMore: page * pageSize < total
      };
    });
  }

  var local = filterByTab(tabKey);
  return Promise.resolve({
    items: local,
    total: local.length,
    page: 1,
    pageSize: local.length,
    hasMore: false
  });
}

function syncLocalOrdersToServer() {
  var api = require('../config/api');
  var token = wx.getStorageSync('token');
  if (!api.USE_API || !token) {
    return Promise.resolve(0);
  }

  var localList = getOrders();
  if (!localList.length) {
    return Promise.resolve(0);
  }

  var request = require('./request');
  var items = localList.map(function (item) {
    return {
      boatId: item.boatId,
      shipName: item.shipName,
      coverImage: item.coverImage,
      price: item.price,
      wharf: item.wharf,
      departWharf: item.departWharf,
      date: item.date,
      people: item.people,
      captainName: item.captainName,
      status: item.status || 'pending_pay'
    };
  });

  return request
    .post('/bookings/sync-batch', { items: items })
    .then(function (res) {
      saveOrders([]);
      return res && res.synced != null ? res.synced : localList.length;
    })
    .catch(function () {
      return 0;
    });
}

function filterByTab(tabKey) {
  var list = getOrders().map(withStatusLabel);
  if (!tabKey || tabKey === 'all') {
    return list;
  }
  return list.filter(function (o) {
    return o.status === tabKey;
  });
}

function setPendingBookAfterVerify(flag) {
  if (flag) {
    wx.setStorageSync(PENDING_BOOK_KEY, true);
  } else {
    wx.removeStorageSync(PENDING_BOOK_KEY);
  }
}

function consumePendingBookAfterVerify() {
  try {
    var v = wx.getStorageSync(PENDING_BOOK_KEY);
    wx.removeStorageSync(PENDING_BOOK_KEY);
    return v === true || v === 'true' || v === 1 || v === '1';
  } catch (e) {
    return false;
  }
}

function setPendingIndexReserve(boatId) {
  if (boatId != null && boatId !== '') {
    wx.setStorageSync(PENDING_INDEX_RESERVE_KEY, boatId);
  } else {
    wx.removeStorageSync(PENDING_INDEX_RESERVE_KEY);
  }
}

function clearReservePending() {
  setPendingIndexReserve(null);
  setPendingBookAfterVerify(false);
}

function consumePendingIndexReserve() {
  try {
    var v = wx.getStorageSync(PENDING_INDEX_RESERVE_KEY);
    wx.removeStorageSync(PENDING_INDEX_RESERVE_KEY);
    if (v === '' || v == null) {
      return null;
    }
    return Number(v);
  } catch (e) {
    return null;
  }
}

function cancelOrder(orderId, options) {
  options = options || {};
  var api = require('../config/api');
  var token = wx.getStorageSync('token');
  if (api.USE_API && token) {
    var request = require('./request');
    return request
      .patch('/bookings/' + orderId + '/cancel', {
        reason: options.reason || '',
        cancelType: options.cancelType || 'user'
      })
      .then(withStatusLabel);
  }

  var list = getOrders();
  var idx = list.findIndex(function (item) {
    return item.id === orderId || item.orderNo === orderId;
  });
  if (idx < 0) {
    return Promise.reject({ message: '订单不存在' });
  }
  if (CANCELABLE_STATUSES.indexOf(list[idx].status) < 0) {
    return Promise.reject({ message: '当前状态不可取消' });
  }
  list[idx].status = 'cancelled';
  list[idx].statusLabel = STATUS_LABEL.cancelled;
  saveOrders(list);
  return Promise.resolve(withStatusLabel(list[idx]));
}

function payOrder(orderId) {
  var api = require('../config/api');
  var token = wx.getStorageSync('token');
  if (!api.USE_API || !token) {
    return Promise.reject({ message: '请先登录' });
  }
  if (!orderId) {
    return Promise.reject({ message: '订单不存在' });
  }
  var request = require('./request');
  return request.patch('/bookings/' + orderId + '/pay').then(withStatusLabel);
}

function showPaymentDevModal(orderId, options) {
  options = options || {};
  if (!orderId) {
    wx.showToast({ title: '订单信息缺失', icon: 'none' });
    return;
  }
  wx.showModal({
    title: '确认付款',
    content:
      '应付金额将提交至系统。开发环境为模拟付款，正式上线后将接入微信支付。付款后船长方可接单。',
    confirmText: '确认付款',
    cancelText: '取消',
    success: function (res) {
      if (!res.confirm) return;
      wx.showLoading({ title: '支付中' });
      payOrder(orderId)
        .then(function (order) {
          wx.hideLoading();
          wx.showToast({ title: '付款成功', icon: 'success' });
          if (typeof options.onSuccess === 'function') {
            options.onSuccess(order);
          }
        })
        .catch(function (err) {
          wx.hideLoading();
          wx.showToast({
            title: (err && err.message) || '付款失败',
            icon: 'none'
          });
        });
    }
  });
}

function promptAfterPaySuccess() {
  var pageHome = require('./pageHome');
  pageHome.promptReturnHome({
    title: '付款成功',
    content: '船长确认接单后您将收到消息通知。可返回首页继续浏览。',
    confirmText: '查看订单',
    cancelText: '返回首页'
  });
}

function goOrdersAfterSuccess(orderId) {
  var pageHome = require('./pageHome');
  try {
    require('./pageRefresh').resetRefresh('booking-orders');
  } catch (e) {}

  function openSuccessModal() {
    try {
      wx.hideLoading();
      wx.hideToast();
    } catch (e) {}
    wx.showModal({
      title: '预约提交成功',
      content: '请尽快完成付款，付款后船长将确认接单。您可在订单列表中点击「去付款」。',
      confirmText: '查看订单',
      cancelText: '返回首页',
      success: function (res) {
        if (!res.confirm) {
          pageHome.goHome();
          return;
        }
        var url =
          '/packageOrder/pages/booking-orders/booking-orders?refresh=1&tab=pending_pay';
        try {
          wx.hideLoading();
          wx.hideToast();
        } catch (e) {}
        wx.navigateTo({
          url: url,
          fail: function () {
            wx.redirectTo({ url: url });
          }
        });
      }
    });
  }

  wx.showToast({
    title: '预约成功',
    icon: 'success',
    duration: 1200,
    complete: openSuccessModal
  });
}

module.exports = {
  STORAGE_KEY: STORAGE_KEY,
  PENDING_BOOK_KEY: PENDING_BOOK_KEY,
  ORDER_TABS: ORDER_TABS,
  STATUS_LABEL: STATUS_LABEL,
  getOrders: getOrders,
  saveOrders: saveOrders,
  addBookingOrder: addBookingOrder,
  fetchOrders: fetchOrders,
  syncLocalOrdersToServer: syncLocalOrdersToServer,
  hasApiToken: hasApiToken,
  goOrdersAfterSuccess: goOrdersAfterSuccess,
  filterByTab: filterByTab,
  saveBookingContext: saveBookingContext,
  getBookingContext: getBookingContext,
  setPendingBookAfterVerify: setPendingBookAfterVerify,
  consumePendingBookAfterVerify: consumePendingBookAfterVerify,
  setPendingIndexReserve: setPendingIndexReserve,
  consumePendingIndexReserve: consumePendingIndexReserve,
  clearReservePending: clearReservePending,
  withStatusLabel: withStatusLabel,
  cancelOrder: cancelOrder,
  fetchSlotAvailability: fetchSlotAvailability,
  fetchBookingRules: fetchBookingRules,
  fetchBookingDetail: fetchBookingDetail,
  fetchCancelPreview: fetchCancelPreview,
  payOrder: payOrder,
  showPaymentDevModal: showPaymentDevModal,
  promptAfterPaySuccess: promptAfterPaySuccess,
  CANCELABLE_STATUSES: CANCELABLE_STATUSES
};
