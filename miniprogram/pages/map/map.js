// 海钓地图页 - 微信开发者工具需此 map.js 文件
var fishingSpots = require('../../utils/fishingSpots');
var mapFavorites = require('../../utils/mapFavorites');
var auth = require('../../utils/auth');
var bookingNavigate = require('../../utils/bookingNavigate');
var tencentMap = require('../../config/tencentMap');
var marineConditions = require('../../utils/marineConditions');

var FISH_FILTER_OPTIONS = fishingSpots.FISH_FILTER_OPTIONS;
var MARKER_ICONS = fishingSpots.MARKER_ICONS;
var DALIAN_CENTER = fishingSpots.DALIAN_CENTER;
var resolveShips = fishingSpots.resolveShips;

function getTodayYmd() {
  return marineConditions.formatDateYmd(new Date());
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

/** 微信 map marker.id 须为稳定数字，与筛选顺序无关 */
var _markerIdBySpotId = {};
function stableMarkerId(spotId) {
  if (_markerIdBySpotId[spotId]) {
    return _markerIdBySpotId[spotId];
  }
  var s = String(spotId);
  var hash = 0;
  for (var i = 0; i < s.length; i++) {
    hash = ((hash << 5) - hash + s.charCodeAt(i)) | 0;
  }
  var id = (Math.abs(hash) % 900000000) + 1;
  _markerIdBySpotId[spotId] = id;
  return id;
}

var initialMarineBlock = marineConditions.getConditionsForDate(getTodayYmd());

Page({
  data: {
    heroBanner: '/images/boat-hero.png',
    mapSubkey: tencentMap.MAP_SUBKEY || '',
    mapSetting: {
      enableZoom: true,
      enableScroll: true,
      showLocation: false
    },
    centerLat: DALIAN_CENTER.latitude,
    centerLng: DALIAN_CENTER.longitude,
    scale: 10,
    markers: [],
    userLat: 0,
    userLng: 0,
    hasLocation: false,
    weather: initialMarineBlock.weather,
    tide: initialMarineBlock.tide,
    windBlocked: initialMarineBlock.windBlocked,
    fishOptionList: FISH_FILTER_OPTIONS.map(function (name) {
      return { name: name, active: false };
    }),
    selectedFish: [],
    seaRange: 'all',
    freeOnly: false,
    favoritesOnly: false,
    showFilterPanel: false,
    spotList: [],
    selectedSpot: null,
    showSpotPanel: false
  },

  invalidateSpotBase: function () {
    this._spotBaseList = null;
    mapFavorites.invalidateFavoriteSet();
  },

  buildSpotBaseList: function () {
    if (this._spotBaseList) {
      return this._spotBaseList;
    }
    var favSet = mapFavorites.getFavoriteSet();
    this._spotBaseList = fishingSpots.getSpots().map(function (spot) {
      return {
        id: spot.id,
        name: spot.name,
        type: spot.type,
        typeLabel: typeLabel(spot.type),
        latitude: spot.latitude,
        longitude: spot.longitude,
        depth: spot.depth,
        fishSpecies: spot.fishSpecies || [],
        bestMonths: spot.bestMonths,
        chargeType: spot.chargeType,
        priceNote: spot.priceNote,
        seaRange: spot.seaRange,
        windSensitive: spot.windSensitive,
        eventId: spot.eventId,
        eventTitle: spot.eventTitle,
        ships: spot.ships || [],
        favorited: favSet.has(spot.id)
      };
    });
    return this._spotBaseList;
  },

  onLoad: function (options) {
    options = options || {};
    var favoritesOnly = options.mode === 'favorites';
    this._pendingOpenSpotId = wx.getStorageSync('mapOpenSpotId') || '';
    if (this._pendingOpenSpotId) {
      wx.removeStorageSync('mapOpenSpotId');
    }
    this._lastWindBlocked = initialMarineBlock.windBlocked;
    this._lastWeatherDate = getTodayYmd();
    this.setData({ favoritesOnly: favoritesOnly, spotList: [], markers: [] });
    var self = this;
    var spotsReady = fishingSpots.fetchSpots().then(function () {
      self.invalidateSpotBase();
    });
    var locationReady = new Promise(function (resolve) {
      self.locateUser(resolve);
    });
    Promise.all([spotsReady, locationReady]).then(function () {
      if (auth.isLoggedIn()) {
        return mapFavorites.syncFromServerIfStale(60000);
      }
      return null;
    }).then(function () {
      self.applyFilters();
      if (self._pendingOpenSpotId) {
        self.openSpotById(self._pendingOpenSpotId);
        self._pendingOpenSpotId = '';
      }
    });
  },

  onShow: function () {
    var pageRefresh = require('../../utils/pageRefresh');
    this.refreshWeatherBlock();

    var openMode = wx.getStorageSync('mapOpenMode');
    var openFavoritesMode = openMode === 'favorites';
    if (openFavoritesMode) {
      wx.removeStorageSync('mapOpenMode');
      this.setData({ favoritesOnly: true });
    }

    var self = this;
    var refreshLight = function () {
      if (self.data.selectedSpot) {
        self.setData({
          'selectedSpot.favorited': mapFavorites.isFavorite(self.data.selectedSpot.id)
        });
      }
    };

    var refreshFull = function () {
      refreshLight();
      self.invalidateSpotBase();
      self.applyFilters();
    };

    var afterShow = function (fullRefresh) {
      if (fullRefresh || openFavoritesMode) {
        refreshFull();
      } else {
        refreshLight();
      }
      if (auth.isLoggedIn()) {
        self.processPendingFavorite();
      }
    };

    if (auth.isLoggedIn() && pageRefresh.shouldRefresh('map-favorites-sync', 30000)) {
      var prevKey = mapFavorites.getFavoriteIds().join(',');
      mapFavorites.syncFromServerIfStale(30000).then(function () {
        pageRefresh.markRefreshed('map-favorites-sync');
        var newKey = mapFavorites.getFavoriteIds().join(',');
        afterShow(newKey !== prevKey || openFavoritesMode);
      });
      return;
    }

    afterShow(openFavoritesMode);
  },

  processPendingFavorite: function () {
    if (!auth.isLoggedIn()) return;
    var spotId = mapFavorites.consumePendingFavorite();
    if (!spotId) return;

    var self = this;
    mapFavorites.toggleFavorite(spotId).then(function (favorited) {
      try {
        require('../../utils/pageRefresh').resetRefresh('map-favorites');
      } catch (e) {}
      if (favorited) {
        wx.showToast({ title: '已收藏', icon: 'none' });
      }
      self.invalidateSpotBase();
      self.openSpotById(spotId);
      self.applyFilters();
    }).catch(function () {
      wx.showToast({ title: '收藏失败，请重试', icon: 'none' });
    });
  },

  refreshWeatherBlock: function () {
    var today = getTodayYmd();
    var block = marineConditions.getConditionsForDate(today);
    var windChanged = this._lastWindBlocked !== block.windBlocked;
    var dateChanged = this._lastWeatherDate !== today;

    if (!dateChanged && !windChanged && this._lastWeatherDate) {
      return;
    }

    this._lastWindBlocked = block.windBlocked;
    this._lastWeatherDate = today;

    var patch = {
      weather: block.weather,
      tide: block.tide,
      windBlocked: block.windBlocked
    };
    var self = this;
    this.setData(patch, function () {
      if (windChanged) {
        self.applyFilters();
      }
    });
  },

  locateUser: function (done) {
    if (this._locating) {
      if (done) done();
      return;
    }
    this._locating = true;
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
        self._locating = false;
        if (done) done();
      },
      fail: function () {
        self._locating = false;
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
    var self = this;
    if (self._applyFiltersTimer) {
      clearTimeout(self._applyFiltersTimer);
    }
    self._applyFiltersTimer = setTimeout(function () {
      self._applyFiltersTimer = null;
      self._runApplyFilters();
    }, 120);
  },

  _runApplyFilters: function () {
    var selectedFish = this.data.selectedFish;
    var seaRange = this.data.seaRange;
    var freeOnly = this.data.freeOnly;
    var favoritesOnly = this.data.favoritesOnly;
    var windBlocked = this.data.windBlocked;
    var userLat = this.data.userLat;
    var userLng = this.data.userLng;
    var hasLocation = this.data.hasLocation;
    var favSet = mapFavorites.getFavoriteSet();
    var baseList = this.buildSpotBaseList();
    var filtered = [];
    var spotIndex = {};

    for (var i = 0; i < baseList.length; i++) {
      var spot = baseList[i];
      if (favoritesOnly && !favSet.has(spot.id)) continue;
      if (seaRange !== 'all' && spot.seaRange !== seaRange) continue;
      if (freeOnly && spot.chargeType !== 'free') continue;
      if (selectedFish.length > 0) {
        var fishMatch = false;
        for (var j = 0; j < selectedFish.length; j++) {
          if (spot.fishSpecies.indexOf(selectedFish[j]) >= 0) {
            fishMatch = true;
            break;
          }
        }
        if (!fishMatch) continue;
      }

      var blocked = windBlocked && spot.windSensitive && spot.type !== 'shore';
      var distanceKm;
      var distanceText;
      if (hasLocation) {
        distanceKm = calcDistanceKm(userLat, userLng, spot.latitude, spot.longitude);
        distanceText = distanceKm < 1 ? Math.round(distanceKm * 1000) + 'm' : distanceKm.toFixed(1) + 'km';
      } else {
        distanceText = '--';
      }

      var fullSpot = Object.assign({}, spot, {
        bookable: !blocked,
        distanceKm: distanceKm,
        distanceText: distanceText,
        favorited: favSet.has(spot.id)
      });
      spotIndex[spot.id] = fullSpot;

      filtered.push({
        id: spot.id,
        name: spot.name,
        type: spot.type,
        typeLabel: spot.typeLabel,
        priceNote: spot.priceNote,
        eventId: spot.eventId,
        bookable: !blocked,
        distanceKm: distanceKm,
        distanceText: distanceText
      });
    }

    filtered.sort(function (a, b) {
      return (a.distanceKm || 9999) - (b.distanceKm || 9999);
    });

    var markers = [];
    for (var k = 0; k < filtered.length; k++) {
      var row = filtered[k];
      var iconKey = row.eventId ? 'event' : row.type;
      var marker = {
        id: stableMarkerId(row.id),
        spotId: row.id,
        latitude: spotIndex[row.id].latitude,
        longitude: spotIndex[row.id].longitude,
        iconPath: MARKER_ICONS[iconKey] || MARKER_ICONS.pier,
        width: row.eventId ? 40 : 34,
        height: row.eventId ? 50 : 42
      };
      if (windBlocked && spotIndex[row.id].windSensitive && row.type !== 'shore') {
        marker.alpha = 0.45;
      }
      markers.push(marker);
    }

    this._spotIndex = spotIndex;
    this.setData({
      spotList: filtered,
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
    var spot = this._spotIndex && this._spotIndex[spotId];
    if (!spot) return;

    var self = this;
    var openPanel = function (fullSpot) {
      if (!fullSpot.resolvedShips) {
        fullSpot.resolvedShips = [];
      }
      self.setData({
        selectedSpot: fullSpot,
        showSpotPanel: true,
        centerLat: fullSpot.latitude,
        centerLng: fullSpot.longitude,
        scale: 12
      });
    };

    if (spot.resolvedShips && spot.resolvedShips.length) {
      openPanel(spot);
      return;
    }

    var api = require('../../config/api');
    if (api.USE_API) {
      fishingSpots.fetchSpotDetail(spotId).then(function (detail) {
        if (!detail) {
          openPanel(spot);
          return;
        }
        var merged = Object.assign({}, spot, detail, {
          typeLabel: typeLabel(detail.type || spot.type),
          favorited: mapFavorites.isFavorite(spotId)
        });
        if (self._spotIndex) {
          self._spotIndex[spotId] = merged;
        }
        openPanel(merged);
      });
      return;
    }

    spot.resolvedShips = resolveShips(spot.ships || []);
    if (this._spotIndex) {
      this._spotIndex[spotId] = spot;
    }
    openPanel(spot);
  },

  onCloseSpotPanel: function () {
    this.setData({ showSpotPanel: false, selectedSpot: null });
  },

  onToggleFavorite: function () {
    var spot = this.data.selectedSpot;
    if (!spot) return;

    if (!auth.isLoggedIn()) {
      mapFavorites.setPendingFavorite(spot.id);
      wx.showToast({ title: '请先登录', icon: 'none' });
      setTimeout(function () {
        auth.goLogin({ from: 'map-fav' });
      }, 400);
      return;
    }

    var self = this;
    mapFavorites.toggleFavorite(spot.id).then(function (favorited) {
      try {
        require('../../utils/pageRefresh').resetRefresh('map-favorites');
      } catch (e) {}
      self.setData({ 'selectedSpot.favorited': favorited });
      wx.showToast({ title: favorited ? '已收藏' : '已取消收藏', icon: 'none' });
      self.invalidateSpotBase();
      self.applyFilters();
    }).catch(function (err) {
      if (err && err.code === 'NEED_LOGIN') {
        mapFavorites.setPendingFavorite(spot.id);
        auth.goLogin({ from: 'map-fav' });
        return;
      }
      wx.showToast({ title: (err && err.message) || '操作失败', icon: 'none' });
    });
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
    var ship = null;
    if (spot.resolvedShips && spot.resolvedShips.length) {
      for (var i = 0; i < spot.resolvedShips.length; i++) {
        if (spot.resolvedShips[i].shipKey === shipKey) {
          ship = spot.resolvedShips[i];
          break;
        }
      }
    }
    if (!ship) ship = fishingSpots.getShipByKey(shipKey);
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
