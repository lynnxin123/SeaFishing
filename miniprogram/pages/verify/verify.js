var auth = require('../../utils/auth');
var idCard = require('../../utils/idCard');

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
    var idType = this.data.idTypeOptions[this.data.idTypeIndex] || '身份证';
    var nameResult = idCard.validateRealName(this.data.realName);
    if (!nameResult.ok) {
      wx.showToast({ title: nameResult.message, icon: 'none' });
      return;
    }

    if (idType === '身份证') {
      var idResult = idCard.validateIdCard(this.data.idNumber);
      if (!idResult.ok) {
        wx.showToast({ title: idResult.message, icon: 'none' });
        return;
      }
      auth.saveVerification({
        idType: idType,
        realName: nameResult.value,
        idNumber: idResult.value
      });
    } else {
      var idNumber = trim(this.data.idNumber);
      if (!idNumber) {
        wx.showToast({ title: '请输入证件号', icon: 'none' });
        return;
      }
      auth.saveVerification({
        idType: idType,
        realName: nameResult.value,
        idNumber: idNumber
      });
    }

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
