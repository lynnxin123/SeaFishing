var STORAGE_KEY = 'bookingOrders';
var CONTEXT_KEY = 'lastBookingSearch';
var PENDING_BOOK_KEY = 'pendingBookAfterVerify';
var PENDING_INDEX_RESERVE_KEY = 'pendingIndexReserve';

var STATUS_LABEL = {
  pending_pay: '待付款',
  pending_accept: '待接单',
  accepted: '已接单',
  departed: '已出港',
  completed: '已完成'
};

var ORDER_TABS = [
  { key: 'all', label: '全部' },
  { key: 'pending_pay', label: '待付款' },
  { key: 'pending_accept', label: '待接单' },
  { key: 'accepted', label: '已接单' },
  { key: 'departed', label: '已出港' },
  { key: 'completed', label: '已完成' }
];

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
    statusLabel: STATUS_LABEL[order.status] || order.status
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

function addBookingOrder(payload) {
  var status = payload.status || 'pending_accept';
  var order = {
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
  var list = getOrders();
  list.unshift(order);
  saveOrders(list);
  return order;
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

function goOrdersAfterSuccess() {
  wx.showToast({
    title: '预约成功',
    icon: 'success',
    duration: 1500,
    mask: true
  });
  setTimeout(function () {
    wx.navigateTo({ url: '/pages/booking-orders/booking-orders' });
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
  goOrdersAfterSuccess: goOrdersAfterSuccess,
  filterByTab: filterByTab,
  saveBookingContext: saveBookingContext,
  getBookingContext: getBookingContext,
  setPendingBookAfterVerify: setPendingBookAfterVerify,
  consumePendingBookAfterVerify: consumePendingBookAfterVerify,
  setPendingIndexReserve: setPendingIndexReserve,
  consumePendingIndexReserve: consumePendingIndexReserve,
  withStatusLabel: withStatusLabel
};
