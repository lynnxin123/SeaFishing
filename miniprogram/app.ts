// app.ts
App<IAppOption>({
  globalData: {
    isLoggedIn: false,
    userProfile: null as WechatMiniprogram.IAnyObject | null
  },
  onLaunch() {
    const auth = require('./utils/auth')
    auth.syncLoginState()
    if (wx.getStorageSync('token')) {
      auth.refreshProfileFromServer({ minIntervalMs: 60000 })
      require('./utils/messageService').refreshTabBarBadge()
      setTimeout(function () {
        const bookingOrders = require('./utils/bookingOrders')
        bookingOrders.syncLocalOrdersToServer()
      }, 2000)
    } else {
      require('./utils/messageService').syncTabBarBadge(0)
    }
  },
})