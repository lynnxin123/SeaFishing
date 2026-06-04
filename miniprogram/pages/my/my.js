Page({
  data: {
    hasUserInfo: false,
    userInfo: {
      nickName: '',
      avatarUrl: ''
    },
    events: [
      { id: 1, title: '北海竞技赛', date: '2026.07.18' },
      { id: 2, title: '金秋积分赛', date: '2026.09.14' }
    ]
  },
  getUserProfile() {
    wx.getUserProfile({
      desc: '获取用户信息用于展示我的页',
      success: (res) => {
        this.setData({ hasUserInfo: true, userInfo: res.userInfo })
      },
      fail: () => {
        wx.showToast({ title: '授权失败', icon: 'none' })
      }
    })
  }
})
