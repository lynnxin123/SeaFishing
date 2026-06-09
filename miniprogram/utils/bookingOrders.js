var STORAGE_KEY = 'bookingOrders';
var CONTEXT_KEY = 'lastBookingSearch';
var PENDING_BOOK_KEY = 'pendingBookAfterVerify';
var PENDING_INDEX_RESERVE_KEY = 'pendingIndexReserve';

var STATUS_LABEL = {
  pending_pay: '待付款',
  pending_accept: '待接单',
  accepted: '已接单',
  departed: '已出港',
  completed: '已完成',
  cancelled: '已取消'
};

var ORDER_TABS = [
  { key: 'all', label: '全部' },
  { key: 'pending_pay', label: '待付款' },
  { key: 'pending_accept', label: '待接单' },
  { key: 'accepted', label: '已接单' },
  { key: 'departed', label: '已出港' },
  { key: 'completed', label: '已完成' },
  { key: 'cancelled', label: '已取消' }
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
  return Object.assign({}, order, {
    statusLabel: STATUS_LABEL[order.status] || order.status,
    canCancel: CANCELABLE_STATUSES.indexOf(order.status) >= 0
  });
}

function saveBookingContext(ctx) {
  if (!ctx || typeof ctx !== 'object') return;
  wx.setStorageSync(CONTEXT_KEY, {
    date: ctx.date || '',
    wharf: ctx.wharf || '',
    people: ctx.people || '',
    keyword: ctx.keyword || ''
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
  var status = payload.status || 'pending_accept';
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
      status: payload.status || 'pending_accept'
    })
    .then(function (order) {
      return withStatusLabel(order);
    });
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
      status: item.status || 'pending_accept'
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

function cancelOrder(orderId) {
  var api = require('../config/api');
  var token = wx.getStorageSync('token');
  if (api.USE_API && token) {
    var request = require('./request');
    return request.patch('/bookings/' + orderId + '/cancel').then(withStatusLabel);
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

function goOrdersAfterSuccess() {
  wx.showToast({
    title: '预约成功',
    icon: 'success',
    duration: 1500,
    mask: true
  });
  setTimeout(function () {
    wx.navigateTo({ url: '/packageOrder/pages/booking-orders/booking-orders' });
  }, 1500);
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
  withStatusLabel: withStatusLabel,
  cancelOrder: cancelOrder,
  CANCELABLE_STATUSES: CANCELABLE_STATUSES
};
