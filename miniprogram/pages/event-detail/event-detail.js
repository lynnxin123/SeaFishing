var auth = require('../../utils/auth');
var eventService = require('../../utils/eventService');
var imagePreview = require('../../utils/imagePreview');

Page({
  data: {
    competition: null
  },

  onLoad(options) {
    var id = options.id || '';
    var competition = eventService.getCompetitionById(id);
    if (!competition) {
      wx.showToast({ title: '赛事不存在', icon: 'none' });
      setTimeout(function () {
        wx.navigateBack();
      }, 1200);
      return;
    }
    this.setData({ competition: competition });
    this._eventId = id;
  },

  onPreviewImage() {
    var cover = this.data.competition && this.data.competition.cover;
    if (!cover) return;
    imagePreview.previewImages([cover], 0);
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
