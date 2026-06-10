var bookingOrders = require('../../../utils/bookingOrders');
var pageRefresh = require('../../../utils/pageRefresh');

Page({
  data: {
    loading: true,
    loadError: '',
    order: null,
    scrollHeight: 0,
    rules: {
      cancelTiers: [],
      maxBookingsIn7Days: 2
    }
  },

  initScrollHeight() {
    try {
      var sys = wx.getSystemInfoSync();
      var safeBottom =
        sys.safeArea && sys.safeArea.bottom
          ? sys.screenHeight - sys.safeArea.bottom
          : 0;
      var navPx = (sys.statusBarHeight || 20) + 44;
      var footPx = 72 + safeBottom;
      var height = sys.windowHeight - navPx - footPx;
      if (height < 240) {
        height = Math.floor(sys.windowHeight * 0.72);
      }
      this.setData({ scrollHeight: height });
    } catch (e) {
      this.setData({ scrollHeight: 520 });
    }
  },

  onReady() {
    this.initScrollHeight();
  },

  onLoad(options) {
    this.initScrollHeight();
    this._orderId = options.id || '';
    if (!this._orderId) {
      this.setData({ loading: false, loadError: '缺少订单参数' });
      return;
    }
    this.loadDetail();
    bookingOrders.fetchBookingRules().then(
      function (rules) {
        if (rules) {
          this.setData({ rules: rules });
        }
      }.bind(this)
    );
  },

  loadDetail() {
    var self = this;
    this.setData({ loading: true, loadError: '' });
    bookingOrders
      .fetchBookingDetail(this._orderId)
      .then(function (order) {
        self.setData({ order: order, loading: false, loadError: '' });
      })
      .catch(function (err) {
        self.setData({
          loading: false,
          loadError: (err && err.message) || '加载失败'
        });
      });
  },

  onPayTap() {
    var order = this.data.order;
    if (!order || !order.id) return;
    var self = this;
    bookingOrders.showPaymentDevModal(order.id, {
      onSuccess: function () {
        pageRefresh.resetRefresh('booking-orders');
        self.loadDetail();
        bookingOrders.promptAfterPaySuccess();
      }
    });
  },

  onCancelTap() {
    var self = this;
    var order = this.data.order;
    if (!order || !order.canCancel || this._cancelSubmitting) return;

    bookingOrders.fetchCancelPreview(order.id).then(function (preview) {
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
        wx.showModal({
          title: '无法取消',
          content: content,
          showCancel: false
        });
        return;
      }

      wx.showModal({
        title: '确认取消预约',
        content: content,
        confirmText: '确认取消',
        cancelText: '再想想',
        success: function (res) {
          if (!res.confirm) return;
          if (self._cancelSubmitting) return;
          self._cancelSubmitting = true;
          wx.showLoading({ title: '处理中' });
          bookingOrders
            .cancelOrder(order.id, { reason: '用户主动取消' })
            .then(function () {
              wx.showToast({ title: '已取消', icon: 'success' });
              pageRefresh.resetRefresh('booking-orders');
              self.loadDetail();
            })
            .catch(function (err) {
              wx.showToast({
                title: (err && err.message) || '取消失败',
                icon: 'none'
              });
            })
            .finally(function () {
              self._cancelSubmitting = false;
              wx.hideLoading();
            });
        }
      });
    }).catch(function (err) {
      wx.showToast({
        title: (err && err.message) || '获取取消信息失败',
        icon: 'none'
      });
    });
  }
});
