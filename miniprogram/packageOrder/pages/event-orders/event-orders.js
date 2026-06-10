var auth = require('../../../utils/auth');
var eventService = require('../../../utils/eventService');
var pageRefresh = require('../../../utils/pageRefresh');

function formatTime(ts) {
  if (!ts) return '';
  var d = new Date(ts);
  var y = d.getFullYear();
  var m = String(d.getMonth() + 1).padStart(2, '0');
  var day = String(d.getDate()).padStart(2, '0');
  var h = String(d.getHours()).padStart(2, '0');
  var min = String(d.getMinutes()).padStart(2, '0');
  return y + '-' + m + '-' + day + ' ' + h + ':' + min;
}

Page({
  data: {
    list: [],
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
  },

  onShow() {
    if (!auth.isLoggedIn()) {
      wx.showToast({ title: '请先登录', icon: 'none' });
      setTimeout(function () {
        wx.navigateBack();
      }, 800);
      return;
    }
    if (this._forceRefresh) {
      this._forceRefresh = false;
      pageRefresh.resetRefresh('event-orders');
      this.loadList(true);
      return;
    }
    if (!this.data.list.length || pageRefresh.shouldRefresh('event-orders', 30000)) {
      this.loadList(true);
    }
  },

  onRetry() {
    pageRefresh.resetRefresh('event-orders');
    this.loadList(true);
  },

  loadList(reset) {
    var self = this;
    var page = reset ? 1 : this.data.page;
    if (reset) {
      this.setData({ loading: true, loadError: '', page: 1 });
    } else {
      this.setData({ loadingMore: true });
    }
    eventService
      .fetchMyRegistrations({ page: page, pageSize: this.data.pageSize })
      .then(function (res) {
        var items = (res && res.items) || (Array.isArray(res) ? res : []);
        var rows = items.map(function (item) {
          return Object.assign({}, item, {
            createdAtText: formatTime(item.createdAt)
          });
        });
        var list = reset ? rows : (self.data.list || []).concat(rows);
        pageRefresh.markRefreshed('event-orders');
        self.setData({
          list: list,
          isEmpty: list.length === 0,
          loading: false,
          loadingMore: false,
          loadError: '',
          hasMore: !!(res && res.hasMore),
          page: page
        });
      })
      .catch(function (err) {
        self.setData({
          list: reset ? [] : self.data.list,
          isEmpty: reset ? true : self.data.list.length === 0,
          loading: false,
          loadingMore: false,
          loadError: (err && err.message) || '加载失败，请重试'
        });
      });
  },

  onReachBottom() {
    if (!this.data.hasMore || this.data.loadingMore || this.data.loading) {
      return;
    }
    var self = this;
    this.setData({ page: this.data.page + 1 }, function () {
      self.loadList(false);
    });
  },

  onItemTap(e) {
    var id = e.currentTarget.dataset.id;
    if (!id) return;
    wx.navigateTo({
      url: eventService.EVENT_DETAIL_PATH + '?id=' + id
    });
  }
});
