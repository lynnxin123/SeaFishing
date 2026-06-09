/**
 * 海钓地图 - 钓点与关联船只数据
 * 新增钓点：在 FISHING_SPOTS 数组末尾追加对象，填写 latitude / longitude 即可
 */

/** 地图关联预约船只（与首页船只一致，跳转船舶详情复用预约流程） */
var MAP_SHIPS = {
  'blue-sea': {
    shipKey: 'blue-sea',
    shipName: '蓝海号渔船',
    boatId: 'LANHAI001',
    maxNum: 10,
    shipLen: '9.2',
    shipWid: '2.8',
    score: 4.9,
    sailCount: 12,
    captain: '大海',
    captainAvatar: '/images/captain.jpg',
    price: 1280,
    images: ['/images/Reservation3.jpg'],
    wharf: '大连码头',
    displayWharf: '大连码头',
    facilities: ['卫生间', '休息室']
  },
  'deep-explore': {
    shipKey: 'deep-explore',
    shipName: '深海探索',
    boatId: 'SHENHAI001',
    maxNum: 8,
    shipLen: '8.5',
    shipWid: '2.5',
    score: 4.8,
    sailCount: 9,
    captain: '阿峰',
    captainAvatar: '/images/captain.jpg',
    price: 980,
    images: ['/images/Reservation1.jpg'],
    wharf: '大连码头',
    displayWharf: '大连码头',
    facilities: ['茶水室']
  },
  'sea-breeze': {
    shipKey: 'sea-breeze',
    shipName: '海风之旅',
    boatId: 'HAIFENG001',
    maxNum: 8,
    shipLen: '7.8',
    shipWid: '2.4',
    score: 4.7,
    sailCount: 7,
    captain: '婷婷',
    captainAvatar: '/images/captain.jpg',
    price: 1680,
    images: ['/images/Reservation2.jpg'],
    wharf: '旅顺码头',
    displayWharf: '旅顺码头',
    facilities: ['棋牌室', '休息室']
  }
};

/**
 * 钓点类型：shore 岸钓 | pier 船钓码头 | deep 深海钓场
 * seaRange：near 近海 | far 远海
 * chargeType：free 免费 | paid 收费
 * ships：关联 MAP_SHIPS 的 key 列表
 * eventId：关联赛事报名页（非空则地图红色高亮）
 */
var FISHING_SPOTS = [
  {
    id: 'spot-001',
    name: '星海公园岸钓区',
    type: 'shore',
    latitude: 38.878,
    longitude: 121.574,
    depth: '2-8米',
    fishSpecies: ['鲈鱼', '黑鱼', '黄鱼'],
    bestMonths: '4月-10月',
    chargeType: 'free',
    priceNote: '免费',
    seaRange: 'near',
    ships: [],
    windSensitive: false
  },
  {
    id: 'spot-002',
    name: '金石滩滨海岸钓点',
    type: 'shore',
    latitude: 39.052,
    longitude: 122.008,
    depth: '3-12米',
    fishSpecies: ['鲅鱼', '鲈鱼', '章鱼'],
    bestMonths: '5月-11月',
    chargeType: 'paid',
    priceNote: '收费 30元/人',
    seaRange: 'near',
    ships: [],
    windSensitive: false
  },
  {
    id: 'spot-003',
    name: '老虎滩船钓码头',
    type: 'pier',
    latitude: 38.867,
    longitude: 121.681,
    depth: '码头水深 5米',
    fishSpecies: ['黄鱼', '鲈鱼', '带鱼'],
    bestMonths: '全年',
    chargeType: 'paid',
    priceNote: '码头停泊费另计',
    seaRange: 'near',
    ships: ['deep-explore', 'sea-breeze'],
    windSensitive: true
  },
  {
    id: 'spot-004',
    name: '东港国际游艇码头',
    type: 'pier',
    latitude: 38.923,
    longitude: 121.668,
    depth: '码头水深 6米',
    fishSpecies: ['黄鱼', '黑鱼', '鲅鱼'],
    bestMonths: '3月-11月',
    chargeType: 'paid',
    priceNote: '按船收费',
    seaRange: 'near',
    ships: ['blue-sea', 'deep-explore', 'sea-breeze'],
    windSensitive: true
  },
  {
    id: 'spot-005',
    name: '旅顺新港船钓码头',
    type: 'pier',
    latitude: 38.8,
    longitude: 121.262,
    depth: '码头水深 8米',
    fishSpecies: ['鲈鱼', '章鱼', '带鱼'],
    bestMonths: '4月-12月',
    chargeType: 'paid',
    priceNote: '停泊费 + 燃油',
    seaRange: 'near',
    ships: ['sea-breeze', 'blue-sea'],
    windSensitive: true
  },
  {
    id: 'spot-006',
    name: '獐子岛深海钓场',
    type: 'deep',
    latitude: 39.02,
    longitude: 122.73,
    depth: '20-60米',
    fishSpecies: ['黄鱼', '带鱼', '鲅鱼'],
    bestMonths: '6月-10月',
    chargeType: 'paid',
    priceNote: '包船出海',
    seaRange: 'far',
    ships: ['blue-sea', 'deep-explore'],
    windSensitive: true
  },
  {
    id: 'spot-007',
    name: '广鹿岛深海钓场',
    type: 'deep',
    latitude: 39.18,
    longitude: 122.35,
    depth: '25-80米',
    fishSpecies: ['黄鱼', '鲈鱼', '章鱼'],
    bestMonths: '5月-11月',
    chargeType: 'paid',
    priceNote: '包船出海',
    seaRange: 'far',
    ships: ['sea-breeze', 'deep-explore'],
    windSensitive: true
  },
  {
    id: 'spot-008',
    name: '长山群岛海钓基地',
    type: 'pier',
    latitude: 39.28,
    longitude: 122.58,
    depth: '15-40米',
    fishSpecies: ['黄鱼', '鲅鱼', '鲈鱼', '带鱼'],
    bestMonths: '6月-9月',
    chargeType: 'paid',
    priceNote: '赛事/包船',
    seaRange: 'far',
    ships: ['blue-sea', 'deep-explore', 'sea-breeze'],
    windSensitive: true,
    eventId: 1,
    eventTitle: '大鱼挑战赛'
  },
  {
    id: 'spot-009',
    name: '大连东部竞技钓场',
    type: 'deep',
    latitude: 38.96,
    longitude: 122.42,
    depth: '18-50米',
    fishSpecies: ['黄鱼', '鲈鱼', '黑鱼'],
    bestMonths: '9月-11月',
    chargeType: 'paid',
    priceNote: '赛事专用海域',
    seaRange: 'far',
    ships: ['blue-sea', 'sea-breeze'],
    windSensitive: true,
    eventId: 2,
    eventTitle: '金秋海钓赛'
  }
];

