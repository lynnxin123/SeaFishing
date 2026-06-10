var auth = require('../../../utils/auth');
var boatSocial = require('../../../utils/boatSocial');
var pageRefresh = require('../../../utils/pageRefresh');

Page({
  data: {
    list: [],
    isEmpty: true,
    loading: false,
    loadError: ''
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
      pageRefresh.resetRefresh('boat-favorites');
      this.loadList();
      return;
    }
    if (!this.data.list.length || pageRefresh.shouldRefresh('boat-favorites', 30000)) {
      this.loadList();
    }
  },

  onRetry() {
    pageRefresh.resetRefresh('boat-favorites');
    this.loadList();
  },

  loadList() {
    var self = this;
    this.setData({ loading: true, loadError: '' });
    boatSocial
      .fetchMyFavorites()
      .then(function (list) {
        var rows = (list || []).map(function (ship) {
          return {
            boatId: ship.boatId,
            shipName: ship.shipName,
            captain: ship.captain || ship.captainName || '',
            price: ship.price,
            wharf: ship.displayWharf || ship.wharf || '',
            coverImage: ship.coverImage || (ship.images && ship.images[0]) || '/images/boat1.jpg',
            scoreDisplay: Number(ship.score || 0).toFixed(1)
          };
        });
        pageRefresh.markRefreshed('boat-favorites');
        self.setData({
          list: rows,
          isEmpty: rows.length === 0,
          loading: false,
          loadError: ''
        });
      })
      .catch(function (err) {
        self.setData({
          list: [],
          isEmpty: true,
          loading: false,
          loadError: (err && err.message) || '加载失败，请重试'
        });
      });
  },

  onItemTap(e) {
    var index = Number(e.currentTarget.dataset.index);
    var item = this.data.list[index];
    if (!item || !item.boatId) return;
    wx.navigateTo({
      url: '/packageBoat/pages/ship-detail/ship-detail?boatId=' + encodeURIComponent(item.boatId)
    });
  },

  onGoBoat() {
    wx.switchTab({ url: '/pages/boat/boat' });
  }
});
