const auth = require('../../utils/auth')
const bookingOrders = require('../../utils/bookingOrders')
const featuredBoats = require('../../utils/featuredBoats')
const bookingNavigate = require('../../utils/bookingNavigate')
const marineConditions = require('../../utils/marineConditions')

const today = new Date()
const pad = (n: number) => String(n).padStart(2, '0')
const formatDate = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
const defaultDate = formatDate(today)
const maxDate = formatDate(new Date(today.getFullYear() + 1, today.getMonth(), today.getDate()))

Page({
  data: {
    bannerImages: [
      {
        url: '/images/banner-1.jpg',
        title: '海发船业',
        subtitle: '深海出航，专业钓鱼服务'
      },
      {
        url: '/images/banner-2.jpg',
        title: '海发船业',
        subtitle: '大连海钓首选渔船'
      },
      {
        url: '/images/banner-3.jpg',
        title: '海发船业',
        subtitle: '专业船队，安心出海'
      },
      {
        url: '/images/banner-4.jpg',
        title: '海发船业',
        subtitle: '丰收渔获，精彩不断'
      }
    ],
    weather: marineConditions.getConditionsForDate(defaultDate).weather,
    tide: marineConditions.getConditionsForDate(defaultDate).tide,
    tabs: ['海钓约船', '赛事报名'],
    activeTab: 0,
    selectedDate: defaultDate,
    minDate: defaultDate,
    maxDate,
    pax: 2,
    boats: featuredBoats.getIndexBoats(),
    boatsLoading: false,
    boatsError: '',
    eventCards: [] as Array<{ id: number; banner: string; title: string; location: string; date: string }>,
    eventsLoading: false,
    eventsError: '',
    showReservePopup: false,
    reserveBoat: {
      name: '',
      captain: ''
    }
  },

  onLoad() {
    const api = require('../../config/api')
    const eventService = require('../../utils/eventService')
    if (api.USE_API) {
      this.setData({ boatsLoading: true })
    }
    eventService.fetchBanners().then((banners) => {
      if (Array.isArray(banners) && banners.length) {
        this.setData({ bannerImages: banners })
      }
    })
    this.loadFeaturedBoats()
    this.refreshMarineConditions(this.data.selectedDate)
  },

  loadEventCards() {
    const eventService = require('../../utils/eventService')
    const api = require('../../config/api')
    if (!api.USE_API) {
      this.setData({
        eventCards: eventService.getIndexEventCards(),
        eventsLoading: false,
        eventsError: ''
      })
      return
    }
    this.setData({ eventsLoading: true, eventsError: '' })
    eventService
      .fetchCompetitionList({ strict: true, limit: 6 })
      .then(() => {
        this.setData({
          eventCards: eventService.getIndexEventCards(6),
          eventsLoading: false,
          eventsError: ''
        })
      })
      .catch(() => {
        this.setData({
          eventCards: eventService.getIndexEventCards(6),
          eventsLoading: false,
          eventsError: ''
        })
      })
  },

  loadFeaturedBoats() {
    const api = require('../../config/api')
    if (!api.USE_API) {
      this.setData({ boatsLoading: false, boatsError: '' })
      return
    }
    this.setData({ boatsLoading: true, boatsError: '' })
    const request = require('../../utils/request')
    request
      .get('/boats', { boatIds: featuredBoats.FEATURED_BOAT_IDS.join(',') })
      .then((res) => {
        const enriched = featuredBoats.enrichFromApi(res.items || [])
        if (enriched.length) {
          this.setData({
            boats: featuredBoats.getIndexBoats(enriched),
            boatsLoading: false,
            boatsError: ''
          })
          return
        }
        this.setData({
          boats: featuredBoats.getIndexBoats(),
          boatsLoading: false,
          boatsError: ''
        })
      })
      .catch(() => {
        // 主推船有静态兜底，接口失败时静默展示，避免首页反复提示
        this.setData({
          boats: featuredBoats.getIndexBoats(),
          boatsLoading: false,
          boatsError: ''
        })
      })
  },

  onShow() {
    const today = formatDate(new Date())
    if (this.data.selectedDate < today) {
      this.setData({ selectedDate: today, minDate: today })
      this.refreshMarineConditions(today)
    } else {
      this.refreshMarineConditions(this.data.selectedDate, true)
    }

    const boatId = bookingOrders.consumePendingIndexReserve()
    if (boatId == null || !auth.isLoggedIn()) {
      return
    }
    if (!auth.isVerified()) {
      bookingOrders.setPendingIndexReserve(boatId)
      auth.promptVerify({ from: 'reserve' })
      return
    }
    this.openReserveById(boatId)
  },

  refreshMarineConditions(dateStr: string, onlyIfChanged = false) {
    if (onlyIfChanged && this._lastMarineDate === dateStr) {
      return
    }
    const block = marineConditions.getConditionsForDate(dateStr)
    this._lastMarineDate = dateStr
    this.setData({
      weather: block.weather,
      tide: block.tide
    })
  },

  onTabChange(event: any) {
    const index = Number(event.currentTarget.dataset.index)
    this.setData({ activeTab: index })
    if (index === 1 && !this._eventsLoaded) {
      this._eventsLoaded = true
      this.loadEventCards()
    }
  },

  bindDateChange(event: any) {
    const selectedDate = event.detail.value
    this.setData({ selectedDate })
    this.refreshMarineConditions(selectedDate)
  },

  changePax(event: any) {
    const delta = Number(event.currentTarget.dataset.delta)
    let pax = this.data.pax + delta
    if (pax < 1) pax = 1
    this.setData({ pax })
  },

  getBoatCard(id: number) {
    return this.data.boats.find((item) => item.id === id) || { id, name: '', captain: '' }
  },

  getFeaturedShip(indexId: number) {
    const base = featuredBoats.findByIndexId(indexId)
    if (!base) return null
    const card = this.getBoatCard(indexId)
    return Object.assign({}, base, {
      shipName: card.name || base.shipName,
      captain: card.captain || base.captain,
      maxNum: card.capacity != null ? card.capacity : base.maxNum,
      price: card.price != null ? card.price : base.price,
      images: card.image ? [card.image] : base.images
    })
  },

  onBoatTap(event: any) {
    const id = Number(event.currentTarget.dataset.id)
    const ship = this.getFeaturedShip(id)
    if (!ship) return
    bookingNavigate.goBookShip(ship, {
      date: this.data.selectedDate,
      people: String(this.data.pax)
    })
  },

  openReserve(event: any) {
    const id = Number(event.currentTarget.dataset.id)
    if (!auth.isLoggedIn()) {
      bookingOrders.setPendingIndexReserve(id)
      auth.goLogin({ from: 'reserve' })
      return
    }
    if (!auth.isVerified()) {
      bookingOrders.setPendingIndexReserve(id)
      auth.promptVerify({ from: 'reserve' })
      return
    }
    this.openReserveById(id)
  },

  openReserveById(id: number) {
    const boat = this.getBoatCard(id)
    this.setData({ showReservePopup: true, reserveBoat: boat })
  },

  closeReserve() {
    this.setData({ showReservePopup: false, reserveBoat: { name: '', captain: '' } })
  },

  confirmReserve() {
    if (!auth.isLoggedIn()) {
      auth.goLogin({ from: 'reserve' })
      return
    }
    if (!auth.isVerified()) {
      const boat = this.data.reserveBoat as { id?: number }
      if (boat && boat.id != null) {
        bookingOrders.setPendingIndexReserve(boat.id)
      }
      auth.promptVerify({ from: 'reserve' })
      return
    }
    const card = this.data.reserveBoat as { id?: number; name?: string; captain?: string; price?: number; image?: string }
    const ship = card.id != null ? this.getFeaturedShip(card.id) : null
    bookingOrders.addBookingOrder({
      boatId: (ship && ship.boatId) || '',
      shipName: card.name || '海钓预约',
      captainName: card.captain || '',
      coverImage: card.image || '/images/Reservation1.jpg',
      price: card.price,
      date: this.data.selectedDate,
      people: String(this.data.pax),
      wharf: (ship && (ship.displayWharf || ship.wharf)) || '待定',
      departWharf: (ship && (ship.displayWharf || ship.wharf)) || '',
      status: 'pending_accept'
    }).then(function () {
      this.closeReserve()
      bookingOrders.goOrdersAfterSuccess()
    }.bind(this)).catch(function (err) {
      if (err && err.code === 'NEED_LOGIN') {
        auth.goLogin({ from: 'reserve' })
        return
      }
      wx.showToast({ title: (err && err.message) || '预约失败', icon: 'none' })
    })
  },

  onEventTap(event: any) {
    const id = Number(event.currentTarget.dataset.id)
    const eventService = require('../../utils/eventService')
    eventService.openEventDetail(id)
  }
})
