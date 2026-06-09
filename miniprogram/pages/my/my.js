var auth = require('../../utils/auth');
var rewardService = require('../../utils/rewardService');

var MENU_LIST = [
  { id: 'booking', title: '海钓预约订单' },
  { id: 'boat-fav', title: '收藏的船只' },
  { id: 'map-fav', title: '收藏的钓点' },
  { id: 'event', title: '赛事报名订单' }
];

Page({
  data: {
    isLoggedIn: false,
    showUnverified: false,
    userInfo: auth.GUEST_PROFILE,
    menuList: MENU_LIST,
    showRewards: false,
    rewardLogs: []
  },

  onLoad() {
    this.syncFromStorage();
  },

  onShow() {
    var self = this;
    if (auth.isLoggedIn()) {
      auth.refreshProfileFromServer({ minIntervalMs: 60000 }).then(function (profile) {
        if (profile) {
          self.applyLoggedState(profile);
        } else {
          self.syncFromStorage();
        }
        if (self.data.showRewards) {
          self.loadRewardLogs();
        }
      });
      return;
    }
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
      showUnverified: loggedIn && !auth.isVerified(),
      userInfo: userInfo,
      menuList: MENU_LIST
    });

    auth.syncLoginState();
  },

  applyGuestState() {
    this.setData({
      isLoggedIn: false,
      showUnverified: false,
      userInfo: auth.GUEST_PROFILE,
      menuList: MENU_LIST
    });
    auth.syncLoginState();
  },

  applyLoggedState(profile) {
    var userInfo = profile || auth.getUserProfile() || auth.DEFAULT_PROFILE;
    this.setData({
      isLoggedIn: true,
      showUnverified: !auth.isVerified(),
      userInfo: userInfo,
      menuList: MENU_LIST
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
    wx.navigateTo({ url: '/packageUser/pages/messages/messages' });
  },

  onCheckIn() {
    var self = this;
    rewardService
      .checkIn()
      .then(function (profile) {
        if (profile) {
          self.applyLoggedState(profile);
        }
        wx.showToast({ title: '签到成功', icon: 'success' });
        if (self.data.showRewards) {
          self.loadRewardLogs();
        }
      })
      .catch(function (err) {
        wx.showToast({ title: (err && err.message) || '签到失败', icon: 'none' });
      });
  },

  onToggleRewards() {
    var show = !this.data.showRewards;
    this.setData({ showRewards: show });
    if (show) {
      this.loadRewardLogs();
    }
  },

  loadRewardLogs() {
    var self = this;
    rewardService.fetchRewardLogs().then(function (list) {
      self.setData({ rewardLogs: list || [] });
    });
  },

  onMenuTap(e) {
    if (!auth.isLoggedIn()) {
      wx.showToast({ title: '请先登录', icon: 'none' });
      return;
    }
    var id = e.currentTarget.dataset.id;
    if (id === 'booking') {
      wx.navigateTo({ url: '/packageOrder/pages/booking-orders/booking-orders' });
      return;
    }
    if (id === 'boat-fav') {
      wx.navigateTo({ url: '/packageOrder/pages/boat-favorites/boat-favorites' });
      return;
    }
    if (id === 'map-fav') {
      wx.navigateTo({ url: '/packageOrder/pages/map-favorites/map-favorites' });
      return;
    }
    if (id === 'event') {
      wx.navigateTo({ url: '/packageOrder/pages/event-orders/event-orders' });
      return;
    }
    wx.showToast({ title: '功能开发中', icon: 'none' });
  }
});
