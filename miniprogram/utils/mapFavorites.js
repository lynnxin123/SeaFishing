var STORAGE_KEY = 'mapFavoriteSpots';

function getFavoriteIds() {
  try {
    var list = wx.getStorageSync(STORAGE_KEY);
    return Array.isArray(list) ? list : [];
  } catch (e) {
    return [];
  }
}

function isFavorite(spotId) {
  return getFavoriteIds().indexOf(spotId) >= 0;
}

function toggleFavorite(spotId) {
  var list = getFavoriteIds();
  var idx = list.indexOf(spotId);
  if (idx >= 0) {
    list.splice(idx, 1);
  } else {
    list.unshift(spotId);
  }
  wx.setStorageSync(STORAGE_KEY, list);
  return list.indexOf(spotId) >= 0;
}

module.exports = {
  STORAGE_KEY: STORAGE_KEY,
  getFavoriteIds: getFavoriteIds,
  isFavorite: isFavorite,
  toggleFavorite: toggleFavorite
};
