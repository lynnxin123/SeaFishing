var LOGIN_KEY = 'isLoggedIn';
var USER_KEY = 'userProfile';

var apiConfig = require('../config/api');
/** 开发环境可跳过实名；正式上线前在 config/api.js 设 SKIP_ID_VERIFY: false */
var SKIP_ID_VERIFY = apiConfig.SKIP_ID_VERIFY !== false;

var DEFAULT_PROFILE = {
  nickName: '微信用户',
  avatarUrl: '',
  phoneCode: '',
  verified: false,
  levelName: '青铜钓手',
  medals: 0,
  points: 0,
  fishFood: 5
};

var GUEST_PROFILE = {
  nickName: '',
  avatarUrl: '',
  verified: false,
  levelName: '',
  medals: 0,
  points: 0,
  fishFood: 0
};

function isLoggedIn() {
  if (apiConfig.USE_API) {
    return !!wx.getStorageSync('token');
  }
  var v = wx.getStorageSync(LOGIN_KEY);
  return v === true || v === 'true' || v === 1 || v === '1';
}

function getUserProfile() {
  var stored = wx.getStorageSync(USER_KEY);
  if (stored && typeof stored === 'object') {
    return stored;
  }
  return null;
}

function setLoggedIn(loggedIn) {
  if (loggedIn) {
    wx.setStorageSync(LOGIN_KEY, true);
  } else {
    wx.removeStorageSync(LOGIN_KEY);
  }
  var app = getApp();
  if (app && app.globalData) {
    app.globalData.isLoggedIn = !!loggedIn;
  }
}

function saveUserSession(userInfo, phoneCode) {
  var prev = getUserProfile() || {};
  var merged = {
    nickName: (userInfo && userInfo.nickName) || prev.nickName || DEFAULT_PROFILE.nickName,
    avatarUrl: (userInfo && userInfo.avatarUrl) || prev.avatarUrl || '',
    phoneCode: phoneCode || prev.phoneCode || '',
    verified: SKIP_ID_VERIFY ? true : prev.verified === true,
    levelName: prev.levelName || DEFAULT_PROFILE.levelName,
    medals: prev.medals != null ? prev.medals : DEFAULT_PROFILE.medals,
    points: prev.points != null ? prev.points : DEFAULT_PROFILE.points,
    fishFood: prev.fishFood != null ? prev.fishFood : DEFAULT_PROFILE.fishFood
  };
  wx.setStorageSync(USER_KEY, merged);
  if (phoneCode) {
    wx.setStorageSync('phoneCode', phoneCode);
  }
  setLoggedIn(true);
  return merged;
}

function clearSession() {
  wx.removeStorageSync(LOGIN_KEY);
  wx.removeStorageSync(USER_KEY);
  wx.removeStorageSync('phoneCode');
  wx.removeStorageSync('token');
  try {
    require('./request').clearTokenCache();
  } catch (e) {}
  try {
    require('./eventService').invalidateRegistrationCache();
  } catch (e) {}
  setLoggedIn(false);
}

function mergeServerProfile(localProfile, serverProfile) {
  if (!serverProfile) return localProfile;
  return Object.assign({}, localProfile, {
    nickName: serverProfile.nickName || localProfile.nickName,
    avatarUrl: serverProfile.avatarUrl != null ? serverProfile.avatarUrl : localProfile.avatarUrl,
    phone: serverProfile.phone || localProfile.phone || '',
    wechatId: serverProfile.wechatId || localProfile.wechatId || '',
    isTestAccount: serverProfile.isTestAccount === true,
    verified: SKIP_ID_VERIFY ? true : serverProfile.verified === true,
    realName: serverProfile.realName || localProfile.realName || '',
    levelName: serverProfile.levelName || localProfile.levelName,
    medals: serverProfile.medals != null ? serverProfile.medals : localProfile.medals,
    points: serverProfile.points != null ? serverProfile.points : localProfile.points,
    fishFood: serverProfile.fishFood != null ? serverProfile.fishFood : localProfile.fishFood
  });
}

