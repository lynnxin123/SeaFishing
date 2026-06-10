var STORAGE_KEY = 'message_read_ids';

var DEFAULT_MESSAGES = [
  {
    id: 'welcome',
    type: 'system',
    title: '欢迎使用海发海钓',
    summary: '平台主推船只、赛事报名、海钓地图已开放，祝您渔获满满。',
    content:
      '欢迎使用海发海钓小程序。您可在首页预约主推船只，在赛事 Tab 报名海钓比赛，在海钓地图查看钓点与关联钓船。如有问题请联系客服。',
    time: '系统通知',
    read: false,
    refId: ''
  }
];

function getReadIds() {
  try {
    var raw = wx.getStorageSync(STORAGE_KEY);
    return Array.isArray(raw) ? raw : [];
  } catch (e) {
    return [];
  }
}

function saveReadIds(ids) {
  wx.setStorageSync(STORAGE_KEY, ids);
}

function withLocalReadState(list) {
  var readIds = getReadIds();
  return (list || []).map(function (item) {
    if (item.read) return item;
    return Object.assign({}, item, {
      read: readIds.indexOf(item.id) >= 0
    });
  });
}

function fetchMessages() {
  var api = require('../config/api');
  var token = wx.getStorageSync('token');
  if (!token) {
    return Promise.resolve([]);
  }
  if (!api.USE_API) {
    return Promise.resolve(withLocalReadState(DEFAULT_MESSAGES));
  }

  var request = require('./request');
  return request
    .get('/messages', { page: 1, pageSize: 50 })
    .then(function (res) {
      var items = (res && res.items) || (Array.isArray(res) ? res : []);
      if (!items.length) {
        return withLocalReadState(DEFAULT_MESSAGES);
      }
      return items;
    })
    .catch(function () {
      return withLocalReadState(DEFAULT_MESSAGES);
    });
}

function countUnreadInList(list) {
  var n = 0;
  (list || []).forEach(function (item) {
    if (!item.read) n++;
  });
  return n;
}

function fetchUnreadCount(options) {
  options = options || {};
  var api = require('../config/api');
  var token = wx.getStorageSync('token');
  if (!token) {
    return Promise.resolve(0);
  }
  if (!api.USE_API) {
    return fetchMessages().then(countUnreadInList);
  }

  var request = require('./request');
  var cacheTtl = options.force ? 0 : 20000;
  return request
    .get('/messages', { page: 1, pageSize: 50 }, { cacheTtlMs: cacheTtl })
    .then(function (res) {
      var items = (res && res.items) || (Array.isArray(res) ? res : []);
      if (!items.length) {
        return countUnreadInList(withLocalReadState(DEFAULT_MESSAGES));
      }
      return request
        .get('/messages/unread-count', null, { cacheTtlMs: cacheTtl })
        .then(function (r) {
          return (r && r.count) || 0;
        });
    })
    .catch(function () {
      return countUnreadInList(withLocalReadState(DEFAULT_MESSAGES));
    });
}

var TAB_MY_INDEX = 4;

function syncTabBarBadge(count) {
  try {
    if (!count || count <= 0) {
      wx.removeTabBarBadge({ index: TAB_MY_INDEX });
      return;
    }
    var text = count > 99 ? '99+' : count > 9 ? '9+' : String(count);
    wx.setTabBarBadge({ index: TAB_MY_INDEX, text: text });
  } catch (e) {}
}

function refreshTabBarBadge() {
  var token = wx.getStorageSync('token');
  if (!token) {
    syncTabBarBadge(0);
    return Promise.resolve(0);
  }
  return fetchUnreadCount().then(function (count) {
    syncTabBarBadge(count);
    return count;
  });
}

function markRead(id) {
  if (!id) return;

  try {
    var req = require('./request');
    req.invalidateGetCache('/messages/unread-count');
    req.invalidateGetCache('/messages');
  } catch (e) {}

  var api = require('../config/api');
  var token = wx.getStorageSync('token');
  if (api.USE_API && token && String(id).indexOf('welcome') !== 0) {
    var request = require('./request');
    request.patch('/messages/' + encodeURIComponent(id) + '/read').catch(function () {});
  }

  var ids = getReadIds();
  if (ids.indexOf(id) < 0) {
    ids.push(id);
    saveReadIds(ids);
  }
}

module.exports = {
  fetchMessages: fetchMessages,
  fetchUnreadCount: fetchUnreadCount,
  markRead: markRead,
  syncTabBarBadge: syncTabBarBadge,
  refreshTabBarBadge: refreshTabBarBadge
};
