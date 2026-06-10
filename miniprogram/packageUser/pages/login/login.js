var auth = require('../../../utils/auth');

function isDevtools() {
  try {
    return wx.getSystemInfoSync().platform === 'devtools';
  } catch (e) {
    return false;
  }
}

Page({
  data: {
    bgImage: '/images/login-bg.jpg',
    agreed: false,
    notAgreed: true,
    userAgreementLabel: '\u300a\u7528\u6237\u534f\u8bae\u300b',
    privacyPolicyLabel: '\u300a\u9690\u79c1\u653f\u7b56\u300b',
    showDevAccounts: false,
    devAccounts: []
  },

  onLoad(options) {
    this._from = options.from || '';
    this._redirect = options.redirect ? decodeURIComponent(options.redirect) : '';
    this._pendingProfile = null;
    this._loggingIn = false;
    this._testCode = '';
    var api = require('../../../config/api');
    this.setData({
      showDevAccounts:
        isDevtools() &&
        api.USE_API &&
        api.SHOW_DEV_ACCOUNTS === true &&
        api.TEST_ACCOUNTS &&
        api.TEST_ACCOUNTS.length > 0,
      devAccounts: api.TEST_ACCOUNTS || []
    });
  },

  onBack() {
    wx.navigateBack({
      fail: function () {
        wx.switchTab({ url: '/pages/index/index' });
      }
    });
  },

  onToggleAgree() {
    var agreed = !this.data.agreed;
    this.setData({
      agreed: agreed,
      notAgreed: !agreed
    });
  },

  onLoginTap() {
    if (!this.data.agreed) {
      wx.showToast({ title: '请先同意用户协议与隐私政策', icon: 'none' });
      return;
    }
    var self = this;
    if (isDevtools()) {
      this.loginWithUserProfile('');
      return;
    }
    wx.getUserProfile({
      desc: '用于展示头像与昵称',
      success: function (res) {
        self._pendingProfile = res.userInfo;
      }
    });
  },

  onGetPhoneNumber(e) {
    if (isDevtools()) {
      return;
    }
    if (!this.data.agreed) {
      wx.showToast({ title: '请先同意用户协议与隐私政策', icon: 'none' });
      return;
    }
    var detail = e.detail || {};
    if (detail.errMsg === 'getPhoneNumber:ok') {
      this.loginWithUserProfile(detail.code || '');
      return;
    }
    this.handlePhoneAuthFail(detail);
  },

  handlePhoneAuthFail(detail) {
    var errMsg = (detail && detail.errMsg) || '';
    var userDeny =
      errMsg.indexOf('deny') !== -1 ||
      errMsg.indexOf('cancel') !== -1 ||
      errMsg.indexOf('拒绝') !== -1;

    if (isDevtools()) {
      this.loginWithUserProfile('');
      return;
    }

    if (userDeny) {
      wx.showToast({ title: '已取消授权', icon: 'none' });
      return;
    }

    var self = this;
    wx.showModal({
      title: '手机号授权',
      content: '未能获取手机号，是否使用微信头像昵称继续登录？',
      confirmText: '继续登录',
      success: function (res) {
        if (res.confirm) {
          self.loginWithUserProfile('');
        }
      }
    });
  },

  onDevAccountLogin(e) {
    if (!this.data.agreed) {
      wx.showToast({ title: '请先同意用户协议与隐私政策', icon: 'none' });
      return;
    }
    var code = e.currentTarget.dataset.code;
    var nickName = e.currentTarget.dataset.name || '测试用户';
    if (!code) return;
    this._testCode = code;
    this.loginWithUserProfile('', {
      nickName: nickName,
      avatarUrl: ''
    });
  },

  loginWithUserProfile(phoneCode, presetProfile) {
    if (this._loggingIn) {
      return;
    }
    this._loggingIn = true;
    var self = this;
    var testCode = this._testCode || '';

    function finish(profile) {
      self._pendingProfile = null;
      self._loggingIn = false;
      self._testCode = '';
      wx.showToast({ title: '登录成功', icon: 'success' });
      setTimeout(function () {
        self.finishLogin();
      }, 800);
    }

    function fail(err) {
      self._loggingIn = false;
      self._testCode = '';
      var msg = (err && err.message) || '登录失败，请稍后重试';
      wx.showToast({ title: msg, icon: 'none', duration: 2500 });
    }

    function startLogin(profile) {
      auth
        .loginWithBackend(profile, phoneCode || '', { testCode: testCode })
        .then(finish)
        .catch(fail);
    }

    if (presetProfile) {
      startLogin(presetProfile);
      return;
    }

    if (self._pendingProfile) {
      startLogin(self._pendingProfile);
      return;
    }

    wx.getUserProfile({
      desc: '用于展示头像与昵称',
      success: function (res) {
        startLogin(res.userInfo);
      },
      fail: function () {
        startLogin({
          nickName: auth.DEFAULT_PROFILE.nickName,
          avatarUrl: ''
        });
      }
    });
  },

  onSkipLogin() {
    wx.navigateBack({
      fail: function () {
        wx.switchTab({ url: '/pages/index/index' });
      }
    });
  },

  onOpenAgreement(e) {
    var type = e.currentTarget.dataset.type || 'user';
    wx.navigateTo({
      url: '/packageUser/pages/agreement/agreement?type=' + type
    });
  },

  finishLogin() {
    auth.syncLoginState();

    if (this._redirect) {
      wx.redirectTo({
        url: this._redirect,
        fail: function () {
          wx.switchTab({ url: '/pages/index/index' });
        }
      });
      return;
    }

    if (this._from === 'map-fav') {
      wx.switchTab({ url: '/pages/map/map' });
      return;
    }

    wx.switchTab({
      url: '/pages/index/index'
    });
  }
});
