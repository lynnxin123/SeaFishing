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
    allShips: [],
    filteredShips: [],
    visibleShips: [],
    page: 1,
    pageSize: 10,
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
    // 生成模拟数据：50条，随机分配船与船长图片
    const captainImgs = ['/images/captain1.jpg', '/images/captain2.jpg', '/images/captain3.jpg'];
    const boatImgs = ['/images/boat1.jpg', '/images/boat2.jpg', '/images/boat3.jpg', '/images/boat4.jpg'];
    const wharfs = ['全部码头', '大连码头', '旅顺码头'];
    const facilitiesPool = [['卫生间'], ['棋牌室'], ['茶水室'], ['休息室'], ['卫生间','休息室']];
    const allShipsGen = [];
    for (let i = 1; i <= 50; i++) {
      const boatImg = boatImgs[Math.floor(Math.random() * boatImgs.length)];
      const captainImg = captainImgs[Math.floor(Math.random() * captainImgs.length)];
      const shipLen = Math.random() > 0.2 ? (5 + Math.random() * 8).toFixed(2) : null;
      const shipWid = shipLen ? (1.8 + Math.random() * 1.2).toFixed(2) : null;
      const score = +(4 + Math.random()).toFixed(1);
      const sailCount = Math.floor(Math.random() * 10);
      const maxNum = Math.floor(2 + Math.random() * 12);
      const price = +(10 + Math.random() * 990).toFixed(2);
      const idx = i;
      allShipsGen.push({
        shipName: `辽长渔休${10000 + idx}`,
        boatId: String(10000 + idx),
        maxNum,
        shipLen: shipLen ? Number(shipLen) : null,
        shipWid: shipWid ? Number(shipWid) : null,
        score,
        sailCount,
        captain: ['王雪徕','郭巍','李海涛','周海滨','阿峰','婷婷','大海'][Math.floor(Math.random()*7)],
        captainAvatar: captainImg,
        price,
        images: [boatImg],
        wharf: wharfs[Math.floor(Math.random() * wharfs.length)],
        facilities: facilitiesPool[Math.floor(Math.random() * facilitiesPool.length)],
        experience: [2, 3, 5, 8, 10, 12, 15, 20, 25, 30][Math.floor(Math.random() * 10)],
        contact: '138' + (10000000 + Math.floor(Math.random()*90000000)),
        builtYear: 2000 + Math.floor(Math.random()*26),
        description: '本船经验丰富，适合海钓、休闲使用。'
      });
    }
    this.setData({
      'search.date': today,
      allShips: allShipsGen,
      filteredShips: allShipsGen
    });
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
    this.setData({ 'search.people': e.detail.value });
  },

  onKeywordInput(e) {
    this.setData({ 'search.keyword': e.detail.value });
  },

  onSearch() {
    this.setData({ hasSearched: true, page: 1 }, () => {
      this.applyFilters();
    });
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
      if (!this.data.hasSearched) {
        wx.showToast({ title: '请先搜索', icon: 'none' });
        return;
      }
      this.applySort();
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
    if (!this.data.hasSearched) {
      wx.showToast({ title: '请先搜索', icon: 'none' });
      return;
    }
    this.setData({
      filters: this.cloneFilters(this.data.filtersDraft),
      showFilterPopup: false
    }, () => {
      this.applyFilters();
    });
  },

  applyFilters() {
    const { allShips, search, filters } = this.data;
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
        if (filters.facilities.length > 0) {
          const facilities = ship.facilities || [];
          const hasAll = filters.facilities.every(value => facilities.indexOf(value) !== -1);
          if (!hasAll) return false;
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

    this.setData({ filteredShips: filtered, page: 1 }, () => {
      this.applySort();
    });
  },

  applySort() {
    const { currentSort, filteredShips } = this.data;
    const sorted = filteredShips.slice();

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

    this.setData({ filteredShips: sorted, page: 1 }, () => {
      this.updateVisibleShips();
    });
  },

  updateVisibleShips() {
    const { filteredShips, page, pageSize } = this.data;
    const end = Math.min(filteredShips.length, page * pageSize);
    const visible = filteredShips.slice(0, end);
    this.setData({ visibleShips: visible });
  },

  onReachBottom() {
    // Called when user scrolls to bottom: 加载更多
    const { visibleShips, filteredShips, page, pageSize } = this.data;
    if (visibleShips.length >= filteredShips.length) {
      wx.showToast({ title: '没有更多了', icon: 'none' });
      return;
    }
    const nextPage = page + 1;
    this.setData({ page: nextPage }, () => {
      this.updateVisibleShips();
    });
  },

  onShipTap(e) {
    const index = e.currentTarget.dataset.index;
    const ship = this.data.visibleShips[index];
    if (!ship) return;
    const bookingOrders = require('../../utils/bookingOrders');
    const search = this.data.search || {};
    bookingOrders.saveBookingContext({
      date: search.date,
      wharf: search.wharf,
      people: search.people,
      keyword: search.keyword
    });
    wx.navigateTo({
      url: '/pages/ship-detail/ship-detail',
      success(res) {
        res.eventChannel.emit('acceptShipData', { ship });
      }
    });
  }
});
