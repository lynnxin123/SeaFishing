var api = require('../config/api');

var _tokenCache = '';
var _inflightGets = {};
var DEFAULT_TIMEOUT = 15000;
var GET_RETRY_ONCE = true;

function buildGetKey(url, data) {
  var parts = [url];
  if (data && typeof data === 'object') {
    Object.keys(data)
      .sort()
      .forEach(function (key) {
        parts.push(key + '=' + String(data[key]));
      });
  }
  return parts.join('?');
}

function getToken() {
  if (_tokenCache) {
    return _tokenCache;
  }
  try {
    _tokenCache = wx.getStorageSync('token') || '';
    return _tokenCache;
  } catch (e) {
    return '';
  }
}

function clearTokenCache() {
  _tokenCache = '';
}

function normalizeError(res, err) {
  if (err) {
    var errMsg = err.errMsg || err.message || '';
    if (errMsg.indexOf('timeout') >= 0) {
      return { message: '请求超时，请检查网络后重试', code: 'TIMEOUT' };
    }
    if (errMsg.indexOf('request:fail') >= 0 || errMsg.indexOf('url not in domain') >= 0) {
      return {
        message: '无法连接后端，请确认 server 已启动，并在开发者工具勾选「不校验合法域名」',
        code: 'NETWORK'
      };
    }
    if (errMsg) {
      return { message: errMsg, code: 'NETWORK' };
    }
  }
  var data = res || {};
  var msg = data.message;
  if (Array.isArray(msg)) {
    msg = msg.join('；');
  }
  return {
    message: msg || '请求失败',
    statusCode: data.statusCode
  };
}

function requestOnce(options) {
  if (!api.USE_API) {
    return Promise.reject({ message: 'API 未启用', code: 'API_DISABLED' });
  }

  var url = options.url.indexOf('http') === 0 ? options.url : api.BASE_URL + options.url;
  var token = getToken();

  return new Promise(function (resolve, reject) {
    wx.request({
      url: url,
      method: options.method || 'GET',
      data: options.data || {},
      timeout: options.timeout != null ? options.timeout : DEFAULT_TIMEOUT,
      header: Object.assign(
        {
          'Content-Type': 'application/json',
          Authorization: token ? 'Bearer ' + token : ''
        },
        options.header || {}
      ),
      success: function (res) {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(res.data);
          return;
        }
        if (res.statusCode === 401) {
          wx.removeStorageSync('token');
          clearTokenCache();
        }
        reject(normalizeError(res.data, null));
      },
      fail: function (err) {
        reject(normalizeError(null, err));
      }
    });
  });
}

function request(options) {
  var method = (options.method || 'GET').toUpperCase();
  return requestOnce(options).catch(function (err) {
    if (!GET_RETRY_ONCE || method !== 'GET' || options._retried) {
      return Promise.reject(err);
    }
    if (err && (err.code === 'NETWORK' || err.code === 'TIMEOUT')) {
      return requestOnce(Object.assign({}, options, { _retried: true }));
    }
    return Promise.reject(err);
  });
}

function get(url, data) {
  var key = buildGetKey(url, data);
  if (_inflightGets[key]) {
    return _inflightGets[key];
  }
  _inflightGets[key] = request({ url: url, method: 'GET', data: data }).finally(function () {
    delete _inflightGets[key];
  });
  return _inflightGets[key];
}

function post(url, data) {
  return request({ url: url, method: 'POST', data: data });
}

function patch(url, data) {
  return request({ url: url, method: 'PATCH', data: data });
}

module.exports = {
  get: get,
  post: post,
  patch: patch,
  delete: function (url, data) {
    return request({ url: url, method: 'DELETE', data: data });
  },
  request: request,
  getToken: getToken,
  clearTokenCache: clearTokenCache
};
