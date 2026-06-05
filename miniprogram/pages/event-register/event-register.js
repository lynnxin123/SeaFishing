var auth = require('../../utils/auth');
var eventService = require('../../utils/eventService');

Page({
  data: {
    competition: null,
    form: {
      realName: '',
      phone: '',
      people: '',
      emergencyContact: '',
      remark: ''
    }
  },

  onLoad(options) {
    var id = options.id || '';
    var competition = eventService.getCompetitionById(id);
    if (!competition) {
      wx.showToast({ title: '赛事不存在', icon: 'none' });
      setTimeout(function () {
        wx.navigateBack();
      }, 1200);
      return;
    }
    if (competition.status === 'ended') {
      wx.showToast({ title: '该赛事已结束', icon: 'none' });
      setTimeout(function () {
        wx.navigateBack();
      }, 1200);
      return;
    }

    this._eventId = id;
    this._registerUrl = eventService.EVENT_REGISTER_PATH + '?id=' + id;

    if (!this.guardRegisterAccess()) {
      return;
    }

    this.initForm(competition);
  },

  onShow() {
    if (!this._eventId || !this.data.competition) return;
    if (auth.isLoggedIn() && auth.isVerified()) {
      var profile = auth.getUserProfile() || {};
      if (profile.realName && !this.data.form.realName) {
        this.setData({ 'form.realName': profile.realName });
      }
    }
  },

  guardRegisterAccess() {
    if (!auth.isLoggedIn()) {
      wx.showModal({
        title: '提示',
        content: '请先登录后再报名参赛',
        confirmText: '去登录',
        cancelText: '取消',
        success: function (res) {
          if (res.confirm) {
            auth.goLogin({ redirect: this._registerUrl });
          } else {
            wx.navigateBack();
          }
        }.bind(this)
      });
      return false;
    }

    if (!auth.isVerified()) {
      auth.promptVerify({
        from: 'event-register',
        redirect: this._registerUrl,
        content: '参赛报名需先完成实名认证，请认证后再填写报名表'
      });
      setTimeout(function () {
        wx.navigateBack();
      }, 300);
      return false;
    }

    return true;
  },

  initForm(competition) {
    var profile = auth.getUserProfile() || {};
    this.setData({
      competition: competition,
      form: {
        realName: profile.realName || '',
        phone: profile.phone || '',
        people: '',
        emergencyContact: '',
        remark: ''
      }
    });
  },

  onInput(e) {
    var field = e.currentTarget.dataset.field;
    var value = e.detail.value;
    if (!field) return;
    this.setData({
      ['form.' + field]: value
    });
  },

  onSubmit() {
    if (!auth.isLoggedIn()) {
      auth.goLogin({ redirect: this._registerUrl });
      return;
    }

    if (!auth.isVerified()) {
      auth.promptVerify({
        from: 'event-register',
        redirect: this._registerUrl,
        content: '参赛报名需先完成实名认证'
      });
      return;
    }

    var form = this.data.form;
    if (!form.realName || !form.realName.trim()) {
      wx.showToast({ title: '请输入姓名', icon: 'none' });
      return;
    }
    if (!/^1\d{10}$/.test(form.phone || '')) {
      wx.showToast({ title: '请输入正确手机号', icon: 'none' });
      return;
    }
    if (!form.people || Number(form.people) < 1) {
      wx.showToast({ title: '请输入参赛人数', icon: 'none' });
      return;
    }

    wx.showLoading({ title: '提交中' });
    setTimeout(function () {
      wx.hideLoading();
      wx.showToast({ title: '报名提交成功', icon: 'success' });
      setTimeout(function () {
        wx.navigateBack();
      }, 1000);
    }, 600);
  }
});
