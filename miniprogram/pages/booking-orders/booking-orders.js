var bookingOrders = require('../../utils/bookingOrders');

Page({
  data: {
    tabs: bookingOrders.ORDER_TABS,
    activeTab: 0,
    orders: [],
    isEmpty: true
  },

  onShow() {
    this.loadOrders();
  },

  loadOrders() {
    var tab = this.data.tabs[this.data.activeTab];
    var key = tab ? tab.key : 'all';
    var list = bookingOrders.filterByTab(key);
    this.setData({
      orders: list,
      isEmpty: list.length === 0
    });
  },

  onTabTap(e) {
    var index = Number(e.currentTarget.dataset.index);
    if (Number.isNaN(index) || index === this.data.activeTab) {
      return;
    }
    this.setData({ activeTab: index }, function () {
      this.loadOrders();
    }.bind(this));
  }
});
