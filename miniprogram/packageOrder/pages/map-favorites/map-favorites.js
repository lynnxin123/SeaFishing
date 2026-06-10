var auth = require('../../../utils/auth');
var mapFavorites = require('../../../utils/mapFavorites');
var pageRefresh = require('../../../utils/pageRefresh');

function typeLabel(type) {
  if (type === 'shore') return '岸钓点';
  if (type === 'pier') return '船钓码头';
  if (type === 'deep') return '深海钓场';
  return '钓点';
}

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
      pageRefresh.resetRefresh('map-favorites');
      this.loadList();
      return;
    }
    if (!this.data.list.length || pageRefresh.shouldRefresh('map-favorites', 30000)) {
      this.loadList();
    }
  },

  onRetry() {
    pageRefresh.resetRefresh('map-favorites');
    this.loadList();
  },

  loadList() {
    var self = this;
    self.setData({ loading: true, loadError: '' });
    var api = require('../../../config/api');
    mapFavorites
      .fetchFavoriteSpots({ strict: api.USE_API })
      .then(function (list) {
        var rows = (list || []).map(function (spot) {
          var fishSpecies = Array.isArray(spot.fishSpecies) ? spot.fishSpecies : [];
          return Object.assign({}, spot, {
            typeLabel: typeLabel(spot.type),
            fishSpecies: fishSpecies
          });
        });
        pageRefresh.markRefreshed('map-favorites');
        self.setData({
          list: rows,
          isEmpty: rows.length === 0,
          loading: false,
          loadError: ''
        });
      })
      .catch(function (err) {
        self.setData({
          loading: false,
          loadError: (err && err.message) || '加载失败，请重试',
          isEmpty: false
        });
      });
  },

  onItemTap(e) {
    var id = e.currentTarget.dataset.id;
    if (!id) return;
    wx.setStorageSync('mapOpenSpotId', id);
    wx.switchTab({ url: '/pages/map/map' });
  },

  onGoMap() {
    wx.switchTab({ url: '/pages/map/map' });
  }
});
