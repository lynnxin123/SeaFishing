var auth = require('../../utils/auth');
var eventService = require('../../utils/eventService');
var imagePreview = require('../../utils/imagePreview');

Page({
  data: {
    seriesTitle: eventService.LIST_SERIES_TITLE,
    competitionList: eventService.COMPETITION_LIST,
    toolCards: eventService.getToolCards('1'),
    highlightId: '',
    loading: false,
    loadError: ''
  },
  onLoad(options) {
    if (options.id) {
      this._highlightId = options.id;
    }
    this.loadCompetitions();
  },

  loadCompetitions() {
    var self = this;
    var api = require('../../config/api');
    if (!api.USE_API) {
      var staticList = eventService.COMPETITION_LIST;
      self.setData({
        competitionList: staticList,
        toolCards: eventService.getToolCards(eventService.pickActiveCompetitionId(staticList)),
        highlightId: String(self._highlightId || ''),
        loading: false,
        loadError: ''
      });
      return;
    }
    self.setData({ loading: true, loadError: '' });
    eventService
      .fetchCompetitionList({ strict: true })
      .then(function (list) {
        self.setData({
          competitionList: list,
          toolCards: eventService.getToolCards(eventService.pickActiveCompetitionId(list)),
          highlightId: String(self._highlightId || ''),
          loading: false,
          loadError: ''
        });
      })
      .catch(function () {
        self.setData({
          loading: false,
          loadError: '加载失败，请重试'
        });
      });
  },

  onShow() {
    var openId = wx.getStorageSync('eventListOpenId');
    if (openId) {
      wx.removeStorageSync('eventListOpenId');
      this._highlightId = String(openId);
      this.setData({ highlightId: String(openId) });
    }
  },

  onCoverError(e) {
    var index = Number(e.currentTarget.dataset.index);
    if (isNaN(index)) return;
    var list = this.data.competitionList || [];
    var item = list[index];
    if (!item) return;
    var cover = item.cover || '';
    var fallback = '';
    if (cover.indexOf('competition1.jpg') >= 0) {
      fallback = '/images/competition2.jpg';
    } else if (cover.indexOf('.webp') >= 0) {
      fallback = cover.replace('.webp', '.jpg');
    }
    if (!fallback || cover === fallback) return;
    var key = 'competitionList[' + index + '].cover';
    this.setData({ [key]: fallback });
  },

  /** 点击赛事大图 → 全屏预览 */
  onPreviewImage(e) {
    var index = Number(e.currentTarget.dataset.index);
    if (isNaN(index)) index = 0;
    var item = this.data.competitionList[index];
    if (!item || !item.cover) return;
    imagePreview.previewImages([item.cover], 0);
  },

  /** 赛事详情 */
  onGoDetail(e) {
    var id = e.currentTarget.dataset.id;
    if (!id) return;
    wx.navigateTo({
      url: eventService.EVENT_DETAIL_PATH + '?id=' + id
    });
  },

  onToolTap(e) {
    var route = e.currentTarget.dataset.route;
    var needLogin = e.currentTarget.dataset.needLogin !== false && e.currentTarget.dataset.needLogin !== 'false';
    if (!route) return;
    if (needLogin && !auth.isLoggedIn()) {
      auth.goLogin({ from: 'event-list' });
      return;
    }
    wx.navigateTo({ url: route });
  }
});
