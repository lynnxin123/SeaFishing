var auth = require('../../utils/auth');

function trim(str) {
  return String(str || '').replace(/^\s+|\s+$/g, '');
}

Page({
  data: {
    idTypeOptions: ['身份证'],
    idTypeIndex: 0,
    realName: '',
    idNumber: ''
  },

  onLoad: function (options) {
    this._from = options.from || '';
    this._redirect = options.redirect ? decodeURIComponent(options.redirect) : '';
    var profile = auth.getUserProfile();
    if (profile && profile.verified) {
      this.setData({
        realName: profile.realName || '',
        idNumber: profile.idNumber || ''
      });
    }
  },

  onIdTypeChange: function (e) {
    this.setData({ idTypeIndex: Number(e.detail.value) || 0 });
  },

  onNameInput: function (e) {
    this.setData({ realName: e.detail.value });
  },

  onIdInput: function (e) {
    this.setData({ idNumber: e.detail.value });
  },

  onSubmit: function () {
    var realName = trim(this.data.realName);
    var idNumber = trim(this.data.idNumber);
    var idType = this.data.idTypeOptions[this.data.idTypeIndex] || '身份证';

    if (!realName) {
      wx.showToast({ title: '请输入姓名', icon: 'none' });
      return;
    }
    if (!idNumber) {
      wx.showToast({ title: '请输入证件号', icon: 'none' });
      return;
    }

    auth.saveVerification({
      idType: idType,
      realName: realName,
      idNumber: idNumber
    });

    wx.showToast({ title: '认证成功', icon: 'success' });
    var self = this;
    setTimeout(function () {
      self.finishVerify();
    }, 600);
  },

  finishVerify: function () {
    if (this._redirect) {
      wx.redirectTo({
        url: this._redirect,
        fail: function () {
          wx.navigateBack();
        }
      });
      return;
    }
    wx.navigateBack({
      fail: function () {
        wx.switchTab({ url: '/pages/my/my' });
      }
    });
  }
});
