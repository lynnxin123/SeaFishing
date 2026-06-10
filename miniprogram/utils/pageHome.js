var HOME_TAB = '/pages/index/index';
var EVENT_TAB = '/pages/event-list/event-list';
var BOAT_TAB = '/pages/boat/boat';

function goHome() {
  wx.switchTab({
    url: HOME_TAB,
    fail: function () {
      wx.reLaunch({ url: HOME_TAB });
    }
  });
}

function goEventList() {
  wx.switchTab({ url: EVENT_TAB });
}

function goBoatList() {
  wx.switchTab({ url: BOAT_TAB });
}

function promptReturnHome(options) {
  options = options || {};
  wx.showModal({
    title: options.title || '已完成',
    content: options.content || '可返回首页继续浏览其他功能',
    confirmText: options.confirmText || '留在此页',
    cancelText: options.cancelText || '返回首页',
    success: function (res) {
      if (!res.confirm) {
        goHome();
        return;
      }
      if (typeof options.onStay === 'function') {
        options.onStay();
      }
    }
  });
}

module.exports = {
  HOME_TAB: HOME_TAB,
  goHome: goHome,
  goEventList: goEventList,
  goBoatList: goBoatList,
  promptReturnHome: promptReturnHome
};
