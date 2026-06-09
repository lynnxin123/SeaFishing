var request = require('./request');
var auth = require('./auth');

function ensureLogin() {
  if (!auth.isLoggedIn()) {
    return Promise.reject({ code: 'NEED_LOGIN', message: '请先登录' });
  }
  var api = require('../config/api');
  if (!api.USE_API) {
    return Promise.reject({ message: 'API 未启用' });
  }
  return Promise.resolve();
}

function fetchRanking(legacyId, options) {
  options = options || {};
  var api = require('../config/api');
  if (!api.USE_API) {
    return Promise.resolve([]);
  }
  return request
    .get('/competitions/' + legacyId + '/ranking')
    .then(function (list) {
      return Array.isArray(list) ? list : [];
    })
    .catch(function () {
      if (options.strict) {
        return Promise.reject(new Error('加载失败，请重试'));
      }
      return [];
    });
}

function fetchMyScore(legacyId) {
  return ensureLogin().then(function () {
    var params = {};
    if (legacyId) params.legacyId = String(legacyId);
    return request.get('/competitions/my/score', params);
  });
}

function submitMeasure(legacyId, payload) {
  return ensureLogin().then(function () {
    return request.post('/competitions/' + legacyId + '/measure', payload);
  });
}

function submitWeight(legacyId, payload) {
  return ensureLogin().then(function () {
    return request.post('/competitions/' + legacyId + '/weight', payload);
  });
}

function submitFeedback(payload) {
  return ensureLogin().then(function () {
    return request.post('/competitions/feedback', payload);
  });
}

module.exports = {
  fetchRanking: fetchRanking,
  fetchMyScore: fetchMyScore,
  submitMeasure: submitMeasure,
  submitWeight: submitWeight,
  submitFeedback: submitFeedback
};
