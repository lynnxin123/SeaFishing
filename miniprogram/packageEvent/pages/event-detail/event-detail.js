var auth = require('../../../utils/auth');
var eventService = require('../../../utils/eventService');
var imagePreview = require('../../../utils/imagePreview');

Page({
  data: {
    pageState: 'loading',
    loadError: '',
    competition: null
  },

  onLoad(options) {
    var id = options.id || '';
    var self = this;
    this._eventId = id;
    if (!id) {
      this.setData({ pageState: 'error', loadError: '缺少赛事参数' });
      return;
    }
    this.loadCompetition(id);
  },

  loadCompetition(id) {
    var self = this;
    this.setData({ pageState: 'loading', loadError: '' });
    eventService
      .fetchCompetitionById(id, { strict: true })
      .then(function (competition) {
        if (!competition) {
          self.setData({ pageState: 'error', loadError: '赛事不存在' });
          return;
        }
        self.setData({
          competition: competition,
          pageState: 'ready',
          loadError: ''
        });
      })
      .catch(function (err) {
        self.setData({
          pageState: 'error',
          loadError: (err && err.message) || '加载失败，请重试'
        });
      });
  },

  onRetryLoad() {
    if (this._eventId) {
      this.loadCompetition(this._eventId);
    }
  },

  onPreviewImage() {
    var cover = this.data.competition && this.data.competition.cover;
    if (!cover) return;
    imagePreview.previewImages([cover], 0);
  },

  onGoTool(e) {
    var type = e.currentTarget.dataset.type;
    if (!type || !this._eventId) return;
    var route = eventService.buildFeatureRoute(type, this._eventId);
    if (!auth.isLoggedIn()) {
      auth.goLogin({ from: 'event-detail', redirect: route });
      return;
    }
    wx.navigateTo({ url: route });
  },

  onGoRegister() {
    var competition = this.data.competition;
    if (!competition) return;
    if (competition.status === 'ended') {
      wx.showToast({ title: '该赛事已结束，暂不可报名', icon: 'none' });
      return;
    }

    var registerUrl = eventService.EVENT_REGISTER_PATH + '?id=' + this._eventId;

    if (!auth.isLoggedIn()) {
      wx.showModal({
        title: '提示',
        content: '请先登录后再报名参赛',
        confirmText: '去登录',
        success: function (res) {
          if (res.confirm) {
            auth.goLogin({ redirect: registerUrl });
          }
        }
      });
      return;
    }

    if (!auth.isVerified()) {
      auth.promptVerify({ from: 'event-register', redirect: registerUrl });
      return;
    }

    wx.navigateTo({ url: registerUrl });
  }
});
