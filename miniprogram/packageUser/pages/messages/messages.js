var messageService = require('../../../utils/messageService');
var pageRefresh = require('../../../utils/pageRefresh');

Page({
  data: {
    loading: false,
    loadError: '',
    messages: []
  },

  onShow() {
    if (!pageRefresh.shouldRefresh('messages', 30000)) {
      return;
    }
    this.loadMessages();
  },

  loadMessages() {
    var self = this;
    this.setData({ loading: true, loadError: '' });
    messageService
      .fetchMessages()
      .then(function (list) {
        pageRefresh.markRefreshed('messages');
        self.setData({
          messages: list || [],
          loading: false,
          loadError: ''
        });
      })
      .catch(function (err) {
        self.setData({
          loading: false,
          loadError: (err && err.message) || '加载失败，请重试'
        });
      });
  },

  onItemTap(e) {
    var id = e.currentTarget.dataset.id;
    if (!id) return;
    var idx = -1;
    var list = this.data.messages || [];
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === id) {
        idx = i;
        break;
      }
    }
    if (idx >= 0) {
      this.setData({ ['messages[' + idx + '].read']: true });
    }
    messageService.markRead(id);
    wx.showModal({
      title: e.currentTarget.dataset.title || '消息详情',
      content: e.currentTarget.dataset.content || '',
      showCancel: false
    });
  }
});
