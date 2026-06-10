var bookingOrders = require('../../../utils/bookingOrders');
var pageRefresh = require('../../../utils/pageRefresh');
var pageHome = require('../../../utils/pageHome');

Page({
  data: {
    tabs: bookingOrders.ORDER_TABS,
    activeTab: 0,
    orders: [],
    isEmpty: true,
    loading: false,
    loadingMore: false,
    loadError: '',
    hasMore: false,
    page: 1,
    pageSize: 20
  },

  onLoad(options) {
    this._forceRefresh = !!(options && options.refresh === '1');
    if (options && options.tab) {
      var tabIndex = this.data.tabs.findIndex(function (item) {
        return item.key === options.tab;
      });
      if (tabIndex >= 0) {
        this._preserveTab = true;
        this.setData({ activeTab: tabIndex });
      }
    }
  },

  onShow() {
    const auth = require('../../../utils/auth');
    if (!auth.isLoggedIn()) {
      this.setData({ orders: [], isEmpty: true, loadError: '' });
      wx.showToast({ title: '请先登录查看订单', icon: 'none' });
      return;
    }
    var force = this._forceRefresh;
    if (force) {
      this._forceRefresh = false;
      pageRefresh.resetRefresh('booking-orders');
      if (!this._preserveTab && this.data.activeTab !== 0) {
        this.setData({ activeTab: 0, orders: [], hasMore: false, page: 1 });
      }
      this._preserveTab = false;
      this.loadOrders(true);
      return;
    }
    if (!this.data.orders.length || pageRefresh.shouldRefresh('booking-orders', 30000)) {
      this.loadOrders(true);
    }
  },

  loadOrders(reset) {
    var tab = this.data.tabs[this.data.activeTab];
    var key = tab ? tab.key : 'all';
    var page = reset ? 1 : this.data.page;
    if (reset) {
      this.setData({ loading: true, loadError: '', page: 1 });
    } else {
      this.setData({ loadingMore: true });
    }
    bookingOrders
      .fetchOrders(key, { page: page, pageSize: this.data.pageSize })
      .then(
        function (res) {
          var items = (res && res.items) || [];
          var orders = reset ? items : (this.data.orders || []).concat(items);
          pageRefresh.markRefreshed('booking-orders');
          this.setData({
            orders: orders,
            isEmpty: orders.length === 0,
            loading: false,
            loadingMore: false,
            loadError: '',
            hasMore: !!(res && res.hasMore),
            page: page
          });
        }.bind(this)
      )
      .catch(
        function (err) {
          this.setData({
            orders: reset ? [] : this.data.orders,
            isEmpty: reset ? true : this.data.orders.length === 0,
            loading: false,
            loadingMore: false,
            loadError: (err && err.message) || '加载失败，请重试'
          });
        }.bind(this)
      );
  },

  onReachBottom() {
    if (!this.data.hasMore || this.data.loadingMore || this.data.loading) {
      return;
    }
    var nextPage = this.data.page + 1;
    this.setData({ page: nextPage }, function () {
      this.loadOrders(false);
    }.bind(this));
  },

  onTabTap(e) {
    var index = Number(e.currentTarget.dataset.index);
    if (Number.isNaN(index) || index === this.data.activeTab) {
      return;
    }
    pageRefresh.resetRefresh('booking-orders');
    this.setData({ activeTab: index, orders: [], hasMore: false, page: 1 }, function () {
      this.loadOrders(true);
    }.bind(this));
  },

  onDetailTap(e) {
    var index = Number(e.currentTarget.dataset.index);
    var order = this.data.orders[index];
    if (!order || !order.id) return;
    wx.navigateTo({
      url: '/packageOrder/pages/booking-detail/booking-detail?id=' + order.id
    });
  },

  onCancelTap(e) {
    var id = e.currentTarget.dataset.id;
    if (!id) return;
    var self = this;
    bookingOrders.fetchCancelPreview(id).then(function (preview) {
      if (!preview) return;
      var content = preview.canCancel
        ? '取消后预计退款 ¥' +
          preview.refundAmount +
          '（' +
          preview.refundPercent +
          '%）\n' +
          (preview.tierLabel || '')
        : preview.reason || '当前不可取消';

      if (!preview.canCancel) {
        wx.showModal({ title: '无法取消', content: content, showCancel: false });
        return;
      }

      wx.showModal({
        title: '确认取消预约',
        content: content,
        confirmText: '确认取消',
        cancelText: '再想想',
        success: function (res) {
          if (!res.confirm) return;
          wx.showLoading({ title: '处理中' });
          bookingOrders
            .cancelOrder(id, { reason: '用户主动取消' })
            .then(function () {
              wx.hideLoading();
              wx.showToast({ title: '已取消', icon: 'success' });
              pageRefresh.resetRefresh('booking-orders');
              self.loadOrders(true);
            })
            .catch(function (err) {
              wx.hideLoading();
              wx.showToast({
                title: (err && err.message) || '取消失败',
                icon: 'none'
              });
            });
        }
      });
    }).catch(function (err) {
      wx.showToast({
        title: (err && err.message) || '获取取消信息失败',
        icon: 'none'
      });
    });
  },

  onRetryLoad() {
    this.loadOrders(true);
  },

  onPayTap(e) {
    var id = e.currentTarget.dataset.id;
    if (!id) return;
    var self = this;
    bookingOrders.showPaymentDevModal(id, {
      onSuccess: function () {
        pageRefresh.resetRefresh('booking-orders');
        self.loadOrders(true);
        bookingOrders.promptAfterPaySuccess();
      }
    });
  },

  onGoHome() {
    pageHome.goHome();
  },

  onGoMy() {
    wx.switchTab({
      url: '/pages/my/my',
      fail: function () {
        wx.reLaunch({ url: '/pages/my/my' });
      }
    });
  }
});
