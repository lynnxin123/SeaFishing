var request = require('./request');
var auth = require('./auth');

function canUseApi() {
  var api = require('../config/api');
  return api.USE_API;
}

function fetchReviews(boatId) {
  if (!canUseApi() || !boatId) {
    return Promise.resolve([]);
  }
  return request
    .get('/boats/' + encodeURIComponent(boatId) + '/reviews')
    .then(function (list) {
      return Array.isArray(list) ? list : [];
    })
    .catch(function () {
      return [];
    });
}

function checkFavorite(boatId) {
  if (!canUseApi() || !boatId || !auth.isLoggedIn()) {
    return Promise.resolve(false);
  }
  return request
    .get('/boats/' + encodeURIComponent(boatId) + '/favorite')
    .then(function (res) {
      return !!(res && res.favorited);
    })
    .catch(function () {
      return false;
    });
}

function toggleFavorite(boatId, favorited) {
  if (!canUseApi()) {
    return Promise.reject({ message: 'API 未启用' });
  }
  if (!auth.isLoggedIn()) {
    return Promise.reject({ code: 'NEED_LOGIN', message: '请先登录' });
  }
  if (typeof favorited === 'boolean') {
    if (favorited) {
      return request
        .delete('/boats/' + encodeURIComponent(boatId) + '/favorite')
        .then(function () {
          return false;
        });
    }
    return request.post('/boats/' + encodeURIComponent(boatId) + '/favorite').then(function () {
      return true;
    });
  }
  return checkFavorite(boatId).then(function (isFav) {
    return toggleFavorite(boatId, isFav);
  });
}

function fetchMyFavorites() {
  if (!canUseApi() || !auth.isLoggedIn()) {
    return Promise.resolve([]);
  }
  return request
    .get('/boats/favorites/me')
    .then(function (res) {
      if (Array.isArray(res)) return res;
      return (res && res.items) || [];
    })
    .catch(function (err) {
      return Promise.reject(
        err && err.message ? err : { message: '加载收藏船只失败，请重试' }
      );
    });
}

function submitReview(boatId, payload) {
  if (!canUseApi() || !boatId) {
    return Promise.reject({ message: 'API 未启用' });
  }
  if (!auth.isLoggedIn()) {
    return Promise.reject({ code: 'NEED_LOGIN', message: '请先登录' });
  }
  return request.post('/boats/' + encodeURIComponent(boatId) + '/reviews', payload);
}

module.exports = {
  fetchReviews: fetchReviews,
  checkFavorite: checkFavorite,
  toggleFavorite: toggleFavorite,
  fetchMyFavorites: fetchMyFavorites,
  submitReview: submitReview
};
