/**
 * 首页主推船只（与后端 seed / 海钓约船列表为同一批船，首页仅做重点展示）
 */
var FEATURED_BOAT_IDS = ['SHENHAI001', 'HAIFENG001', 'LANHAI001'];

var FEATURED_BOATS = [
  {
    boatId: 'SHENHAI001',
    shipName: '深海探索',
    maxNum: 8,
    shipLen: 8.5,
    shipWid: 2.5,
    score: 4.8,
    sailCount: 9,
    experience: 10,
    captain: '阿峰',
    captainAvatar: '/images/captain.jpg',
    price: 980,
    images: ['/images/Reservation1.jpg'],
    wharf: '大连码头',
    displayWharf: '大连码头',
    facilities: ['茶水室'],
    description: '本船经验丰富，适合海钓、休闲使用。'
  },
  {
    boatId: 'HAIFENG001',
    shipName: '海风之旅',
    maxNum: 8,
    shipLen: 7.8,
    shipWid: 2.4,
    score: 4.7,
    sailCount: 7,
    experience: 8,
    captain: '婷婷',
    captainAvatar: '/images/captain.jpg',
    price: 1680,
    images: ['/images/Reservation2.jpg'],
    wharf: '旅顺码头',
    displayWharf: '旅顺码头',
    facilities: ['棋牌室', '休息室'],
    description: '本船经验丰富，适合海钓、休闲使用。'
  },
  {
    boatId: 'LANHAI001',
    shipName: '蓝海号渔船',
    maxNum: 10,
    shipLen: 9.2,
    shipWid: 2.8,
    score: 4.9,
    sailCount: 12,
    experience: 15,
    captain: '大海',
    captainAvatar: '/images/captain.jpg',
    price: 1280,
    images: ['/images/Reservation3.jpg'],
    wharf: '大连码头',
    displayWharf: '大连码头',
    facilities: ['卫生间', '休息室'],
    description: '本船经验丰富，适合海钓、休闲使用。'
  }
];

function toIndexBoat(ship, index) {
  return {
    id: index + 1,
    boatId: ship.boatId,
    image: (ship.images && ship.images[0]) || '/images/boat1.jpg',
    name: ship.shipName,
    captain: ship.captain,
    capacity: ship.maxNum,
    price: ship.price
  };
}

function getIndexBoats(ships) {
  var list = ships || FEATURED_BOATS;
  return list.map(toIndexBoat);
}

function findByIndexId(indexId) {
  var idx = Number(indexId) - 1;
  if (idx < 0 || idx >= FEATURED_BOATS.length) return null;
  return FEATURED_BOATS[idx];
}

function findByBoatId(boatId) {
  return FEATURED_BOATS.find(function (ship) {
    return ship.boatId === boatId;
  }) || null;
}

function enrichFromApi(items) {
  if (!Array.isArray(items) || !items.length) return FEATURED_BOATS.slice();
  return FEATURED_BOAT_IDS.map(function (boatId) {
    var remote = items.find(function (item) {
      return item.boatId === boatId;
    });
    var local = findByBoatId(boatId);
    if (!local) return remote || null;
    if (!remote) return local;
    return Object.assign({}, local, {
      maxNum: remote.maxNum != null ? remote.maxNum : local.maxNum,
      shipLen: remote.shipLen != null ? remote.shipLen : local.shipLen,
      shipWid: remote.shipWid != null ? remote.shipWid : local.shipWid,
      score: remote.score != null ? remote.score : local.score,
      sailCount: remote.sailCount != null ? remote.sailCount : local.sailCount,
      experience: remote.experience != null ? remote.experience : local.experience,
      captain: remote.captain || local.captain,
      captainAvatar: remote.captainAvatar || local.captainAvatar,
      price: remote.price != null ? remote.price : local.price,
      images: remote.images && remote.images.length ? remote.images : local.images,
      wharf: remote.wharf || local.wharf,
      displayWharf: remote.displayWharf || local.displayWharf,
      facilities: remote.facilities && remote.facilities.length ? remote.facilities : local.facilities,
      description: remote.description || local.description
    });
  }).filter(Boolean);
}

function prependToShipList(ships) {
  var list = Array.isArray(ships) ? ships.slice() : [];
  var ids = {};
  list.forEach(function (ship) {
    if (ship && ship.boatId) ids[ship.boatId] = true;
  });
  var featured = FEATURED_BOATS.filter(function (ship) {
    return !ids[ship.boatId];
  });
  return featured.concat(list);
}

module.exports = {
  FEATURED_BOAT_IDS: FEATURED_BOAT_IDS,
  FEATURED_BOATS: FEATURED_BOATS,
  getIndexBoats: getIndexBoats,
  findByIndexId: findByIndexId,
  findByBoatId: findByBoatId,
  enrichFromApi: enrichFromApi,
  prependToShipList: prependToShipList
};
