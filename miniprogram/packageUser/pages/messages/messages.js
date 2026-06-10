var auth = require('../../../utils/auth');
var messageService = require('../../../utils/messageService');
var pageRefresh = require('../../../utils/pageRefresh');

Page({
  data: {
    loading: false,
    loadError: '',
    messages: []
  },

  onLoad(options) {
    this._forceRefresh = !!(options && options.refresh === '1');
  },

  onShow() {
    if (!auth.isLoggedIn()) {
      auth.goLogin({ from: 'messages', redirect: '/packageUser/pages/messages/messages' });
      return;
    }
    if (this._forceRefresh) {
      this._forceRefresh = false;
      pageRefresh.resetRefresh('messages');
      this.loadMessages();
      return;
    }
    if (!this.data.messages.length || pageRefresh.shouldRefresh('messages', 30000)) {
      this.loadMessages();
    }
  },

  onRetry() {
    pageRefresh.resetRefresh('messages');
    this.loadMessages();
  },

  loadMessages() {
    var self = this;
    this.setData({ loading: true, loadError: '' });
    messageService
      .fetchMessages()
      .then(function (list) {
        pageRefresh.markRefreshed('messages');
        self.setData({
          messages: list || [],
          loading: false,
          loadError: ''
        });
      })
      .catch(function (err) {
        self.setData({
          loading: false,
          loadError: (err && err.message) || '加载失败，请重试'
        });
      });
  },

  onItemTap(e) {
    var self = this;
    var id = e.currentTarget.dataset.id;
    if (!id) return;
    var idx = -1;
    var list = this.data.messages || [];
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === id) {
        idx = i;
        break;
      }
    }
    if (idx >= 0) {
      this.setData({ ['messages[' + idx + '].read']: true });
    }
    messageService.markRead(id);
    messageService.refreshTabBarBadge().then(function (count) {
      var pages = getCurrentPages();
      for (var i = pages.length - 1; i >= 0; i--) {
        if (pages[i].route === 'pages/my/my') {
          pages[i].setData({ unreadMessageCount: count || 0 });
          break;
        }
      }
    });

    var type = e.currentTarget.dataset.type;
    var refId = e.currentTarget.dataset.refId;
    if ((type === 'booking_accepted' || type === 'payment_reminder') && refId) {
      var bookingOrders = require('../../../utils/bookingOrders');
      bookingOrders.fetchBookingDetail(refId).then(function (order) {
        if (!order || !order.id) {
          wx.showToast({ title: '关联订单已不存在', icon: 'none' });
          messageService.markRead(id);
          pageRefresh.resetRefresh('messages');
          self.loadMessages();
          return;
        }
        wx.navigateTo({
          url: '/packageOrder/pages/booking-detail/booking-detail?id=' + refId
        });
      }).catch(function () {
        wx.showToast({ title: '关联订单已不存在', icon: 'none' });
        pageRefresh.resetRefresh('messages');
        self.loadMessages();
      });
      return;
    }
    if (type === 'competition_start_reminder' && refId) {
      wx.navigateTo({
        url: '/packageEvent/pages/event-detail/event-detail?id=' + refId
      });
      return;
    }

    wx.showModal({
      title: e.currentTarget.dataset.title || '消息详情',
      content: e.currentTarget.dataset.content || '',
      showCancel: false
    });
  }
});
