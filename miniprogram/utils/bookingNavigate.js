/**
 * 复用约船页跳转船舶详情 / 预约流程
 */
var bookingOrders = require('./bookingOrders');

function goBookShip(ship, extraContext) {
  if (!ship) return;
  extraContext = extraContext || {};
  bookingOrders.saveBookingContext({
    date: extraContext.date || '',
    wharf: extraContext.wharf || ship.wharf || ship.displayWharf || '',
    people: extraContext.people || '',
    keyword: extraContext.keyword || ship.shipName || ''
  });
  wx.navigateTo({
    url: '/pages/ship-detail/ship-detail',
    success: function (res) {
      res.eventChannel.emit('acceptShipData', { ship: ship });
    }
  });
}

function goEventPage(eventId) {
  if (!eventId) return;
  wx.navigateTo({
    url: '/pages/event/event?id=' + eventId
  });
}

module.exports = {
  goBookShip: goBookShip,
  goEventPage: goEventPage
};
