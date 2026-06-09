/**
 * 按日期生成大连海域海况与潮汐（确定性模拟，同日结果一致）
 * 后续可替换为真实气象/潮汐 API
 */
var WEEKDAYS = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
var WIND_DIRS = ['东风', '南风', '西风', '北风', '东南风', '西南风', '西北风', '东北风'];
var WEATHER_TYPES = [
  { desc: '晴朗', icon: '☀️' },
  { desc: '多云', icon: '⛅' },
  { desc: '阴', icon: '☁️' },
  { desc: '小雨', icon: '🌧️' }
];
var MONTH_BASE_TEMP = [2, 4, 10, 16, 22, 26, 28, 27, 22, 16, 8, 3];

function pad(n) {
  return String(n).padStart(2, '0');
}

function parseDateInput(input) {
  if (!input) return new Date();
  if (input instanceof Date) {
    return new Date(input.getFullYear(), input.getMonth(), input.getDate());
  }
  var parts = String(input).split('-');
  return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
}

function formatDateYmd(date) {
  return date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate());
}

function formatDisplayDate(date) {
  return pad(date.getMonth() + 1) + '/' + pad(date.getDate());
}

function dateSeed(date) {
  return date.getFullYear() * 372 + (date.getMonth() + 1) * 31 + date.getDate();
}

function seededRandom(seed, slot) {
  var x = Math.sin(seed * 12.9898 + slot * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

function formatTimeFromMinutes(mins) {
  var total = ((mins % (24 * 60)) + 24 * 60) % (24 * 60);
  var h = Math.floor(total / 60);
  var m = total % 60;
  return pad(h) + ':' + pad(m);
}

function getSeaCondition(windLevel) {
  if (windLevel <= 2) return '平静';
  if (windLevel === 3) return '轻浪';
  if (windLevel === 4) return '中浪';
  if (windLevel === 5) return '大浪';
  return '巨浪';
}

function getTideForDate(date) {
  var seed = dateSeed(date);
  var dayIndex = Math.floor(date.getTime() / 86400000);
  var highMinutes = (7 * 60 + (dayIndex * 47) % (12 * 60)) % (24 * 60);
  var lowMinutes = (highMinutes + 6 * 60 + 18 + Math.floor(seededRandom(seed, 6) * 30)) % (24 * 60);
  var lunar = (dayIndex % 29) / 29;
  var swing = Math.abs(Math.sin(lunar * Math.PI));
  var highHeight = (1.0 + 0.9 * swing + seededRandom(seed, 7) * 0.2).toFixed(1);
  var lowHeight = (0.3 + 0.5 * (1 - swing) + seededRandom(seed, 8) * 0.15).toFixed(1);

  var tides = [
    { label: '涨潮', time: formatTimeFromMinutes(highMinutes), height: highHeight + 'm' },
    { label: '落潮', time: formatTimeFromMinutes(lowMinutes), height: lowHeight + 'm' }
  ];
  tides.sort(function (a, b) {
    return a.time.localeCompare(b.time);
  });
  return tides;
}

var CACHE_TTL_MS = 10 * 60 * 1000;
var _cache = {};

function computeConditions(date) {
  var seed = dateSeed(date);
  var month = date.getMonth();
  var baseTemp = MONTH_BASE_TEMP[month];
  var temp = baseTemp + Math.round((seededRandom(seed, 1) - 0.5) * 8);
  var weatherType = WEATHER_TYPES[Math.floor(seededRandom(seed, 2) * WEATHER_TYPES.length)];
  var windLevel = 1 + Math.floor(seededRandom(seed, 4) * 8);
  var windDir = WIND_DIRS[Math.floor(seededRandom(seed, 5) * WIND_DIRS.length)];

  return {
    weather: {
      date: formatDisplayDate(date),
      week: WEEKDAYS[date.getDay()],
      temp: temp + '°C',
      desc: weatherType.desc,
      wind: windDir + ' ' + windLevel + '级',
      windLevel: windLevel,
      sea: getSeaCondition(windLevel),
      icon: weatherType.icon
    },
    tide: getTideForDate(date),
    windBlocked: windLevel >= 6
  };
}

function getConditionsForDate(dateInput) {
  var date = parseDateInput(dateInput);
  var key = formatDateYmd(date);
  var cached = _cache[key];
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
    return cached.block;
  }
  var block = computeConditions(date);
  _cache[key] = { at: Date.now(), block: block };
  return block;
}

module.exports = {
  formatDateYmd: formatDateYmd,
  getConditionsForDate: getConditionsForDate,
  CACHE_TTL_MS: CACHE_TTL_MS
};
