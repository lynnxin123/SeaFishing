/**
 * 复用约船页跳转船舶详情 / 预约流程
 */
var bookingOrders = require('./bookingOrders');

function saveShipBookingContext(ship, extraContext) {
  extraContext = extraContext || {};
  bookingOrders.saveBookingContext({
    date: extraContext.date || '',
    wharf: extraContext.wharf || ship.wharf || ship.displayWharf || '',
    people: extraContext.people || '',
    keyword: extraContext.keyword || ship.shipName || '',
    fromIndexReserve: extraContext.fromIndexReserve === true
  });
}

function shipDetailUrl(ship) {
  if (!ship || !ship.boatId) return '/packageBoat/pages/ship-detail/ship-detail';
  return (
    '/packageBoat/pages/ship-detail/ship-detail?boatId=' +
    encodeURIComponent(ship.boatId)
  );
}

function goBookShip(ship, extraContext) {
  if (!ship) return;
  saveShipBookingContext(ship, extraContext);
  wx.navigateTo({
    url: shipDetailUrl(ship),
    success: function (res) {
      res.eventChannel.emit('acceptShipData', { ship: ship });
    }
  });
}

/** 首页「立即预约」：进入船舶详情并自动打开预约表单（含时段选择） */
function goReserveShip(ship, extraContext) {
  if (!ship) return;
  saveShipBookingContext(
    ship,
    Object.assign({}, extraContext, { fromIndexReserve: true })
  );
  bookingOrders.setPendingBookAfterVerify(true);
  wx.navigateTo({
    url: shipDetailUrl(ship),
    success: function (res) {
      res.eventChannel.emit('acceptShipData', { ship: ship });
    }
  });
}

var eventService = require('./eventService');

function goEventPage(eventId) {
  if (!eventId) return;
  eventService.openEventDetail(eventId);
}

module.exports = {
  goBookShip: goBookShip,
  goReserveShip: goReserveShip,
  shipDetailUrl: shipDetailUrl,
  goEventPage: goEventPage
};
