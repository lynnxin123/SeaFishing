var bookingOrders = require('../../../utils/bookingOrders');
var pageRefresh = require('../../../utils/pageRefresh');

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

  onShow() {
    const auth = require('../../../utils/auth');
    if (!auth.isLoggedIn()) {
      this.setData({ orders: [], isEmpty: true, loadError: '' });
      wx.showToast({ title: '请先登录查看订单', icon: 'none' });
      return;
    }
    if (!pageRefresh.shouldRefresh('booking-orders', 30000)) {
      return;
    }
    this.loadOrders(true);
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
    if (!order) return;
    var lines = [
      '订单号：' + (order.orderNo || order.id),
      '船舶：' + (order.shipName || ''),
      '出行日期：' + (order.date || '待定'),
      '码头：' + (order.wharf || order.departWharf || '待定'),
      '人数：' + (order.people || '') + '人',
      '船长：' + (order.captainName || '待定'),
      '状态：' + (order.statusLabel || ''),
      order.price ? '费用：¥' + order.price : ''
    ].filter(Boolean);
    wx.showModal({
      title: '订单详情',
      content: lines.join('\n'),
      showCancel: false,
      confirmText: '知道了'
    });
  },

  onCancelTap(e) {
    var id = e.currentTarget.dataset.id;
    if (!id) return;
    var self = this;
    wx.showModal({
      title: '取消预约',
      content: '确定要取消该预约订单吗？',
      confirmText: '确认取消',
      cancelText: '再想想',
      success: function (res) {
        if (!res.confirm) return;
        wx.showLoading({ title: '处理中' });
        bookingOrders
          .cancelOrder(id)
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
  },

  onPayTap() {
    wx.showModal({
      title: '待付款',
      content: '在线支付将在正式上线时开放，目前请联系客服完成确认。',
      showCancel: false,
      confirmText: '知道了'
    });
  }
});
