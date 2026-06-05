var auth = require('../../utils/auth');

var MENU_GUEST = [
  { id: 'booking', title: '海钓预约订单' },
  { id: 'map-fav', title: '收藏的钓点' },
  { id: 'event', title: '赛事报名订单' },
  { id: 'weight', title: '称重记录' },
  { id: 'length', title: '长度测量记录' }
];

var MENU_LOGGED = [
  { id: 'booking', title: '海钓预约订单' },
  { id: 'map-fav', title: '收藏的钓点' },
  { id: 'event', title: '赛事报名订单' },
  { id: 'weight', title: '称重记录' }
];

Page({
  data: {
    isLoggedIn: false,
    showUnverified: false,
    userInfo: auth.GUEST_PROFILE,
    menuList: MENU_GUEST
  },

  onLoad() {
    this.syncFromStorage();
  },

  onShow() {
    this.syncFromStorage();
  },

  syncFromStorage() {
    var loggedIn = auth.isLoggedIn();
    var profile = null;

    if (loggedIn) {
      profile = auth.getUserProfile();
      if (!profile) {
        profile = auth.saveUserSession(null, wx.getStorageSync('phoneCode') || '');
      }
    }

    var userInfo = loggedIn ? profile || auth.DEFAULT_PROFILE : auth.GUEST_PROFILE;

    this.setData({
      isLoggedIn: loggedIn,
      showUnverified: loggedIn && !userInfo.verified,
      userInfo: userInfo,
      menuList: loggedIn ? MENU_LOGGED : MENU_GUEST
    });

    auth.syncLoginState();
  },

  applyGuestState() {
    this.setData({
      isLoggedIn: false,
      showUnverified: false,
      userInfo: auth.GUEST_PROFILE,
      menuList: MENU_GUEST
    });
    auth.syncLoginState();
  },

  applyLoggedState(profile) {
    var userInfo = profile || auth.getUserProfile() || auth.DEFAULT_PROFILE;
    this.setData({
      isLoggedIn: true,
      showUnverified: !userInfo.verified,
      userInfo: userInfo,
      menuList: MENU_LOGGED
    });
    auth.syncLoginState();
  },

  onGoLogin() {
    auth.goLogin({ from: 'my' });
  },

  onGoVerify() {
    if (!auth.isLoggedIn()) {
      auth.goLogin({ from: 'my' });
      return;
    }
    auth.goVerify({ from: 'my' });
  },

  onLogout() {
    var self = this;
    wx.showModal({
      title: '提示',
      content: '确定退出登录吗？',
      confirmText: '退出',
      cancelText: '取消',
      success: function (res) {
        if (!res.confirm) {
          return;
        }
        auth.clearSession();
        self.applyGuestState();
        wx.showToast({ title: '已退出登录', icon: 'none' });
      }
    });
  },

  onBellTap() {
    wx.showToast({ title: '消息功能开发中', icon: 'none' });
  },

  onMenuTap(e) {
    if (!auth.isLoggedIn()) {
      wx.showToast({ title: '请先登录', icon: 'none' });
      return;
    }
    var id = e.currentTarget.dataset.id;
    if (id === 'booking') {
      wx.navigateTo({ url: '/pages/booking-orders/booking-orders' });
      return;
    }
    if (id === 'map-fav') {
      wx.setStorageSync('mapOpenMode', 'favorites');
      wx.switchTab({ url: '/pages/map/map' });
      return;
    }
    wx.showToast({ title: '功能开发中', icon: 'none' });
  }
});
