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
    speciesOptions: [],
    speciesIndex: 0,
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
      showForm: showForm,
      speciesOptions: competitionTools.FISH_SPECIES_OPTIONS || [],
      speciesIndex: 0,
      inputSpecies: ''
    });
    this.loadFeatureData();
  },

  featureRedirectUrl() {
    return (
      '/packageEvent/pages/event-feature/event-feature?type=' +
      encodeURIComponent(this._featureType || '') +
      '&competitionId=' +
      encodeURIComponent(this._legacyId || '1')
    );
  },

  goLoginForFeature() {
    auth.goLogin({
      from: 'event-feature',
      redirect: this.featureRedirectUrl()
    });
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

  onSpeciesChange(e) {
    var idx = Number(e.detail.value);
    var options = this.data.speciesOptions || [];
    var species = options[idx] || '';
    if (species === '不指定') {
      species = '';
    }
    this._inputSpeciesDraft = species;
    this.setData({ speciesIndex: idx, inputSpecies: species });
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
        self.setData({ inputValue: '', inputSpecies: '', speciesIndex: 0 });
        self._inputSpeciesDraft = '';
        self.loadFeatureData();
      })
      .catch(function (err) {
        wx.hideLoading();
        if (err && err.code === 'NEED_LOGIN') {
          self.goLoginForFeature();
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
          self.goLoginForFeature();
          return;
        }
        wx.showToast({ title: (err && err.message) || '提交失败', icon: 'none' });
      });
  },

  onSubmitForm() {
    if (!auth.isLoggedIn()) {
      this.goLoginForFeature();
      return;
    }
    this.syncInputDrafts();
    var remark = String(
      this._formRemarkDraft != null ? this._formRemarkDraft : this.data.formRemark || ''
    ).trim();
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
          self.goLoginForFeature();
          return;
        }
        wx.showToast({ title: (err && err.message) || '提交失败', icon: 'none' });
      });
  }
});