function loginWithBackend(userInfo, phoneCode, options) {
  options = options || {};
  var api = require('../config/api');
  if (!api.USE_API) {
    return Promise.resolve(saveUserSession(userInfo, phoneCode));
  }

  var request = require('./request');
  return new Promise(function (resolve, reject) {
    wx.login({
      success: function (loginRes) {
        var code = options.testCode || loginRes.code || 'dev:local';
        request
          .post('/auth/wx-login', {
            code: code,
            nickName: userInfo && userInfo.nickName,
            avatarUrl: userInfo && userInfo.avatarUrl
          })
          .then(function (data) {
            if (data && data.token) {
              wx.setStorageSync('token', data.token);
              try {
                require('./request').clearTokenCache();
              } catch (e) {}
            }
            var profile = saveUserSession(userInfo || (data && data.user), phoneCode);
            if (data && data.user) {
              profile = mergeServerProfile(profile, data.user);
              wx.setStorageSync(USER_KEY, profile);
              syncLoginState();
            }
            var bookingOrders = require('./bookingOrders');
            bookingOrders.syncLocalOrdersToServer().then(function (count) {
              if (count > 0) {
                wx.showToast({
                  title: '已同步' + count + '条本地订单',
                  icon: 'none'
                });
              }
              resolve(profile);
            }).catch(function () {
              resolve(profile);
            });
          })
          .catch(function (err) {
            reject(err);
          });
      },
      fail: function (err) {
        reject(err);
      }
    });
  });
}

var _lastProfileRefreshAt = 0;

function refreshProfileFromServer(options) {
  options = options || {};
  var minIntervalMs = options.minIntervalMs != null ? options.minIntervalMs : 0;
  var force = options.force === true;
  var now = Date.now();
  if (!force && minIntervalMs > 0 && now - _lastProfileRefreshAt < minIntervalMs) {
    return Promise.resolve(getUserProfile());
  }

  var api = require('../config/api');
  var token = wx.getStorageSync('token');
  if (!api.USE_API || !token) {
    return Promise.resolve(getUserProfile());
  }

  var request = require('./request');
  return request
    .get('/users/me')
    .then(function (serverProfile) {
      var prev = getUserProfile() || {};
      var merged = mergeServerProfile(prev, serverProfile);
      wx.setStorageSync(USER_KEY, merged);
      setLoggedIn(true);
      syncLoginState();
      _lastProfileRefreshAt = Date.now();
      return merged;
    })
    .catch(function () {
      return getUserProfile();
    });
}

function saveVerificationRemote(info) {
  info = info || {};
  var local = saveVerification(info);
  var api = require('../config/api');
  var token = wx.getStorageSync('token');
  if (!api.USE_API || !token) {
    return Promise.resolve(local);
  }

  var request = require('./request');
  return request
    .patch('/users/me/verify', {
      realName: info.realName || '',
      idNumber: info.idNumber || '',
      idType: info.idType || '身份证'
    })
    .then(function (serverProfile) {
      var merged = mergeServerProfile(local, serverProfile);
      wx.setStorageSync(USER_KEY, merged);
      syncLoginState();
      return merged;
    })
    .catch(function (err) {
      if (!api.USE_API) {
        return local;
      }
      return Promise.reject(err || { message: '实名认证失败' });
    });
}

function syncLoginState() {
  var app = getApp();
  if (app && app.globalData) {
    app.globalData.isLoggedIn = isLoggedIn();
    app.globalData.userProfile = getUserProfile();
  }
}

var _handling401 = false;

function buildPageRedirect(page) {
  if (!page || !page.route) return '';
  var url = '/' + page.route;
  var options = page.options || {};
  var keys = Object.keys(options);
  if (!keys.length) return url;
  var qs = keys
    .map(function (key) {
      return key + '=' + encodeURIComponent(options[key]);
    })
    .join('&');
  return url + '?' + qs;
}

