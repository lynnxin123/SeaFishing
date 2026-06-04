Page({
  data: {
    selectedEvent: null,
    events: [
      { id: 1, title: '大鱼挑战赛', location: '长山群岛', date: '2026.07.12-07.14' },
      { id: 2, title: '金秋海钓赛', location: '大连海域', date: '2026.09.18-09.20' },
      { id: 3, title: '冠军对决赛', location: '烟台海岸', date: '2026.08.05-08.07' }
    ]
  },
  onLoad(options) {
    if (options.id) {
      const eventId = Number(options.id)
      const selectedEvent = this.data.events.find((item) => item.id === eventId) || null
      this.setData({ selectedEvent })
    }
  }
})
