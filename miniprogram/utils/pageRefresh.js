var _lastAt = {};

function shouldRefresh(key, minIntervalMs) {
  minIntervalMs = minIntervalMs || 30000;
  var now = Date.now();
  var last = _lastAt[key] || 0;
  return now - last >= minIntervalMs;
}

function markRefreshed(key) {
  _lastAt[key] = Date.now();
}

function resetRefresh(key) {
  if (key) {
    delete _lastAt[key];
    return;
  }
  _lastAt = {};
}

module.exports = {
  shouldRefresh: shouldRefresh,
  markRefreshed: markRefreshed,
  resetRefresh: resetRefresh
};
