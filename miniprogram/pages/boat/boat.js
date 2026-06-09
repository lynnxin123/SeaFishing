const BOAT_CYCLE_IMGS = ['/images/boat1.jpg', '/images/boat2.jpg', '/images/boat3.jpg'];
const featuredBoats = require('../../utils/featuredBoats');

Page({
  data: {
    heroBanner: '/images/boat-hero.png',
    search: {
      date: '',
      wharf: '全部码头',
      wharfIndex: 0,
      people: '',
      keyword: ''
    },
    wharfOptions: ['全部码头', '大连码头', '旅顺码头'],
    hasSearched: false,
    listTotal: 0,
    visibleShips: [],
    page: 1,
    pageSize: 10,
    remotePageSize: 20,
    listError: '',
    loadingShips: false,
    loadingMore: false,
    currentSort: 'comprehensive',
    sortOptions: [
      { label: '综合排序', value: 'comprehensive' },
      { label: '价格由高到低', value: 'priceDesc' },
      { label: '价格由低到高', value: 'priceAsc' }
    ],
    showSortPopup: false,
    showFilterPopup: false,
    currentSortText: '综合排序',
    facilityOptions: [
      { label: '卫生间', value: '卫生间' },
      { label: '棋牌室', value: '棋牌室' },
      { label: '茶水室', value: '茶水室' },
      { label: '休息室', value: '休息室' }
    ],
    lengthOptions: [
      { label: '全部', value: 'all' },
      { label: '≥5.5米', value: '5.5' },
      { label: '≥7.5米', value: '7.5' },
      { label: '≥10米', value: '10' },
      { label: '≥12米', value: '12' }
    ],
    experienceOptions: [
      { label: '全部', value: 'all' },
      { label: '≥5年', value: '5' },
      { label: '≥10年', value: '10' },
      { label: '≥15年', value: '15' },
      { label: '≥20年', value: '20' },
      { label: '≥30年', value: '30' }
    ],
    scoreOptions: [
      { label: '全部', value: 'all' },
      { label: '4.8分以上', value: '4.8' },
      { label: '4.5分以上', value: '4.5' },
      { label: '4.2分以上', value: '4.2' }
    ],
    filters: {
      facilities: [],
      length: 'all',
      experience: 'all',
      score: 'all'
    },
    filtersDraft: {
      facilities: [],
      length: 'all',
      experience: 'all',
      score: 'all'
    }
  },

  cloneFilters(filters) {
    return {
      facilities: (filters.facilities || []).slice(),
      length: filters.length || 'all',
      experience: filters.experience || 'all',
      score: filters.score || 'all'
    };
  },

  onLoad() {
    const today = this.formatDate(new Date());
    this.setData({ 'search.date': today });
  },

  onShow() {
    if (this._keepResultsOnShow) {
      this._keepResultsOnShow = false;
      return;
    }
    if (this.data.hasSearched && (this._filteredShips || []).length > 0) {
      return;
    }
    this.resetListState();
  },

  resetListState() {
    this._remotePage = 1;
    this._remoteHasMore = true;
    this._loadingMore = false;
    this._allShips = [];
    this._filteredShips = [];
    this.setData({
      hasSearched: false,
      listTotal: 0,
      visibleShips: [],
      listError: '',
      loadingShips: false,
      loadingMore: false,
      page: 1
    });
  },

  usesRemoteList() {
    const api = require('../../config/api');
    return api.USE_API;
  },

  buildRemoteQuery(page) {
    const { search, currentSort, filters, remotePageSize } = this.data;
    const params = { page: page || 1, pageSize: remotePageSize };
    if (search.wharf && search.wharf !== '全部码头') {
      params.wharf = search.wharf;
    }
    const keyword = (search.keyword || '').trim();
    if (keyword) {
      params.keyword = keyword;
    }
    if (currentSort === 'priceAsc' || currentSort === 'priceDesc') {
      params.sort = currentSort;
    }
    if (filters.score !== 'all') {
      params.minScore = Number(filters.score);
    }
    if (filters.length !== 'all') {
      params.minLength = Number(filters.length);
    }
    if (filters.experience !== 'all') {
      params.minExperience = Number(filters.experience);
    }
    if (filters.facilities && filters.facilities.length > 0) {
      params.facilities = filters.facilities.join(',');
    }
    const people = Number(search.people);
    if (search.people && !Number.isNaN(people) && people > 0) {
      params.people = people;
    }
    return params;
  },

  mergeShipPages(existing, incoming) {
    const list = (existing || []).slice();
    const ids = {};
    list.forEach((ship) => {
      if (ship && ship.boatId) ids[ship.boatId] = true;
    });
    (incoming || []).forEach((ship) => {
      if (!ship || !ship.boatId || ids[ship.boatId]) return;
      ids[ship.boatId] = true;
      list.push(ship);
    });
    return list;
  },

  loadOfflineShips() {
    const items = featuredBoats.FEATURED_BOATS.map((ship) => this.normalizeShip(ship));
    this._remoteHasMore = false;
    this.finishShipLoad(items);
  },

  loadShips() {
    this.fetchRemoteShips({ reset: true });
  },

  fetchRemoteShips(options) {
    options = options || { reset: true };
    const reset = options.reset !== false;
    const allowed =
      options.fromSearch ||
      options.fromRetry ||
      options.fromRefine ||
      this.data.hasSearched ||
      !reset;
    if (!allowed) {
      return;
    }
    const api = require('../../config/api');

    if (!api.USE_API) {
      if (!options.fromSearch && !options.fromRetry && !options.fromRefine) {
        return;
      }
      this.loadOfflineShips();
      return;
    }
    if (this._loadingMore) return;

    if (reset) {
      this._remotePage = 1;
      this._remoteHasMore = true;
    } else {
      if (!this._remoteHasMore) return;
      this._remotePage = (this._remotePage || 1) + 1;
    }

    const request = require('../../utils/request');
    const page = this._remotePage;
    const silent = !reset && page > 1;

    this._loadingMore = true;
    if (silent) {
      this.setData({ loadingMore: true });
    } else {
      this.setData({ loadingShips: true, listError: '' });
      wx.showLoading({ title: reset ? '加载船只' : '加载更多' });
    }

    request
      .get('/boats', this.buildRemoteQuery(page))
      .then((res) => {
        const batch = (res.items || []).map((ship) => this.normalizeShip(ship));
        const total = res.total != null ? res.total : batch.length;
        this._remoteHasMore = page * this.data.remotePageSize < total;

        if (reset) {
          if (!batch.length) {
            this._allShips = [];
            this._filteredShips = [];
            this._remoteTotal = 0;
            this.setData({
              listTotal: 0,
              visibleShips: [],
              hasSearched: true,
              listError: '暂无船只',
              loadingShips: false
            });
            return;
          }
          this._remoteTotal = total;
          this.finishShipLoad(batch, { remoteTotal: total });
          return;
        }

        const prevVisible = (this.data.visibleShips || []).length;
        const allShips = this.mergeShipPages(this._allShips, batch);
        this._remoteTotal = total;
        this.finishShipLoad(allShips, { append: true, prevVisible: prevVisible, remoteTotal: total });
      })
      .catch(() => {
        if (reset) {
          this._allShips = [];
          this._filteredShips = [];
          this.setData({
            listTotal: 0,
            visibleShips: [],
            hasSearched: true,
            listError: '加载失败，请重试',
            loadingShips: false
          });
          wx.showToast({ title: '加载失败，请重试', icon: 'none' });
        } else {
          this._remotePage = Math.max(1, this._remotePage - 1);
          wx.showToast({ title: '加载更多失败', icon: 'none' });
        }
      })
      .finally(() => {
        this._loadingMore = false;
        if (silent) {
          this.setData({ loadingMore: false });
        } else {
          wx.hideLoading();
          this.setData({ loadingShips: false });
        }
      });
  },

  onRetryLoad() {
    this.fetchRemoteShips({ reset: true, fromRetry: true });
  },

  normalizeShip(ship) {
    return {
      shipName: ship.shipName,
      boatId: ship.boatId,
      maxNum: ship.maxNum,
      shipLen: ship.shipLen,
      shipWid: ship.shipWid,
      score: ship.score,
      sailCount: ship.sailCount,
      experience: ship.experience,
      captain: ship.captain,
      captainAvatar: ship.captainAvatar || '/images/captain.jpg',
      price: ship.price,
      images: ship.images || [ship.coverImage || '/images/boat1.jpg'],
      wharf: ship.wharf,
      displayWharf: ship.displayWharf || ship.wharf,
      facilities: ship.facilities || [],
      contact: ship.contact || '',
      builtYear: ship.builtYear,
      description: ship.description || '本船经验丰富，适合海钓、休闲使用。'
    };
  },

  finishShipLoad(allShips, options) {
    options = options || {};
    this._appendAfterFilter = options.append ? (options.prevVisible || 0) : 0;
    this._allShips = allShips || [];

    if (this.usesRemoteList()) {
      const search = this.data.search || {};
      const decorated = this._allShips.map((ship) => this.decorateShip(ship, search));
      this._filteredShips = this.withCycledBoatImages(decorated);
      const listTotal =
        options.remoteTotal != null ? options.remoteTotal : this._filteredShips.length;
      this.setData(
        {
          hasSearched: true,
          listError: '',
          listTotal: listTotal,
          page: 1
        },
        () => {
          this.updateVisibleShips();
        }
      );
      return;
    }

    this.setData(
      {
        hasSearched: true,
        listError: ''
      },
      () => {
        this.applyFilters();
      }
    );
  },

  formatDate(date) {
    const year = date.getFullYear();
    const month = ('0' + (date.getMonth() + 1)).slice(-2);
    const day = ('0' + date.getDate()).slice(-2);
    return `${year}-${month}-${day}`;
  },

  onDateChange(e) {
    this.setData({ 'search.date': e.detail.value });
  },

  onWharfChange(e) {
    const index = e.detail.value;
    this.setData({
      'search.wharfIndex': index,
      'search.wharf': this.data.wharfOptions[index]
    });
  },

  onPeopleInput(e) {
    this._peopleDraft = e.detail.value;
  },

  onPeopleBlur() {
    if (this._peopleDraft == null) return;
    this.setData({ 'search.people': this._peopleDraft });
  },

  onKeywordInput(e) {
    this._keywordDraft = e.detail.value;
  },

  onKeywordBlur() {
    if (this._keywordDraft == null) return;
    this.setData({ 'search.keyword': this._keywordDraft });
  },

  onSearch() {
    const keyword =
      this._keywordDraft != null ? this._keywordDraft : (this.data.search.keyword || '');
    this.data.search.keyword = keyword;
    this.setData({ 'search.keyword': keyword });
    const search = this.data.search || {};
    if (!search.date) {
      wx.showToast({ title: '请选择预约日期', icon: 'none' });
      return;
    }
    this.fetchRemoteShips({ reset: true, fromSearch: true });
  },

  toggleSortPopup() {
    this.setData({ showSortPopup: !this.data.showSortPopup, showFilterPopup: false });
  },

  toggleFilterPopup() {
    if (this.data.showFilterPopup) {
      this.onFilterCancel();
      return;
    }
    this.setData({
      showFilterPopup: true,
      showSortPopup: false,
      filtersDraft: this.cloneFilters(this.data.filters)
    });
  },

  onFilterCancel() {
    this.setData({ showFilterPopup: false });
  },

  stopPopupTap() {},

  onSortSelect(e) {
    const value = e.currentTarget.dataset.value;
    const option = this.data.sortOptions.find(item => item.value === value);
    this.setData({
      currentSort: value,
      currentSortText: option ? option.label : '综合排序',
      showSortPopup: false
    }, () => {
      if (!this.data.hasSearched) return;
      this.fetchRemoteShips({ reset: true, fromRefine: true });
    });
  },

  onFilterFacilityToggle(e) {
    const value = e.currentTarget.dataset.value;
    const draft = this.cloneFilters(this.data.filtersDraft);
    let facilities = draft.facilities;
    if (value === 'all') {
      facilities = [];
    } else {
      const idx = facilities.indexOf(value);
      if (idx !== -1) {
        facilities = facilities.filter(function (item) {
          return item !== value;
        });
      } else {
        facilities = facilities.concat([value]);
      }
    }
    draft.facilities = facilities;
    this.setData({ filtersDraft: draft });
  },

  onFilterLengthSelect(e) {
    const value = e.currentTarget.dataset.value;
    const draft = this.cloneFilters(this.data.filtersDraft);
    draft.length = value;
    this.setData({ filtersDraft: draft });
  },

  onFilterExperienceSelect(e) {
    const value = e.currentTarget.dataset.value;
    const draft = this.cloneFilters(this.data.filtersDraft);
    draft.experience = value;
    this.setData({ filtersDraft: draft });
  },

  onFilterScoreSelect(e) {
    const value = e.currentTarget.dataset.value;
    const draft = this.cloneFilters(this.data.filtersDraft);
    draft.score = value;
    this.setData({ filtersDraft: draft });
  },

  onFilterReset() {
    this.setData({
      filtersDraft: {
        facilities: [],
        length: 'all',
        experience: 'all',
        score: 'all'
      }
    });
  },

  withCycledBoatImages(ships) {
    return ships.map((ship, index) => {
      if (ship.images && ship.images.length) {
        return ship;
      }
      return Object.assign({}, ship, {
        images: [BOAT_CYCLE_IMGS[index % BOAT_CYCLE_IMGS.length]]
      });
    });
  },

  decorateShip(ship, search) {
    const displayWharf = search.wharf !== '全部码头' ? search.wharf : ship.wharf;
    return Object.assign({}, ship, {
      displayWharf: displayWharf,
      scoreDisplay: Number(ship.score).toFixed(1),
      price: Number(ship.price),
      sailingYears: ship.experience != null ? String(ship.experience) : ''
    });
  },

  onFilterConfirm() {
    this.setData({
      filters: this.cloneFilters(this.data.filtersDraft),
      showFilterPopup: false
    }, () => {
      if (!this.data.hasSearched) return;
      this.fetchRemoteShips({ reset: true, fromRefine: true });
    });
  },

  applyFilters() {
    if (this.usesRemoteList() && this.data.hasSearched) {
      return;
    }

    const allShips = this._allShips || [];
    const { search, filters } = this.data;
    const keyword = (search.keyword || '').trim().toLowerCase();
    const people = Number(search.people);

    const filtered = allShips
      .filter(ship => {
        if (search.wharf !== '全部码头' && ship.wharf !== search.wharf) return false;
        if (search.people && !Number.isNaN(people) && people > ship.maxNum) return false;
        if (keyword) {
          const name = (ship.shipName || '').toLowerCase();
          const captain = (ship.captain || '').toLowerCase();
          const boatId = String(ship.boatId || '');
          const matched =
            name.indexOf(keyword) !== -1 ||
            captain.indexOf(keyword) !== -1 ||
            boatId.indexOf(keyword) !== -1;
          if (!matched) return false;
        }
        if (filters.length !== 'all') {
          const minLen = Number(filters.length);
          if (!ship.shipLen || Number(ship.shipLen) < minLen) return false;
        }
        if (filters.experience !== 'all') {
          const expNeed = Number(filters.experience);
          const captainYears = Number(ship.experience);
          if (Number.isNaN(captainYears) || captainYears < expNeed) return false;
        }
        if (filters.score !== 'all') {
          const scoreNeed = Number(filters.score);
          if (Number(ship.score) < scoreNeed) return false;
        }
        return true;
      })
      .map(ship => this.decorateShip(ship, search));

    this._filteredShips = filtered;
    this.setData({ listTotal: filtered.length, page: 1 }, () => {
      this.applySort();
    });
  },

  applySort() {
    if (this.usesRemoteList() && this.data.hasSearched) {
      return;
    }

    const { currentSort } = this.data;
    const sorted = (this._filteredShips || []).slice();

    if (currentSort === 'priceAsc') {
      sorted.sort((a, b) => Number(a.price) - Number(b.price));
    } else if (currentSort === 'priceDesc') {
      sorted.sort((a, b) => Number(b.price) - Number(a.price));
    } else {
      sorted.sort((a, b) => {
        const scoreDiff = Number(b.score) - Number(a.score);
        if (scoreDiff !== 0) return scoreDiff;
        return Number(a.price) - Number(b.price);
      });
    }

    const self = this;
    this._filteredShips = this.withCycledBoatImages(sorted);
    this.setData({ listTotal: this._filteredShips.length, page: 1 }, () => {
      if (self._appendAfterFilter) {
        const { pageSize } = self.data;
        const needPage = Math.ceil(self._appendAfterFilter / pageSize) + 1;
        const maxPage = Math.max(1, Math.ceil(self._filteredShips.length / pageSize));
        self._appendAfterFilter = 0;
        self.setData({ page: Math.min(needPage, maxPage) }, () => {
          self.updateVisibleShips();
        });
        return;
      }
      self.updateVisibleShips();
    });
  },

  updateVisibleShips() {
    const filteredShips = this._filteredShips || [];
    const { page, pageSize } = this.data;
    const end = Math.min(filteredShips.length, page * pageSize);
    const visible = filteredShips.slice(0, end);
    const listTotal = this.usesRemoteList()
      ? (this._remoteTotal != null ? this._remoteTotal : filteredShips.length)
      : filteredShips.length;
    this.setData({ visibleShips: visible, listTotal: listTotal });
  },

  onReachBottom() {
    const { visibleShips, page, pageSize } = this.data;
    const filteredShips = this._filteredShips || [];
    if (visibleShips.length < filteredShips.length) {
      this.setData({ page: page + 1 }, () => {
        this.updateVisibleShips();
      });
      return;
    }
    const api = require('../../config/api');
    if (api.USE_API && this._remoteHasMore) {
      this.fetchRemoteShips({ reset: false });
      return;
    }
    wx.showToast({ title: '没有更多了', icon: 'none' });
  },

  onShipTap(e) {
    const index = e.currentTarget.dataset.index;
    const ship = this.data.visibleShips[index];
    if (!ship) return;
    this._keepResultsOnShow = true;
    const bookingOrders = require('../../utils/bookingOrders');
    const search = this.data.search || {};
    bookingOrders.saveBookingContext({
      date: search.date,
      wharf: search.wharf,
      people: search.people,
      keyword: search.keyword
    });
    wx.navigateTo({
      url: '/packageBoat/pages/ship-detail/ship-detail',
      success(res) {
        res.eventChannel.emit('acceptShipData', { ship });
      }
    });
  }
});
