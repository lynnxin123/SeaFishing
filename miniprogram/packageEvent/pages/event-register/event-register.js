var auth = require('../../../utils/auth');

var eventService = require('../../../utils/eventService');



Page({

  data: {

    pageState: 'loading',

    loadError: '',

    authHint: '',

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

    this._eventId = id;

    this._registerUrl = eventService.EVENT_REGISTER_PATH + '?id=' + id;

    if (!id) {

      this.setData({ pageState: 'error', loadError: '缺少赛事参数' });

      return;

    }

    this.loadCompetition(id);

  },



  loadCompetition(id) {

    var self = this;

    this.setData({ pageState: 'loading', loadError: '', authHint: '' });

    eventService

      .fetchCompetitionById(id, { strict: true })

      .then(function (competition) {

        if (!competition) {

          self.setData({ pageState: 'error', loadError: '赛事不存在' });

          return;

        }

        if (competition.status === 'ended') {

          self.setData({ pageState: 'error', loadError: '该赛事已结束' });

          return;

        }

        self._competitionCache = competition;

        return self.continueAfterCompetitionLoaded(competition);

      })

      .catch(function (err) {

        self.setData({

          pageState: 'error',

          loadError: (err && err.message) || '加载失败，请重试'

        });

      });

  },



  continueAfterCompetitionLoaded(competition) {

    var self = this;

    if (!auth.isLoggedIn()) {

      self.setData({

        competition: competition,

        pageState: 'auth',

        authHint: '登录后即可填写报名表'

      });

      self.promptLogin();

      return;

    }

    if (!auth.isVerified()) {

      self.setData({

        competition: competition,

        pageState: 'auth',

        authHint: '完成实名认证后即可报名'

      });

      auth.promptVerify({

        from: 'event-register',

        redirect: self._registerUrl,

        content: '参赛报名需先完成实名认证，请认证后再填写报名表'

      });

      return;

    }

    return eventService.hasRegisteredCompetition(self._eventId).then(function (registered) {

      if (registered) {

        self.setData({

          pageState: 'error',

          loadError: '您已报名该赛事，可在「我的-赛事报名订单」查看'

        });

        return;

      }

      self.initForm(competition);

    });

  },



  promptLogin() {

    var self = this;

    wx.showModal({

      title: '提示',

      content: '请先登录后再报名参赛',

      confirmText: '去登录',

      cancelText: '返回',

      success: function (res) {

        if (res.confirm) {

          auth.goLogin({ from: 'event-register', redirect: self._registerUrl });

        } else {

          wx.navigateBack();

        }

      }

    });

  },



  onAuthAction() {

    if (!auth.isLoggedIn()) {

      this.promptLogin();

      return;

    }

    if (!auth.isVerified()) {

      auth.promptVerify({

        from: 'event-register',

        redirect: this._registerUrl,

        content: '参赛报名需先完成实名认证'

      });

    }

  },



  onRetryLoad() {

    if (this._eventId) {

      this.loadCompetition(this._eventId);

    }

  },



  onShow() {

    if (!this._eventId) return;

    if (

      (this.data.pageState === 'auth' || !this.data.competition) &&

      auth.isLoggedIn() &&

      auth.isVerified()

    ) {

      var competition = this._competitionCache || this.data.competition;

      if (competition) {

        this.continueAfterCompetitionLoaded(competition);

      } else {

        this.loadCompetition(this._eventId);

      }

      return;

    }

    if (this.data.pageState === 'ready' && auth.isLoggedIn() && auth.isVerified()) {

      var profile = auth.getUserProfile() || {};

      if (profile.realName && !this.data.form.realName) {

        this.setData({ 'form.realName': profile.realName });

      }

    }

  },



  initForm(competition) {

    var profile = auth.getUserProfile() || {};

    this.setData({

      competition: competition,

      pageState: 'ready',

      loadError: '',

      authHint: '',

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

      auth.goLogin({ from: 'event-register', redirect: this._registerUrl });

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



    var self = this;

    wx.showLoading({ title: '提交中' });

    eventService

      .hasRegisteredCompetition(this._eventId)

      .then(function (registered) {

        if (registered) {

          wx.hideLoading();

          wx.showToast({ title: '您已报名该赛事', icon: 'none' });

          return Promise.reject({ handled: true });

        }

        return eventService.registerCompetition(self._eventId, form);

      })

      .then(function () {

        wx.hideLoading();

        eventService.goEventOrdersAfterSuccess();

      })

      .catch(function (err) {

        if (err && err.handled) {

          return;

        }

        wx.hideLoading();

        wx.showToast({

          title: (err && err.message) || '报名失败，请重试',

          icon: 'none'

        });

      });

  }

});


