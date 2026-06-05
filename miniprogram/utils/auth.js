var LOGIN_KEY = 'isLoggedIn';
var USER_KEY = 'userProfile';

/** 测试阶段跳过身份证实名，正式上线前改为 false */
var SKIP_ID_VERIFY = true;

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
  setLoggedIn(false);
}

function syncLoginState() {
  var app = getApp();
  if (app && app.globalData) {
    app.globalData.isLoggedIn = isLoggedIn();
    app.globalData.userProfile = getUserProfile();
  }
}

function goLogin(options) {
  options = options || {};
  var query = [];
  if (options.from) query.push('from=' + options.from);
  if (options.redirect) {
    query.push('redirect=' + encodeURIComponent(options.redirect));
  }
  var url = '/pages/login/login';
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
  var url = '/pages/verify/verify';
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
  clearSession: clearSession,
  syncLoginState: syncLoginState,
  goLogin: goLogin,
  goVerify: goVerify,
  promptVerify: promptVerify
};
