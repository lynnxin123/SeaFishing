var request = require('./request');
var auth = require('./auth');

function fetchRewardLogs() {
  if (!auth.isLoggedIn()) {
    return Promise.resolve([]);
  }
  var api = require('../config/api');
  if (!api.USE_API) {
    return Promise.resolve([]);
  }
  return request
    .get('/users/me/rewards')
    .then(function (list) {
      return Array.isArray(list) ? list : [];
    })
    .catch(function () {
      return [];
    });
}

function checkIn() {
  var api = require('../config/api');
  if (!api.USE_API) {
    return Promise.reject({ message: 'API 未启用' });
  }
  if (!auth.isLoggedIn()) {
    return Promise.reject({ code: 'NEED_LOGIN', message: '请先登录' });
  }
  return request.post('/users/me/check-in');
}

module.exports = {
  fetchRewardLogs: fetchRewardLogs,
  checkIn: checkIn
};
