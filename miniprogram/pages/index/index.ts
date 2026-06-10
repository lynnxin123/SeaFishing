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
    eventsError: ''
  },

  onLoad() {
    const api = require('../../config/api')
    const eventService = require('../../utils/eventService')
    if (api.USE_API) {
      this.setData({ boatsLoading: true })
    }
    const bannerPromise = eventService.fetchBanners().then((banners) => {
      if (Array.isArray(banners) && banners.length) {
        this.setData({ bannerImages: banners })
      }
    })
    const boatsPromise = this.loadFeaturedBoats()
    Promise.all([bannerPromise, boatsPromise]).catch(() => {})
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
      .catch((err: { message?: string }) => {
        this.setData({
          eventCards: [],
          eventsLoading: false,
          eventsError: (err && err.message) || '赛事加载失败，请重试'
        })
      })
  },

  loadFeaturedBoats() {
    const api = require('../../config/api')
    if (!api.USE_API) {
      this.setData({ boatsLoading: false, boatsError: '' })
      return Promise.resolve()
    }
    this.setData({ boatsLoading: true, boatsError: '' })
    const request = require('../../utils/request')
    return request
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

    // 登录/认证 redirect 已直达船舶详情，此处仅清理历史残留标记，避免取消后反复跳转
    bookingOrders.consumePendingIndexReserve()
    bookingOrders.clearReservePending()
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
    const ship = this.getFeaturedShip(id)
    if (!ship) return
    const ctx = {
      date: this.data.selectedDate,
      people: String(this.data.pax)
    }
    const redirect = bookingNavigate.shipDetailUrl(ship)
    if (!auth.isLoggedIn()) {
      bookingOrders.saveBookingContext(Object.assign({}, ctx, { fromIndexReserve: true }))
      bookingOrders.setPendingBookAfterVerify(true)
      auth.goLogin({ from: 'reserve', redirect: redirect })
      return
    }
    if (!auth.isVerified()) {
      bookingOrders.saveBookingContext(Object.assign({}, ctx, { fromIndexReserve: true }))
      bookingOrders.setPendingBookAfterVerify(true)
      auth.promptVerify({
        from: 'reserve',
        content: '预约需先完成实名认证',
        redirect: redirect
      })
      return
    }
    bookingNavigate.goReserveShip(ship, ctx)
  },

  onEventTap(event: any) {
    const id = Number(event.currentTarget.dataset.id)
    const eventService = require('../../utils/eventService')
    eventService.openEventDetail(id)
  }
})
