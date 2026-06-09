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
      setTimeout(function () {
        const bookingOrders = require('./utils/bookingOrders')
        bookingOrders.syncLocalOrdersToServer()
        const mapFavorites = require('./utils/mapFavorites')
        mapFavorites.syncFromServerIfStale(60000)
      }, 2000)
    }
  },
})