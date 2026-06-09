var auth = require('../../../utils/auth');
var idCard = require('../../../utils/idCard');

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
    this._realNameDraft = e.detail.value;
  },

  onNameBlur: function () {
    if (this._realNameDraft == null) return;
    this.setData({ realName: this._realNameDraft });
  },

  onIdInput: function (e) {
    this._idNumberDraft = e.detail.value;
  },

  onIdBlur: function () {
    if (this._idNumberDraft == null) return;
    this.setData({ idNumber: this._idNumberDraft });
  },

  onSubmit: function () {
    var realName = this._realNameDraft != null ? this._realNameDraft : this.data.realName;
    var idNumber = this._idNumberDraft != null ? this._idNumberDraft : this.data.idNumber;
    var idType = this.data.idTypeOptions[this.data.idTypeIndex] || '身份证';
    var nameResult = idCard.validateRealName(realName);
    if (!nameResult.ok) {
      wx.showToast({ title: nameResult.message, icon: 'none' });
      return;
    }

    var payload = {
      idType: idType,
      realName: nameResult.value,
      idNumber: ''
    };

    if (idType === '身份证') {
      var idResult = idCard.validateIdCard(idNumber);
      if (!idResult.ok) {
        wx.showToast({ title: idResult.message, icon: 'none' });
        return;
      }
      payload.idNumber = idResult.value;
    } else {
      payload.idNumber = trim(idNumber);
      if (!payload.idNumber) {
        wx.showToast({ title: '请输入证件号', icon: 'none' });
        return;
      }
    }

    var self = this;
    auth
      .saveVerificationRemote(payload)
      .then(function () {
        wx.showToast({ title: '认证成功', icon: 'success' });
        setTimeout(function () {
          self.finishVerify();
        }, 600);
      })
      .catch(function (err) {
        wx.showToast({
          title: (err && err.message) || '认证失败，请重试',
          icon: 'none'
        });
      });
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
