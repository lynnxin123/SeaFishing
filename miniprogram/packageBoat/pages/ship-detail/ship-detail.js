var auth = require('../../../utils/auth');
var bookingOrders = require('../../../utils/bookingOrders');
var boatSocial = require('../../../utils/boatSocial');
var contactUtil = require('../../../utils/contact');

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

function pickFirstSlot(slots, bookingType) {
  if (!slots || !slots.length) return null;
  var key = bookingType === 'charter' ? 'availableCharter' : 'availableShared';
  for (var i = 0; i < slots.length; i++) {
    if (slots[i][key]) return slots[i];
  }
  return null;
}

function isSlotAvailable(slot, bookingType) {
  if (!slot) return false;
  return bookingType === 'charter' ? !!slot.availableCharter : !!slot.availableShared;
}

Page({
  data: {
    tabs: ['船舶介绍', '海钓提示', '退改规则', '评价'],
    activeTab: 0,
    favorited: false,
    pageState: 'loading',
    loadError: '',
    ship: null,
    showBookingSheet: false,
    bookingDate: '',
    bookingPeople: '1',
    bookingPhone: '',
    bookingWechat: '',
    bookingType: 'shared',
    slotList: [],
    selectedSlotId: '',
    selectedSlotTime: '',
    rulesSummary: null,
    slotsLoading: false,
    slotsLoadError: '',
    isTestAccount: false
  },

  onLoad(options) {
    options = options || {};
    var today = formatDate(new Date());
    this.setData({ bookingDate: today });
    this._loadedFromChannel = false;

    const eventChannel = this.getOpenerEventChannel();
    if (eventChannel && eventChannel.on) {
      eventChannel.on('acceptShipData', function (data) {
        if (data && data.ship) {
          this._loadedFromChannel = true;
          this.initShip(data.ship);
        }
      }.bind(this));
    }

    var self = this;
    if (options.boatId) {
      this._pendingBoatId = options.boatId;
      setTimeout(function () {
        if (!self._loadedFromChannel) {
          self.loadShipById(options.boatId);
        }
      }, 80);
      return;
    }

    setTimeout(function () {
      if (!self._loadedFromChannel) {
        self.setData({
          pageState: 'error',
          loadError: '未获取到船只信息'
        });
      }
    }, 600);
  },

  onRetryLoad() {
    var boatId = this._pendingBoatId;
    if (!boatId) return;
    this.loadShipById(boatId);
  },

  loadShipById(boatId) {
    var self = this;
    var api = require('../../../config/api');
    var featuredBoats = require('../../../utils/featuredBoats');
    this._pendingBoatId = boatId;

    function applyShip(ship, favorited) {
      if (!ship) {
        self.setData({
          pageState: 'error',
          loadError: '船只信息不存在'
        });
        return;
      }
      self._loadedFromChannel = true;
      self.initShip(ship, favorited);
    }

    this.setData({ pageState: 'loading', loadError: '' });

    if (!api.USE_API) {
      applyShip(featuredBoats.findByBoatId(boatId));
      return;
    }

    var request = require('../../../utils/request');
    var reqs = [request.get('/boats/' + boatId)];
    if (auth.isLoggedIn()) {
      reqs.push(boatSocial.checkFavorite(boatId));
    }
    Promise.all(reqs)
      .then(function (results) {
        var ship = results[0];
        var favorited =
          auth.isLoggedIn() && typeof results[1] === 'boolean' ? results[1] : undefined;
        applyShip(ship, favorited);
      })
      .catch(function () {
        var local = featuredBoats.findByBoatId(boatId);
        if (local) {
          applyShip(local);
          return;
        }
        self.setData({
          pageState: 'error',
          loadError: '船只信息加载失败，请重试'
        });
      });
  },

  onShareAppMessage() {
    var ship = this.data.ship || {};
    return {
      title: (ship.shipName || '船舶详情') + ' - 海发海钓',
      path: '/packageBoat/pages/ship-detail/ship-detail?boatId=' + encodeURIComponent(ship.boatId || '')
    };
  },

  _resetPageOverlay() {
    try {
      wx.hideLoading();
      wx.hideToast();
    } catch (e) {}
    this._openBookingWhenReady = false;
    this._bookingSubmitting = false;
    if (this.data.showBookingSheet) {
      this.setData({ showBookingSheet: false });
    }
  },

  onHide() {
    this._resetPageOverlay();
  },

  onShow() {
    var pendingOpen = bookingOrders.consumePendingBookAfterVerify();
    if (!pendingOpen || !auth.isLoggedIn()) {
      this._resetPageOverlay();
      return;
    }
    if (!auth.isVerified()) {
      this._resetPageOverlay();
      bookingOrders.setPendingBookAfterVerify(true);
      auth.promptVerify({ from: 'book' });
      return;
    }
    var ship = this.data.ship;
    if (!ship || !ship.boatId || this.data.pageState !== 'ready') {
      this._openBookingWhenReady = true;
      return;
    }
    this.openBookingSheet();
  },

  initShip(ship, favoriteState) {
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
      returnWharf: ship.wharf || ship.displayWharf || DEFAULT_SHIP.returnWharf,
      serviceContent: ship.description || ship.serviceContent || DEFAULT_SHIP.serviceContent,
      itineraryDesc: ship.description || ship.itineraryDesc || DEFAULT_SHIP.itineraryDesc
    });
    this.setData({
      ship: merged,
      pageState: 'ready',
      loadError: ''
    });
    if (this._openBookingWhenReady) {
      this._openBookingWhenReady = false;
      this.openBookingSheet();
    } else if (this.data.showBookingSheet || this._pendingSlotDate) {
      this.loadBookingSlots(this.data.bookingDate || this._pendingSlotDate, true);
      this._pendingSlotDate = '';
    }
    this._reviewsLoaded = false;
    if (typeof favoriteState === 'boolean') {
      this.setData({ favorited: favoriteState });
    } else {
      this.loadFavoriteStatus(merged.boatId);
    }
  },

  loadFavoriteStatus(boatId) {
    if (!boatId || !auth.isLoggedIn()) return;
    var self = this;
    boatSocial.checkFavorite(boatId).then(function (favorited) {
      self.setData({ favorited: favorited });
    });
  },

  loadReviews(boatId) {
    if (!boatId || this._reviewsLoaded) return;
    var self = this;
    this._reviewsLoaded = true;
    boatSocial.fetchReviews(boatId).then(function (reviews) {
      self.setData({ 'ship.reviews': reviews || [] });
    });
  },

  onTabChange(e) {
    const index = Number(e.currentTarget.dataset.index);
    if (Number.isNaN(index)) return;
    this.setData({ activeTab: index });
    if (index === 3) {
      this.loadReviews(this.data.ship.boatId);
    }
  },

  onToggleFavorite() {
    var self = this;
    var boatId = this.data.ship.boatId;
    if (!auth.isLoggedIn()) {
      auth.goLogin({ from: 'book' });
      return;
    }
    if (this._favoriteSubmitting) return;
    this._favoriteSubmitting = true;
    boatSocial
      .toggleFavorite(boatId, this.data.favorited)
      .then(function (favorited) {
        self.setData({ favorited: favorited });
        try {
          require('../../../utils/pageRefresh').resetRefresh('boat-favorites');
        } catch (e) {}
        wx.showToast({
          title: favorited ? '已收藏' : '已取消收藏',
          icon: 'none'
        });
      })
      .catch(function (err) {
        if (err && err.code === 'NEED_LOGIN') {
          auth.goLogin({ from: 'book' });
          return;
        }
        wx.showToast({ title: (err && err.message) || '操作失败', icon: 'none' });
      })
      .finally(function () {
        self._favoriteSubmitting = false;
      });
  },

  onAddReview() {
    var self = this;
    if (!auth.isLoggedIn()) {
      auth.goLogin({ from: 'book' });
      return;
    }
    wx.showModal({
      title: '发表评价',
      editable: true,
      placeholderText: '分享你的出海体验（至少2个字）',
      success: function (res) {
        if (!res.confirm) return;
        var content = String(res.content || '').trim();
        if (content.length < 2) {
          wx.showToast({ title: '评价内容太短', icon: 'none' });
          return;
        }
        boatSocial
          .submitReview(self.data.ship.boatId, { score: 5, content: content })
          .then(function () {
            wx.showToast({ title: '评价成功', icon: 'success' });
            self._reviewsLoaded = false;
            self.loadReviews(self.data.ship.boatId);
          })
          .catch(function (err) {
            wx.showToast({ title: (err && err.message) || '评价失败', icon: 'none' });
          });
      }
    });
  },

  onShare() {
    wx.showShareMenu({ withShareTicket: true, menus: ['shareAppMessage', 'shareTimeline'] });
    wx.showToast({ title: '请点击右上角分享', icon: 'none' });
  },

  openBookingSheet() {
    bookingOrders.clearReservePending();
    var ctx = bookingOrders.getBookingContext();
    var date = ctx.date || this.data.bookingDate || formatDate(new Date());
    var profile = auth.getUserProfile() || {};
    var self = this;
    this.setData({
      showBookingSheet: true,
      bookingDate: date,
      bookingPeople: ctx.people ? String(ctx.people) : '1',
      bookingPhone: '',
      bookingWechat: '',
      bookingType: 'shared',
      slotList: [],
      selectedSlotId: '',
      selectedSlotTime: '',
      slotsLoading: true,
      slotsLoadError: '',
      isTestAccount: profile.isTestAccount === true || contactUtil.isTestAccount(),
      rulesSummary: this.data.rulesSummary || null
    });
    auth.refreshProfileFromServer({ minIntervalMs: 60000 }).then(function (p) {
      if (!p || p.isTestAccount !== true) return;
      self.setData({ isTestAccount: true });
    });
    this.loadBookingSlots(date);
    if (!this.data.rulesSummary) {
      bookingOrders.fetchBookingRules().then(function (rules) {
        if (rules) {
          self.setData({ rulesSummary: rules });
        }
      });
    }
  },

  loadBookingSlots(date, forceRefresh) {
    var ship = this.data.ship;
    if (!ship || !ship.boatId) {
      this._pendingSlotDate = date;
      this.setData({ slotsLoading: true, slotsLoadError: '' });
      return;
    }
    var self = this;
    this._pendingSlotDate = '';
    this._slotReqId = (this._slotReqId || 0) + 1;
    var reqId = this._slotReqId;
    this.setData({ slotsLoading: true, slotsLoadError: '' });
    bookingOrders
      .fetchSlotAvailability(ship.boatId, date, { force: !!forceRefresh })
      .then(function (res) {
        if (reqId !== self._slotReqId) return;
        var slots = (res && res.slots) || [];
        var first = pickFirstSlot(slots, self.data.bookingType);
        self.setData({
          slotList: slots,
          slotsLoading: false,
          slotsLoadError: '',
          selectedSlotId: first ? first.sailSlotId : '',
          selectedSlotTime: first ? first.slotTime : '',
          rulesSummary: (res && res.rulesSummary) || self.data.rulesSummary
        });
      })
      .catch(function () {
        if (reqId !== self._slotReqId) return;
        self.setData({
          slotsLoading: false,
          slotList: [],
          slotsLoadError: '时段加载失败，请重试'
        });
      });
  },

  onRetryLoadSlots() {
    this.loadBookingSlots(this.data.bookingDate, true);
  },

  closeBookingSheet(options) {
    options = options || {};
    var ctx = bookingOrders.getBookingContext();
    var fromIndexReserve = ctx && ctx.fromIndexReserve === true;
    this._openBookingWhenReady = false;
    bookingOrders.clearReservePending();
    this.setData({
      showBookingSheet: false,
      bookingPhone: '',
      bookingWechat: ''
    });
    if (fromIndexReserve && !options.keepPage) {
      bookingOrders.saveBookingContext({
        date: ctx.date,
        wharf: ctx.wharf,
        people: ctx.people,
        keyword: ctx.keyword,
        fromIndexReserve: false
      });
      wx.navigateBack({ delta: 1 });
    }
  },

  onBookingDateChange(e) {
    var date = e.detail.value;
    this.setData({ bookingDate: date });
    this.loadBookingSlots(date, true);
  },

  onBookingTypeTap(e) {
    var type = e.currentTarget.dataset.type;
    if (!type) return;
    var first = pickFirstSlot(this.data.slotList, type);
    this.setData({
      bookingType: type,
      selectedSlotId: first ? first.sailSlotId : '',
      selectedSlotTime: first ? first.slotTime : ''
    });
  },

  onSlotTap(e) {
    var id = e.currentTarget.dataset.id;
    var time = e.currentTarget.dataset.time;
    var index = Number(e.currentTarget.dataset.index);
    var slot = this.data.slotList[index];
    if (!isSlotAvailable(slot, this.data.bookingType)) {
      wx.showToast({
        title: (slot && slot.bookingClosedReason) || '该时段不可预约',
        icon: 'none'
      });
      return;
    }
    this.setData({ selectedSlotId: id, selectedSlotTime: time });
  },

  onBookingPeopleInput(e) {
    this.setData({ bookingPeople: e.detail.value });
  },

  onBookingPhoneInput(e) {
    this.setData({ bookingPhone: e.detail.value });
  },

  onBookingWechatInput(e) {
    this.setData({ bookingWechat: e.detail.value });
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
    if (!this.data.selectedSlotId) {
      wx.showToast({ title: '请选择出航时段', icon: 'none' });
      return;
    }

    var phone = String(this.data.bookingPhone || '').replace(/^\s+|\s+$/g, '');
    var wechat = String(this.data.bookingWechat || '').replace(/^\s+|\s+$/g, '');
    var contactCheck = contactUtil.validateContact(phone, wechat);
    if (!contactCheck.ok) {
      wx.showToast({ title: contactCheck.message || '联系方式无效', icon: 'none' });
      return;
    }

    var ship = this.data.ship;
    var bookingType = this.data.bookingType || 'shared';
    var slotTime = this.data.selectedSlotTime;
    var sailSlotId = this.data.selectedSlotId;
    var typeLabel = bookingType === 'charter' ? '包船' : '散拼';
    var self = this;
    wx.showModal({
      title: '确认预约',
      content:
        '船舶：' +
        ship.shipName +
        '\n船型：' +
        typeLabel +
        '\n出行日期：' +
        date +
        ' ' +
        slotTime +
        '\n人数：' +
        people +
        '人' +
        '\n\n提交后需先完成付款，船长才会确认接单。',
      confirmText: '确认',
      cancelText: '取消',
      success: function (res) {
        if (!res.confirm) {
          return;
        }
        auth
          .saveContactRemote({ phone: phone, wechatId: wechat })
          .then(function () {
            return self._submitBookingOrder(ship, date, people, bookingType, slotTime, sailSlotId);
          })
          .catch(function (err) {
            wx.showToast({
              title: (err && err.message) || '保存联系方式失败',
              icon: 'none',
              duration: 2500
            });
          });
      }
    });
  },

  _submitBookingOrder(ship, date, people, bookingType, slotTime, sailSlotId) {
    if (this._bookingSubmitting) {
      return;
    }
    this._bookingSubmitting = true;
    wx.showLoading({ title: '提交中' });
    var self = this;
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
          bookingType: bookingType,
          sailSlotId: sailSlotId,
          slotTime: slotTime,
          status: 'pending_pay'
        }).then(function (order) {
          var ctx = bookingOrders.getBookingContext();
          if (ctx && ctx.fromIndexReserve) {
            bookingOrders.saveBookingContext({
              date: ctx.date,
              wharf: ctx.wharf,
              people: ctx.people,
              keyword: ctx.keyword,
              fromIndexReserve: false
            });
          }
          self.closeBookingSheet({ keepPage: true });
          self._bookingSubmitting = false;
          wx.hideLoading({
            complete: function () {
              bookingOrders.goOrdersAfterSuccess(order && order.id);
            }
          });
        }).catch(function (err) {
          self._bookingSubmitting = false;
          wx.hideLoading();
          wx.showModal({
            title: '预约失败',
            content: (err && err.message) || '请检查网络后重试',
            showCancel: false,
            confirmText: '知道了'
          });
        });
  },

  bookRedirectUrl() {
    var ship = this.data.ship;
    if (!ship || !ship.boatId) return '';
    return (
      '/packageBoat/pages/ship-detail/ship-detail?boatId=' +
      encodeURIComponent(ship.boatId)
    );
  },

  onBook() {
    var redirect = this.bookRedirectUrl();
    if (!auth.isLoggedIn()) {
      bookingOrders.setPendingBookAfterVerify(true);
      auth.goLogin({ from: 'book', redirect: redirect });
      return;
    }
    if (!auth.isVerified()) {
      bookingOrders.setPendingBookAfterVerify(true);
      auth.promptVerify({ from: 'book', redirect: redirect });
      return;
    }
    this.openBookingSheet();
  }
});
