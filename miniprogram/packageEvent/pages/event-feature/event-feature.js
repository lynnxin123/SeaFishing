var auth = require('../../../utils/auth');
var eventService = require('../../../utils/eventService');
var competitionTools = require('../../../utils/competitionTools');

Page({
  data: {
    pageTitle: '赛事功能',
    pageDesc: '',
    rankingList: [],
    scoreStats: null,
    measureCount: 0,
    weightCount: 0,
    showForm: false,
    formRemark: '',
    inputValue: '',
    inputSpecies: '',
    loading: false,
    loadError: '',
    skeletonVariant: 'rank'
  },

  onLoad(options) {
    this._featureType = options.type || '';
    this._legacyId = options.competitionId || '1';
    var title = eventService.FEATURE_TITLES[this._featureType] || '赛事功能';
    var desc = eventService.FEATURE_DESC[this._featureType] || '';
    var showForm = this._featureType === 'report' || this._featureType === 'appeal';
    this.setData({
      pageTitle: title,
      pageDesc: desc,
      showForm: showForm
    });
    this.loadFeatureData();
  },

  loadFeatureData() {
    var self = this;
    var type = this._featureType;
    var legacyId = this._legacyId;
    var skeletonVariant = type === 'score' ? 'stats' : 'rank';
    this.setData({ loading: true, loadError: '', skeletonVariant: skeletonVariant });

    if (type === 'ranking') {
      competitionTools
        .fetchRanking(legacyId, { strict: true })
        .then(function (list) {
          self.setData({ rankingList: list || [], loading: false, loadError: '' });
        })
        .catch(function (err) {
          self.setData({
            loading: false,
            loadError: (err && err.message) || '加载失败，请重试'
          });
        });
      return;
    }

    if (type === 'score' || type === 'measure' || type === 'weight') {
      competitionTools
        .fetchMyScore(legacyId)
        .then(function (stats) {
          self.setData({
            scoreStats: stats,
            measureCount: stats ? stats.measureCount : 0,
            weightCount: stats ? stats.weightCount : 0,
            loading: false,
            loadError: ''
          });
        })
        .catch(function (err) {
          self.setData({
            loading: false,
            loadError: (err && err.message) || '加载失败，请重试'
          });
        });
      return;
    }

    this.setData({ loading: false, loadError: '' });
  },

  onInputValue(e) {
    this._inputValueDraft = e.detail.value;
  },

  onInputSpecies(e) {
    this._inputSpeciesDraft = e.detail.value;
  },

  onRemarkInput(e) {
    this._formRemarkDraft = e.detail.value;
  },

  syncInputDrafts() {
    var patch = {};
    if (this._inputValueDraft != null) patch.inputValue = this._inputValueDraft;
    if (this._inputSpeciesDraft != null) patch.inputSpecies = this._inputSpeciesDraft;
    if (this._formRemarkDraft != null) patch.formRemark = this._formRemarkDraft;
    if (Object.keys(patch).length) {
      this.setData(patch);
    }
  },

  onSubmitMeasure() {
    var value = Number(this._inputValueDraft != null ? this._inputValueDraft : this.data.inputValue);
    if (!value || value <= 0) {
      wx.showToast({ title: '请输入有效长度(cm)', icon: 'none' });
      return;
    }
    var self = this;
    wx.showLoading({ title: '提交中' });
    competitionTools
      .submitMeasure(this._legacyId, {
        fishLengthCm: value,
        fishSpecies: (this._inputSpeciesDraft != null ? this._inputSpeciesDraft : this.data.inputSpecies) || ''
      })
      .then(function () {
        wx.hideLoading();
        wx.showToast({ title: '测量已记录', icon: 'success' });
        self.setData({ inputValue: '', inputSpecies: '' });
        self.loadFeatureData();
      })
      .catch(function (err) {
        wx.hideLoading();
        if (err && err.code === 'NEED_LOGIN') {
          auth.goLogin({ from: 'event-feature' });
          return;
        }
        wx.showToast({ title: (err && err.message) || '提交失败', icon: 'none' });
      });
  },

  onSubmitWeight() {
    var value = Number(this._inputValueDraft != null ? this._inputValueDraft : this.data.inputValue);
    if (!value || value <= 0) {
      wx.showToast({ title: '请输入有效重量(kg)', icon: 'none' });
      return;
    }
    var self = this;
    wx.showLoading({ title: '提交中' });
    competitionTools
      .submitWeight(this._legacyId, { weightKg: value })
      .then(function () {
        wx.hideLoading();
        wx.showToast({ title: '称重已记录', icon: 'success' });
        self.setData({ inputValue: '' });
        self.loadFeatureData();
      })
      .catch(function (err) {
        wx.hideLoading();
        if (err && err.code === 'NEED_LOGIN') {
          auth.goLogin({ from: 'event-feature' });
          return;
        }
        wx.showToast({ title: (err && err.message) || '提交失败', icon: 'none' });
      });
  },

  onSubmitForm() {
    if (!auth.isLoggedIn()) {
      auth.goLogin({ from: 'event-feature' });
      return;
    }
    var remark = String(this.data.formRemark || '').trim();
    if (!remark) {
      wx.showToast({ title: '请填写说明内容', icon: 'none' });
      return;
    }
    var self = this;
    wx.showLoading({ title: '提交中' });
    competitionTools
      .submitFeedback({
        type: this._featureType,
        content: remark,
        competitionId: this._legacyId
      })
      .then(function () {
        wx.hideLoading();
        wx.showToast({
          title: self._featureType === 'report' ? '举报已提交' : '申诉已提交',
          icon: 'success'
        });
        self.setData({ formRemark: '' });
      })
      .catch(function (err) {
        wx.hideLoading();
        if (err && err.code === 'NEED_LOGIN') {
          auth.goLogin({ from: 'event-feature' });
          return;
        }
        wx.showToast({ title: (err && err.message) || '提交失败', icon: 'none' });
      });
  }
});
