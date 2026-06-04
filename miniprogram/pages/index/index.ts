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
    weather: {
      date: '06/02',
      week: '星期二',
      temp: '26°C',
      desc: '晴朗',
      wind: '东南风 3级',
      icon: '☀️',
      sea: '平静'
    },
    tide: [
      { label: '涨潮', time: '07:28', height: '1.8m' },
      { label: '落潮', time: '13:45', height: '0.6m' }
    ],
    tabs: ['海钓约船', '赛事报名'],
    activeTab: 0,
    selectedDate: defaultDate,
    minDate: defaultDate,
    maxDate,
    pax: 2,
    boats: [
      {
        id: 1,
        image: '/images/yuyuebanner-1.jpg',
        name: '深海探索',
        captain: '阿峰',
        capacity: 8,
        price: 980
      },
      {
        id: 2,
        image: '/images/yuyuebanner-2.jpg',
        name: '海风之旅',
        captain: '婷婷',
        capacity: 8,
        price: 1680
      },
      {
        id: 3,
        image: '/images/yuyuebanner-3.jpg',
        name: '蓝海号渔船',
        captain: '大海',
        capacity: 10,
        price: 1280
      }
    ],
    eventCards: [
      {
        id: 1,
        banner: '/images/baomingbanner-1.jpg',
        title: '大鱼挑战赛',
        location: '长山群岛',
        date: '2026.07.12-07.14'
      },
      {
        id: 2,
        banner: '/images/baomingbanner-2.jpg',
        title: '金秋海钓赛',
        location: '大连海域',
        date: '2026.09.18-09.20'
      },
      {
        id: 3,
        banner: '/images/baomingbanner-3.jpg',
        title: '冠军对决赛',
        location: '烟台海岸',
        date: '2026.08.05-08.07'
      }
    ],
    showReservePopup: false,
    reserveBoat: {
      name: '',
      captain: ''
    }
  },

  onLoad() {
    // 这里可以后续补充接口请求
  },

  onTabChange(event: any) {
    const index = Number(event.currentTarget.dataset.index)
    this.setData({ activeTab: index })
  },

  bindDateChange(event: any) {
    this.setData({ selectedDate: event.detail.value })
  },

  changePax(event: any) {
    const delta = Number(event.currentTarget.dataset.delta)
    let pax = this.data.pax + delta
    if (pax < 1) pax = 1
    this.setData({ pax })
  },

  openReserve(event: any) {
    const id = Number(event.currentTarget.dataset.id)
    const boat = this.data.boats.find((item) => item.id === id) || { name: '', captain: '' }
    this.setData({ showReservePopup: true, reserveBoat: boat })
  },

  closeReserve() {
    this.setData({ showReservePopup: false, reserveBoat: { name: '', captain: '' } })
  },

  confirmReserve() {
    wx.showToast({ title: '预约提交成功，接口待接入', icon: 'none' })
    this.closeReserve()
  },

  onEventTap(event: any) {
    const id = Number(event.currentTarget.dataset.id)
    wx.navigateTo({ url: `/pages/event/event?id=${id}` })
  },

  openBooking() {
    wx.showToast({ title: '进入预约流程（示例）', icon: 'none' })
    // TODO: 可跳转到预约页面或打开预约弹层
  }
})
