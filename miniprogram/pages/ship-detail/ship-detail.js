var auth = require('../../utils/auth');
var bookingOrders = require('../../utils/bookingOrders');

const DEFAULT_SHIP = {
  shipName: '辽长渔休55210',
  boatId: '55210',
  maxNum: 3,
  shipLen: '7.66',
  shipWid: '2.2',
  price: '2500',
  coverImage: '/images/boat1.jpg',
  ageLimit: '18-65岁可约船',
  engineCount: '1',
  enginePower: '183千瓦',
  inSurvey: '是',
  hasFishFinder: '是',
  hasRadar: '是',
  provideTackle: '是',
  facilities: [],
  captainName: '郭巍',
  captainGender: '男',
  captainAvatar: '/images/captain.jpg',
  sailingYears: '2',
  sailCount: 0,
  score: 0,
  scoreDisplay: '0.0',
  departWharf: '东獐子渔港',
  returnWharf: '东獐子渔港',
  itineraryDesc: '',
  serviceContent: '',
  fishingTips: '请提前30分钟到达码头办理登船手续，建议穿着防滑鞋并注意防晒。',
  refundRules: '出发前24小时可免费取消；24小时内取消收取30%违约金。',
  reviews: []
};

function formatDate(date) {
  var y = date.getFullYear();
  var m = String(date.getMonth() + 1).padStart(2, '0');
  var d = String(date.getDate()).padStart(2, '0');
  return y + '-' + m + '-' + d;
}

Page({
  data: {
    tabs: ['船舶介绍', '海钓提示', '退改规则', '评价'],
    activeTab: 0,
    favorited: false,
    ship: Object.assign({}, DEFAULT_SHIP),
    showBookingSheet: false,
    bookingDate: '',
    bookingPeople: '1'
  },

  onLoad() {
    var today = formatDate(new Date());
    this.setData({ bookingDate: today });

    const eventChannel = this.getOpenerEventChannel();
    if (eventChannel && eventChannel.on) {
      eventChannel.on('acceptShipData', function (data) {
        if (data && data.ship) this.initShip(data.ship);
      }.bind(this));
    }
  },

  onShow() {
    if (!bookingOrders.consumePendingBookAfterVerify() || !auth.isLoggedIn()) {
      return;
    }
    if (!auth.isVerified()) {
      bookingOrders.setPendingBookAfterVerify(true);
      auth.promptVerify({ from: 'book' });
      return;
    }
    this.openBookingSheet();
  },

  initShip(ship) {
    const merged = Object.assign({}, DEFAULT_SHIP, {
      shipName: ship.shipName || DEFAULT_SHIP.shipName,
      boatId: ship.boatId || DEFAULT_SHIP.boatId,
      maxNum: ship.maxNum != null ? ship.maxNum : DEFAULT_SHIP.maxNum,
      shipLen: ship.shipLen != null ? String(ship.shipLen) : DEFAULT_SHIP.shipLen,
      shipWid: ship.shipWid != null ? String(ship.shipWid) : DEFAULT_SHIP.shipWid,
      price: ship.price != null ? String(Math.round(Number(ship.price))) : DEFAULT_SHIP.price,
      coverImage: (ship.images && ship.images[0]) || ship.coverImage || DEFAULT_SHIP.coverImage,
      facilities: Array.isArray(ship.facilities) ? ship.facilities.slice() : [],
      captainName: ship.captain || DEFAULT_SHIP.captainName,
      captainAvatar: ship.captainAvatar || DEFAULT_SHIP.captainAvatar,
      sailingYears:
        ship.experience != null
          ? String(ship.experience)
          : ship.sailingYears != null
            ? String(ship.sailingYears)
            : DEFAULT_SHIP.sailingYears,
      sailCount: ship.sailCount != null ? ship.sailCount : 0,
      score: ship.score != null ? ship.score : 0,
      scoreDisplay: Number(ship.score || 0).toFixed(1),
      departWharf: ship.wharf || ship.displayWharf || DEFAULT_SHIP.departWharf,
      returnWharf: ship.wharf || ship.displayWharf || DEFAULT_SHIP.returnWharf
    });
    this.setData({ ship: merged });
  },

  onTabChange(e) {
    const index = Number(e.currentTarget.dataset.index);
    if (Number.isNaN(index)) return;
    this.setData({ activeTab: index });
  },

  onToggleFavorite() {
    const favorited = !this.data.favorited;
    this.setData({ favorited });
    wx.showToast({
      title: favorited ? '已收藏' : '已取消收藏',
      icon: 'none'
    });
  },

  onShare() {
    wx.showShareMenu({ withShareTicket: true, menus: ['shareAppMessage', 'shareTimeline'] });
    wx.showToast({ title: '请点击右上角分享', icon: 'none' });
  },

  openBookingSheet() {
    var ctx = bookingOrders.getBookingContext();
    this.setData({
      showBookingSheet: true,
      bookingDate: ctx.date || this.data.bookingDate || formatDate(new Date()),
      bookingPeople: ctx.people ? String(ctx.people) : '1'
    });
  },

  closeBookingSheet() {
    this.setData({ showBookingSheet: false });
  },

  onBookingDateChange(e) {
    this.setData({ bookingDate: e.detail.value });
  },

  onBookingPeopleInput(e) {
    this.setData({ bookingPeople: e.detail.value });
  },

  onConfirmBooking() {
    var date = this.data.bookingDate;
    var people = String(this.data.bookingPeople || '').replace(/^\s+|\s+$/g, '');
    var maxNum = Number(this.data.ship.maxNum) || 1;

    if (!date) {
      wx.showToast({ title: '请选择出行日期', icon: 'none' });
      return;
    }
    if (!people || !/^\d+$/.test(people) || Number(people) < 1) {
      wx.showToast({ title: '请输入有效人数', icon: 'none' });
      return;
    }
    if (Number(people) > maxNum) {
      wx.showToast({ title: '超过船舶载客上限', icon: 'none' });
      return;
    }

    var ship = this.data.ship;
    this.closeBookingSheet();
    wx.showModal({
      title: '确认预约',
      content:
        '船舶：' +
        ship.shipName +
        '\n出行日期：' +
        date +
        '\n人数：' +
        people +
        '人',
      confirmText: '确认',
      cancelText: '取消',
      success: function (res) {
        if (!res.confirm) {
          return;
        }
        bookingOrders.saveBookingContext({
          date: date,
          people: people,
          wharf: ship.departWharf
        });
        bookingOrders.addBookingOrder({
          shipName: ship.shipName,
          boatId: ship.boatId,
          coverImage: ship.coverImage,
          price: ship.price,
          wharf: ship.departWharf,
          departWharf: ship.departWharf,
          captainName: ship.captainName,
          date: date,
          people: people,
          status: 'pending_accept'
        });
        bookingOrders.goOrdersAfterSuccess();
      }
    });
  },

  onBook() {
    if (!auth.isLoggedIn()) {
      bookingOrders.setPendingBookAfterVerify(true);
      auth.goLogin({ from: 'book' });
      return;
    }
    if (!auth.isVerified()) {
      bookingOrders.setPendingBookAfterVerify(true);
      auth.promptVerify({ from: 'book' });
      return;
    }
    this.openBookingSheet();
  }
});
