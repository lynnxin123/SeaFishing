var auth = require('../../utils/auth');
var eventService = require('../../utils/eventService');

function isDevtools() {
  try {
    return wx.getSystemInfoSync().platform === 'devtools';
  } catch (e) {
    return false;
  }
}

Page({
  data: {
    isLoggedIn: false,
    userInfo: auth.GUEST_PROFILE,
    adBanner: eventService.AD_BANNER,
    signupBanner: eventService.SIGNUP_BANNER,
    featureCards: eventService.FEATURE_CARDS,
    utilityCards: eventService.UTILITY_CARDS,
    showLoginModal: false,
    agreed: false,
    pendingPath: '',
    welcomeInitial: '钓'
  },

  onLoad() {
    this._pendingProfile = null;
    this._loggingIn = false;
    this.syncLoginState();
  },

  onShow() {
    this.syncLoginState();
  },

  syncLoginState() {
    var loggedIn = auth.isLoggedIn();
    var profile = loggedIn ? auth.getUserProfile() || auth.DEFAULT_PROFILE : auth.GUEST_PROFILE;
    var initial = '钓';
    if (profile && profile.nickName) {
      initial = profile.nickName.substr(0, 1);
    }
    this.setData({
      isLoggedIn: loggedIn,
      userInfo: profile,
      welcomeInitial: initial
    });
    auth.syncLoginState();
  },

  onGoEventList() {
    eventService.openEventListTab();
  },

  onCallAdPhone() {
    var phone = this.data.adBanner.phone;
    wx.makePhoneCall({
      phoneNumber: phone,
      fail: function () {
        wx.setClipboardData({
          data: phone,
          success: function () {
            wx.showToast({ title: '电话已复制', icon: 'none' });
          }
        });
      }
    });
  },

  onFeatureTap(e) {
    var dataset = e.currentTarget.dataset || {};
    var path = dataset.path || '';
    var needLogin = dataset.needLogin !== false && dataset.needLogin !== 'false';
    if (!path) return;
    if (needLogin && !auth.isLoggedIn()) {
      this.setData({ showLoginModal: true, pendingPath: path });
      return;
    }
    wx.navigateTo({ url: path });
  },

  onOpenLoginModal() {
    this.setData({ showLoginModal: true, pendingPath: '' });
  },

  onCloseLoginModal() {
    this.setData({ showLoginModal: false, pendingPath: '' });
  },

  onToggleAgree() {
    this.setData({ agreed: !this.data.agreed });
  },

  onOpenAgreement(e) {
    var type = e.currentTarget.dataset.type || 'user';
    wx.navigateTo({ url: '/pages/agreement/agreement?type=' + type });
  },

  onLoginTap() {
    if (!this.data.agreed) {
      wx.showToast({ title: '请先同意用户协议与隐私政策', icon: 'none' });
      return;
    }
    if (isDevtools()) {
      this.loginWithUserProfile('');
      return;
    }
    var self = this;
    wx.getUserProfile({
      desc: '用于展示头像与昵称',
      success: function (res) {
        self._pendingProfile = res.userInfo;
      }
    });
  },

  onGetPhoneNumber(e) {
    if (isDevtools()) return;
    if (!this.data.agreed) {
      wx.showToast({ title: '请先同意用户协议与隐私政策', icon: 'none' });
      return;
    }
    var detail = e.detail || {};
    if (detail.errMsg === 'getPhoneNumber:ok') {
      this.loginWithUserProfile(detail.code || '');
    }
  },

  loginWithUserProfile(phoneCode) {
    if (this._loggingIn) return;
    this._loggingIn = true;
    var self = this;

    function finish(profile) {
      auth.saveUserSession(profile, phoneCode || '');
      self._pendingProfile = null;
      self._loggingIn = false;
      self.setData({ showLoginModal: false });
      self.syncLoginState();
      wx.showToast({ title: '登录成功', icon: 'success' });
      var pending = self.data.pendingPath;
      if (pending) {
        self.setData({ pendingPath: '' });
        setTimeout(function () {
          wx.navigateTo({ url: pending });
        }, 400);
      }
    }

    if (self._pendingProfile) {
      finish(self._pendingProfile);
      return;
    }

    wx.getUserProfile({
      desc: '用于展示头像与昵称',
      success: function (res) {
        finish(res.userInfo);
      },
      fail: function () {
        finish({ nickName: auth.DEFAULT_PROFILE.nickName, avatarUrl: '' });
      }
    });
  },

  stopTap() {}
});
