var eventService = require('../../utils/eventService');
var imagePreview = require('../../utils/imagePreview');

Page({
  data: {
    seriesTitle: eventService.LIST_SERIES_TITLE,
    competitionList: eventService.COMPETITION_LIST
  },

  onLoad(options) {
    if (options.id) {
      this._highlightId = options.id;
    }
  },

  onShow() {
    var openId = wx.getStorageSync('eventListOpenId');
    if (openId) {
      wx.removeStorageSync('eventListOpenId');
      this._highlightId = openId;
    }
  },

  /** 点击赛事大图 → 全屏预览 */
  onPreviewImage(e) {
    var index = Number(e.currentTarget.dataset.index);
    if (isNaN(index)) index = 0;
    var urls = this.data.competitionList.map(function (item) {
      return item.cover;
    });
    imagePreview.previewImages(urls, index);
  },

  /** 赛事详情 */
  onGoDetail(e) {
    var id = e.currentTarget.dataset.id;
    if (!id) return;
    wx.navigateTo({
      url: eventService.EVENT_DETAIL_PATH + '?id=' + id
    });
  }
});