var FISH_FILTER_OPTIONS = ['黄鱼', '黑鱼', '鲈鱼', '鲅鱼', '章鱼', '带鱼'];

var MARKER_ICONS = {
  shore: '/images/map-marker-shore.png',
  pier: '/images/map-marker-pier.png',
  deep: '/images/map-marker-deep.png',
  event: '/images/map-marker-event.png'
};

var DALIAN_CENTER = {
  latitude: 38.914,
  longitude: 121.614
};

var _cachedSpots = null;
var _cacheTs = 0;
var _fetchPromise = null;
var _detailCache = {};
var SPOTS_CACHE_TTL = 5 * 60 * 1000;

function getSpotById(id) {
  var spots = getSpots();
  return spots.find(function (s) {
    return s.id === id;
  });
}

function getShipByKey(key) {
  return MAP_SHIPS[key] || null;
}

function resolveShips(shipKeys) {
  if (!Array.isArray(shipKeys)) return [];
  return shipKeys
    .map(function (key) {
      return MAP_SHIPS[key] || null;
    })
    .filter(Boolean);
}

function fetchSpots(options) {
  options = options || {};
  var api = require('../config/api');
  if (!api.USE_API) {
    _cachedSpots = FISHING_SPOTS.slice();
    _cacheTs = Date.now();
    return Promise.resolve(_cachedSpots);
  }

  var now = Date.now();
  if (!options.force && _cachedSpots && now - _cacheTs < SPOTS_CACHE_TTL) {
    return Promise.resolve(_cachedSpots);
  }
  if (_fetchPromise) {
    return _fetchPromise;
  }

  var request = require('./request');
  _fetchPromise = request
    .get('/spots')
    .then(function (list) {
      _cachedSpots = Array.isArray(list) ? list : FISHING_SPOTS.slice();
      _cacheTs = Date.now();
      return _cachedSpots;
    })
    .catch(function () {
      _cachedSpots = FISHING_SPOTS.slice();
      _cacheTs = Date.now();
      return _cachedSpots;
    })
    .finally(function () {
      _fetchPromise = null;
    });

  return _fetchPromise;
}

function fetchSpotDetail(spotId) {
  if (!spotId) {
    return Promise.resolve(null);
  }
  if (_detailCache[spotId]) {
    return Promise.resolve(_detailCache[spotId]);
  }

  var api = require('../config/api');
  if (!api.USE_API) {
    var local = getSpotById(spotId);
    if (!local) {
      return Promise.resolve(null);
    }
    var detail = Object.assign({}, local, {
      resolvedShips: resolveShips(local.ships || [])
    });
    _detailCache[spotId] = detail;
    return Promise.resolve(detail);
  }

  var request = require('./request');
  return request
    .get('/spots/' + spotId)
    .then(function (spot) {
      if (!spot) return null;
      _detailCache[spotId] = spot;
      return spot;
    })
    .catch(function () {
      return null;
    });
}

function getSpots() {
  return _cachedSpots || FISHING_SPOTS;
}

function invalidateSpotCache() {
  _cachedSpots = null;
  _cacheTs = 0;
  _detailCache = {};
}

module.exports = {
  MAP_SHIPS: MAP_SHIPS,
  FISHING_SPOTS: FISHING_SPOTS,
  FISH_FILTER_OPTIONS: FISH_FILTER_OPTIONS,
  MARKER_ICONS: MARKER_ICONS,
  DALIAN_CENTER: DALIAN_CENTER,
  fetchSpots: fetchSpots,
  fetchSpotDetail: fetchSpotDetail,
  getSpots: getSpots,
  getSpotById: getSpotById,
  getShipByKey: getShipByKey,
  resolveShips: resolveShips,
  invalidateSpotCache: invalidateSpotCache
};
