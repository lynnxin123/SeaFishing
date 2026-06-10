var STORAGE_KEY = 'mapFavoriteSpots';
var PENDING_FAVORITE_KEY = 'mapPendingFavoriteSpotId';
var _lastKeysSyncAt = 0;
var _favSetCache = null;
var _syncPromise = null;

function getFavoriteIds() {
  try {
    var list = wx.getStorageSync(STORAGE_KEY);
    return Array.isArray(list) ? list : [];
  } catch (e) {
    return [];
  }
}

function getFavoriteSet() {
  if (_favSetCache) {
    return _favSetCache;
  }
  _favSetCache = new Set(getFavoriteIds());
  return _favSetCache;
}

function invalidateFavoriteSet() {
  _favSetCache = null;
}

function saveFavoriteIds(list) {
  wx.setStorageSync(STORAGE_KEY, list);
  invalidateFavoriteSet();
}

function isFavorite(spotId) {
  return getFavoriteSet().has(spotId);
}

function canUseRemote() {
  var api = require('../config/api');
  return api.USE_API && !!wx.getStorageSync('token');
}

function requireRemote() {
  var api = require('../config/api');
  if (api.USE_API && !wx.getStorageSync('token')) {
    return Promise.reject({
      code: 'NEED_LOGIN',
      message: '请先登录后再收藏'
    });
  }
  return Promise.resolve();
}

function resolveLocalFavoriteSpots() {
  var fishingSpots = require('./fishingSpots');
  var favSet = getFavoriteSet();
  return fishingSpots.fetchSpots().then(function () {
    return fishingSpots.getSpots().filter(function (spot) {
      return favSet.has(spot.id);
    });
  });
}

function syncFromServer() {
  if (!canUseRemote()) {
    return Promise.resolve(getFavoriteIds());
  }
  if (_syncPromise) {
    return _syncPromise;
  }
  var request = require('./request');
  _syncPromise = request
    .get('/favorites/keys', null, { cacheTtlMs: 30000 })
    .then(function (list) {
      if (Array.isArray(list)) {
        saveFavoriteIds(list);
      }
      _lastKeysSyncAt = Date.now();
      return getFavoriteIds();
    })
    .catch(function () {
      return getFavoriteIds();
    })
    .finally(function () {
      _syncPromise = null;
    });
  return _syncPromise;
}

function syncFromServerIfStale(maxAgeMs) {
  maxAgeMs = maxAgeMs != null ? maxAgeMs : 30000;
  if (_lastKeysSyncAt && Date.now() - _lastKeysSyncAt < maxAgeMs) {
    return Promise.resolve(getFavoriteIds());
  }
  return syncFromServer();
}

function toggleFavorite(spotId) {
  if (!canUseRemote()) {
    var auth = require('./auth');
    if (!auth.isLoggedIn()) {
      return Promise.reject({
        code: 'NEED_LOGIN',
        message: '请先登录后再收藏'
      });
    }
    var list = getFavoriteIds();
    var idx = list.indexOf(spotId);
    var willFavorite = idx < 0;
    if (willFavorite) {
      list.unshift(spotId);
    } else {
      list.splice(idx, 1);
    }
    saveFavoriteIds(list);
    return Promise.resolve(willFavorite);
  }

  return requireRemote().then(function () {
    var list = getFavoriteIds();
    var idx = list.indexOf(spotId);
    var willFavorite = idx < 0;
    var request = require('./request');
    var req = willFavorite
      ? request.post('/favorites/' + spotId)
      : request.delete('/favorites/' + spotId);

    return req.then(function () {
      if (willFavorite) {
        list.unshift(spotId);
      } else {
        list.splice(idx, 1);
      }
      saveFavoriteIds(list);
      _lastKeysSyncAt = Date.now();
      request.invalidateGetCache('/favorites/keys');
      return willFavorite;
    });
  });
}

function fetchFavoriteSpots(options) {
  options = options || {};
  if (canUseRemote()) {
    var request = require('./request');
    return request
      .get('/favorites')
      .then(function (res) {
        var list = Array.isArray(res) ? res : (res && res.items) || [];
        if (!list.length) {
          return [];
        }
        var keys = list.map(function (item) {
          return typeof item === 'string' ? item : item.id;
        });
        saveFavoriteIds(keys);
        _lastKeysSyncAt = Date.now();
        return list;
      })
      .catch(function () {
        if (options.strict) {
          return Promise.reject(new Error('加载失败，请重试'));
        }
        return resolveLocalFavoriteSpots();
      });
  }
  return resolveLocalFavoriteSpots();
}

function setPendingFavorite(spotId) {
  if (spotId) {
    wx.setStorageSync(PENDING_FAVORITE_KEY, spotId);
  } else {
    wx.removeStorageSync(PENDING_FAVORITE_KEY);
  }
}

function consumePendingFavorite() {
  try {
    var id = wx.getStorageSync(PENDING_FAVORITE_KEY);
    wx.removeStorageSync(PENDING_FAVORITE_KEY);
    return id || '';
  } catch (e) {
    return '';
  }
}

module.exports = {
  STORAGE_KEY: STORAGE_KEY,
  PENDING_FAVORITE_KEY: PENDING_FAVORITE_KEY,
  getFavoriteIds: getFavoriteIds,
  getFavoriteSet: getFavoriteSet,
  invalidateFavoriteSet: invalidateFavoriteSet,
  isFavorite: isFavorite,
  toggleFavorite: toggleFavorite,
  syncFromServer: syncFromServer,
  syncFromServerIfStale: syncFromServerIfStale,
  fetchFavoriteSpots: fetchFavoriteSpots,
  setPendingFavorite: setPendingFavorite,
  consumePendingFavorite: consumePendingFavorite
};
