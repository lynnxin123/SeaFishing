var eventService = require('../../utils/eventService');

Page({
  data: {
    pageTitle: '赛事功能'
  },

  onLoad(options) {
    var type = options.type || '';
    var title = eventService.FEATURE_TITLES[type] || '赛事功能';
    this.setData({ pageTitle: title });
  }
});
