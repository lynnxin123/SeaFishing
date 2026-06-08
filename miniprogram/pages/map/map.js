// 海钓地图页 - 微信开发者工具需此 map.js 文件
var fishingSpots = require('../../utils/fishingSpots');
var mapFavorites = require('../../utils/mapFavorites');
var bookingNavigate = require('../../utils/bookingNavigate');
var tencentMap = require('../../config/tencentMap');

var FISHING_SPOTS = fishingSpots.FISHING_SPOTS;
var FISH_FILTER_OPTIONS = fishingSpots.FISH_FILTER_OPTIONS;
var MARKER_ICONS = fishingSpots.MARKER_ICONS;
var DALIAN_CENTER = fishingSpots.DALIAN_CENTER;
var resolveShips = fishingSpots.resolveShips;

function pad(n) {
  return String(n).padStart(2, '0');
}

function formatToday() {
  var d = new Date();
  return pad(d.getMonth() + 1) + '/' + pad(d.getDate());
}

function getWeekday() {
  return ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'][new Date().getDay()];
}

function calcDistanceKm(lat1, lng1, lat2, lng2) {
  var toRad = function (v) {
    return (v * Math.PI) / 180;
  };
  var R = 6371;
  var dLat = toRad(lat2 - lat1);
  var dLng = toRad(lng2 - lng1);
  var a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function typeLabel(type) {
  if (type === 'shore') return '岸钓点';
  if (type === 'pier') return '船钓码头';
  if (type === 'deep') return '深海钓场';
  return '钓点';
}

Page({
  data: {
    heroBanner: '/images/boat-hero.png',
    mapSubkey: tencentMap.MAP_SUBKEY || '',
    mapSetting: {
      enableZoom: true,
      enableScroll: true,
      showLocation: true
    },
    centerLat: DALIAN_CENTER.latitude,
    centerLng: DALIAN_CENTER.longitude,
    scale: 10,
    markers: [],
    userLat: 0,
    userLng: 0,
    hasLocation: false,
    weather: {
      date: formatToday(),
      week: getWeekday(),
      temp: '22°C',
      desc: '多云',
      wind: '西北风 7级',
      windLevel: 7,
      sea: '大浪',
      icon: '⛅'
    },
    tide: [
      { label: '涨潮', time: '06:18', height: '2.1m' },
      { label: '落潮', time: '12:42', height: '0.5m' }
    ],
    windBlocked: true,
    fishOptionList: FISH_FILTER_OPTIONS.map(function (name) {
      return { name: name, active: false };
    }),
    selectedFish: [],
    seaRange: 'all',
    freeOnly: false,
    favoritesOnly: false,
    showFilterPanel: false,
    filteredSpots: [],
    sortedSpotList: [],
    selectedSpot: null,
    showSpotPanel: false
  },

  onLoad: function (options) {
    options = options || {};
    var favoritesOnly = options.mode === 'favorites';
    this.setData({ favoritesOnly: favoritesOnly });
    this.refreshWeatherBlock();
    var self = this;
    this.locateUser(function () {
      self.applyFilters();
    });
  },

  onShow: function () {
    var openMode = wx.getStorageSync('mapOpenMode');
    if (openMode === 'favorites') {
      wx.removeStorageSync('mapOpenMode');
      this.setData({ favoritesOnly: true });
    }
    if (this.data.selectedSpot) {
      this.setData({
        'selectedSpot.favorited': mapFavorites.isFavorite(this.data.selectedSpot.id)
      });
    }
    this.applyFilters();
  },

  refreshWeatherBlock: function () {
    var windLevel = this.data.weather.windLevel;
    this.setData({ windBlocked: windLevel >= 6 });
  },

  locateUser: function (done) {
    var self = this;
    wx.getLocation({
      type: 'gcj02',
      success: function (res) {
        self.setData({
          userLat: res.latitude,
          userLng: res.longitude,
          hasLocation: true,
          centerLat: res.latitude,
          centerLng: res.longitude,
          scale: 11
        });
        if (done) done();
      },
      fail: function () {
        wx.showToast({ title: '未获取定位，已显示大连海域', icon: 'none' });
        self.setData({
          hasLocation: false,
          centerLat: DALIAN_CENTER.latitude,
          centerLng: DALIAN_CENTER.longitude
        });
        if (done) done();
      }
    });
  },

  applyFilters: function () {
    var selectedFish = this.data.selectedFish;
    var seaRange = this.data.seaRange;
    var freeOnly = this.data.freeOnly;
    var favoritesOnly = this.data.favoritesOnly;
    var windBlocked = this.data.windBlocked;
    var userLat = this.data.userLat;
    var userLng = this.data.userLng;
    var hasLocation = this.data.hasLocation;
    var favIds = mapFavorites.getFavoriteIds();

    var list = FISHING_SPOTS.map(function (spot) {
      var copy = Object.assign({}, spot);
      copy.typeLabel = typeLabel(spot.type);
      copy.favorited = favIds.indexOf(spot.id) >= 0;
      copy.resolvedShips = resolveShips(spot.ships);
      var blocked = windBlocked && spot.windSensitive && spot.type !== 'shore';
      copy.bookable = !blocked;
      if (hasLocation) {
        var km = calcDistanceKm(userLat, userLng, spot.latitude, spot.longitude);
        copy.distanceKm = km;
        copy.distanceText = km < 1 ? Math.round(km * 1000) + 'm' : km.toFixed(1) + 'km';
      } else {
        copy.distanceText = '--';
      }
      return copy;
    });

    if (favoritesOnly) {
      list = list.filter(function (s) {
        return favIds.indexOf(s.id) >= 0;
      });
    }
    if (seaRange !== 'all') {
      list = list.filter(function (s) {
        return s.seaRange === seaRange;
      });
    }
    if (freeOnly) {
      list = list.filter(function (s) {
        return s.chargeType === 'free';
      });
    }
    if (selectedFish.length > 0) {
      list = list.filter(function (s) {
        return selectedFish.some(function (f) {
          return s.fishSpecies.indexOf(f) >= 0;
        });
      });
    }

    list.sort(function (a, b) {
      return (a.distanceKm || 9999) - (b.distanceKm || 9999);
    });

    var markers = list.map(function (spot, index) {
      var iconKey = spot.eventId ? 'event' : spot.type;
      var marker = {
        id: index + 1,
        spotId: spot.id,
        latitude: spot.latitude,
        longitude: spot.longitude,
        iconPath: MARKER_ICONS[iconKey] || MARKER_ICONS.pier,
        width: spot.eventId ? 40 : 34,
        height: spot.eventId ? 50 : 42
      };
      if (windBlocked && spot.windSensitive && spot.type !== 'shore') {
        marker.alpha = 0.45;
      }
      return marker;
    });

    this.setData({
      filteredSpots: list,
      sortedSpotList: list,
      markers: markers
    });
  },

  onToggleFilterPanel: function () {
    this.setData({ showFilterPanel: !this.data.showFilterPanel });
  },

  onFishFilterTap: function (e) {
    var fish = e.currentTarget.dataset.fish;
    var selected = this.data.selectedFish.slice();
    var idx = selected.indexOf(fish);
    if (idx >= 0) selected.splice(idx, 1);
    else selected.push(fish);
    var fishOptionList = this.data.fishOptionList.map(function (item) {
      return { name: item.name, active: selected.indexOf(item.name) >= 0 };
    });
    var self = this;
    this.setData({ selectedFish: selected, fishOptionList: fishOptionList }, function () {
      self.applyFilters();
    });
  },

  onSeaRangeChange: function (e) {
    var self = this;
    this.setData({ seaRange: e.currentTarget.dataset.range }, function () {
      self.applyFilters();
    });
  },

  onFreeOnlyToggle: function () {
    var self = this;
    this.setData({ freeOnly: !this.data.freeOnly }, function () {
      self.applyFilters();
    });
  },

  onResetFilter: function () {
    var fishOptionList = FISH_FILTER_OPTIONS.map(function (name) {
      return { name: name, active: false };
    });
    var self = this;
    this.setData(
      {
        selectedFish: [],
        fishOptionList: fishOptionList,
        seaRange: 'all',
        freeOnly: false,
        favoritesOnly: false
      },
      function () {
        self.applyFilters();
      }
    );
  },

  onMarkerTap: function (e) {
    var markerId = e.detail.markerId;
    var marker = this.data.markers.find(function (m) {
      return m.id === markerId;
    });
    if (!marker) return;
    this.openSpotById(marker.spotId);
  },

  onListSpotTap: function (e) {
    this.openSpotById(e.currentTarget.dataset.id);
  },

  openSpotById: function (spotId) {
    var spot = this.data.filteredSpots.find(function (s) {
      return s.id === spotId;
    });
    if (!spot) return;
    this.setData({
      selectedSpot: spot,
      showSpotPanel: true,
      centerLat: spot.latitude,
      centerLng: spot.longitude,
      scale: 12
    });
  },

  onCloseSpotPanel: function () {
    this.setData({ showSpotPanel: false, selectedSpot: null });
  },

  onToggleFavorite: function () {
    var spot = this.data.selectedSpot;
    if (!spot) return;
    var favorited = mapFavorites.toggleFavorite(spot.id);
    this.setData({ 'selectedSpot.favorited': favorited });
    wx.showToast({ title: favorited ? '已收藏' : '已取消收藏', icon: 'none' });
    this.applyFilters();
  },

  onNavigateSpot: function () {
    var spot = this.data.selectedSpot;
    if (!spot) return;
    wx.openLocation({
      latitude: spot.latitude,
      longitude: spot.longitude,
      name: spot.name,
      address: spot.typeLabel + ' · ' + spot.priceNote,
      scale: 16
    });
  },

  onRelocate: function () {
    var self = this;
    this.locateUser(function () {
      self.applyFilters();
      wx.showToast({ title: '已定位到当前位置', icon: 'none' });
    });
  },

  onBookShipTap: function (e) {
    var spot = this.data.selectedSpot;
    if (!spot || !spot.bookable) {
      wx.showToast({ title: '当前大风天气，该钓点暂不可预约', icon: 'none' });
      return;
    }
    var shipKey = e.currentTarget.dataset.shipKey;
    var ship = fishingSpots.getShipByKey(shipKey);
    if (!ship) return;
    bookingNavigate.goBookShip(ship, {
      wharf: spot.name,
      keyword: ship.shipName
    });
  },

  onGoEvent: function () {
    var spot = this.data.selectedSpot;
    if (!spot || !spot.eventId) return;
    bookingNavigate.goEventPage(spot.eventId);
  },

  stopTap: function () {}
});