function handleUnauthorized() {
  if (_handling401) return;
  _handling401 = true;
  setLoggedIn(false);
  wx.removeStorageSync('token');
  try {
    require('./request').clearTokenCache();
  } catch (e) {}
  try {
    require('./messageService').syncTabBarBadge(0);
  } catch (e) {}
  var app = getApp();
  if (app && app.globalData) {
    app.globalData.isLoggedIn = false;
    app.globalData.userProfile = GUEST_PROFILE;
  }
  wx.showToast({ title: '登录已过期，请重新登录', icon: 'none', duration: 2000 });
  setTimeout(function () {
    _handling401 = false;
    var pages = getCurrentPages();
    var current = pages.length ? pages[pages.length - 1] : null;
    var route = current && current.route ? current.route : '';
    if (route.indexOf('packageUser/pages/login/login') >= 0) {
      return;
    }
    goLogin({ redirect: buildPageRedirect(current) });
  }, 600);
}

function goLogin(options) {
  options = options || {};
  var query = [];
  if (options.from) query.push('from=' + options.from);
  if (options.redirect) {
    query.push('redirect=' + encodeURIComponent(options.redirect));
  }
  var url = '/packageUser/pages/login/login';
  if (query.length) url += '?' + query.join('&');
  wx.navigateTo({ url: url });
}

function isVerified() {
  if (SKIP_ID_VERIFY) return isLoggedIn();
  var profile = getUserProfile();
  return !!(profile && profile.verified === true);
}

function saveVerification(info) {
  info = info || {};
  var prev = getUserProfile() || {};
  var merged = Object.assign({}, prev, {
    verified: true,
    idType: info.idType || '身份证',
    realName: info.realName || '',
    idNumber: info.idNumber || ''
  });
  wx.setStorageSync(USER_KEY, merged);
  syncLoginState();
  return merged;
}

function goVerify(options) {
  options = options || {};
  var query = [];
  if (options.from) query.push('from=' + options.from);
  if (options.redirect) {
    query.push('redirect=' + encodeURIComponent(options.redirect));
  }
  var url = '/packageUser/pages/verify/verify';
  if (query.length) url += '?' + query.join('&');
  wx.navigateTo({ url: url });
}

function promptVerify(options) {
  options = options || {};
  wx.showModal({
    title: '提示',
    content: options.content || '参赛报名需先完成实名认证',
    confirmText: '去认证',
    cancelText: '取消',
    success: function (res) {
      if (res.confirm) {
        goVerify({
          from: options.from || '',
          redirect: options.redirect || ''
        });
      }
    }
  });
}

function saveContactRemote(contact) {
  contact = contact || {};
  var api = require('../config/api');
  var token = wx.getStorageSync('token');
  var patch = {};
  if (contact.phone != null) patch.phone = contact.phone;
  if (contact.wechatId != null) patch.wechatId = contact.wechatId;

  var prev = getUserProfile() || {};
  var local = Object.assign({}, prev, patch);
  wx.setStorageSync(USER_KEY, local);
  syncLoginState();

  if (!api.USE_API || !token) {
    return Promise.resolve(local);
  }

  var request = require('./request');
  return request.patch('/users/me', patch).then(function (serverProfile) {
    var merged = mergeServerProfile(local, serverProfile);
    wx.setStorageSync(USER_KEY, merged);
    syncLoginState();
    return merged;
  });
}

module.exports = {
  LOGIN_KEY: LOGIN_KEY,
  USER_KEY: USER_KEY,
  DEFAULT_PROFILE: DEFAULT_PROFILE,
  GUEST_PROFILE: GUEST_PROFILE,
  isLoggedIn: isLoggedIn,
  isVerified: isVerified,
  getUserProfile: getUserProfile,
  setLoggedIn: setLoggedIn,
  saveUserSession: saveUserSession,
  saveVerification: saveVerification,
  saveVerificationRemote: saveVerificationRemote,
  saveContactRemote: saveContactRemote,
  loginWithBackend: loginWithBackend,
  refreshProfileFromServer: refreshProfileFromServer,
  clearSession: clearSession,
  syncLoginState: syncLoginState,
  goLogin: goLogin,
  goVerify: goVerify,
  promptVerify: promptVerify,
  handleUnauthorized: handleUnauthorized,
  buildPageRedirect: buildPageRedirect
};
