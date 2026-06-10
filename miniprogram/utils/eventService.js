/** 赛事服务：静态数据与跳转路径，后续可替换为接口返回 */

function buildFeatureRoute(type, competitionId) {
  competitionId = competitionId || '1';
  return (
    '/packageEvent/pages/event-feature/event-feature?type=' +
    encodeURIComponent(type) +
    '&competitionId=' +
    encodeURIComponent(String(competitionId))
  );
}

function pickActiveCompetitionId(list) {
  if (!Array.isArray(list) || !list.length) {
    return '1';
  }
  var open = list.find(function (item) {
    return item && item.status !== 'ended';
  });
  return String((open || list[0]).id || '1');
}

function getToolCards(competitionId) {
  competitionId = competitionId || '1';
  return FEATURE_CARDS.concat(UTILITY_CARDS).map(function (card) {
    return Object.assign({}, card, {
      route: buildFeatureRoute(card.id, competitionId)
    });
  });
}

var EVENT_LIST_PATH = '/pages/event-list/event-list';
var EVENT_DETAIL_PATH = '/packageEvent/pages/event-detail/event-detail';
var EVENT_REGISTER_PATH = '/packageEvent/pages/event-register/event-register';
var LIST_PAGE_TITLE = '赛事报名';
var LIST_SERIES_TITLE = '海发海岛海钓系列赛';

var AD_BANNER = {
  image: '/images/competition2.jpg',
  title: '广告招商',
  subtitle: '虚位以待',
  phone: '13604117570'
};

var SIGNUP_BANNER = {
  title: '海钓赛事报名',
  subtitle: '巅峰对决 一触即发',
  bgImage: '/images/competition2.jpg'
};

var FEATURE_CARDS = [
  {
    id: 'measure',
    title: '长度测量',
    subtitle: '量之有度 渔获皆准',
    icon: '/images/competition1.jpg',
    bg: 'blue',
    route: buildFeatureRoute('measure', '1'),
    needLogin: true
  },
  {
    id: 'weight',
    title: '比赛称重',
    subtitle: '一"称"定音 胜负揭晓',
    icon: '/images/competition2.jpg',
    bg: 'cream',
    route: buildFeatureRoute('weight', '1'),
    needLogin: true
  },
  {
    id: 'ranking',
    title: '赛事排行',
    subtitle: '群星闪耀 巅峰荣耀',
    icon: '/images/competition3.jpg',
    bg: 'lavender',
    route: buildFeatureRoute('ranking', '1'),
    needLogin: true
  },
  {
    id: 'score',
    title: '个人成绩',
    subtitle: '不负韶华 只争朝夕',
    icon: '/images/competition2.jpg',
    bg: 'blue',
    route: buildFeatureRoute('score', '1'),
    needLogin: true
  }
];

var UTILITY_CARDS = [
  {
    id: 'report',
    title: '积分赛举报',
    iconType: 'gavel',
    route: buildFeatureRoute('report', '1'),
    needLogin: true
  },
  {
    id: 'appeal',
    title: '积分赛申诉',
    iconType: 'doc',
    route: buildFeatureRoute('appeal', '1'),
    needLogin: true
  }
];

var COMPETITION_LIST = [
  {
    id: '1',
    enLabel: 'COMPETITION FOR SEA',
    name: '大鱼挑战赛',
    cover: '/images/competition1.jpg',
    status: 'upcoming',
    statusText: '即将开赛',
    location: '长山群岛',
    time: '2026.07.12-07.14',
    fee: '待定',
    summary: '长山群岛海域大鱼挑战，等你来战',
    intro: '大鱼挑战赛聚焦长山群岛周边海域，以单尾渔获重量为核心评判标准，面向广大海钓爱好者开放报名，是海发海岛海钓系列赛夏季重点场次。',
    rules: [
      '参赛船只须符合组委会安全出海要求',
      '作钓区域与时段以赛前公告为准',
      '渔获称重须在现场裁判监督下完成'
    ],
    prizes: '设大鱼王及单项奖，具体奖金以赛前公告为准',
    organizer: '海发海岛海钓'
  },
  {
    id: '2',
    enLabel: 'COMPETITION FOR SEA',
    name: '金秋海钓赛',
    cover: '/images/competition2.jpg',
    status: 'upcoming',
    statusText: '报名中',
    location: '大连海域',
    time: '2026.09.18-09.20',
    fee: '待定',
    summary: '大连海域金秋海钓盛会',
    intro: '金秋海钓赛在大连海域举行，结合秋季渔汛特点设置多组别竞赛，适合团队与个人选手参与，感受金秋出海垂钓魅力。',
    rules: [
      '报名需完成实名认证',
      '全程服从船长与赛事裁判安排',
      '禁止使用违规钓具与饵料'
    ],
    prizes: '冠亚季军及最佳团队奖，年度积分计入系列赛总榜',
    organizer: '海发海岛海钓'
  },
  {
    id: '3',
    enLabel: 'COMPETITION FOR SEA',
    name: '冠军对决赛',
    cover: '/images/competition3.jpg',
    status: 'upcoming',
    statusText: '即将开赛',
    location: '烟台海岸',
    time: '2026.08.05-08.07',
    fee: '待定',
    summary: '年度冠军巅峰对决',
    intro: '冠军对决赛是海发海岛海钓系列赛年度总决赛，汇聚各分站优胜选手，在烟台海岸展开高水平竞技，争夺年度总冠军荣誉。',
    rules: [
      '仅限获得分站赛晋级资格选手报名',
      '竞赛采用积分+称重综合排名',
      '须全程佩戴救生装备出海'
    ],
    prizes: '年度总冠军、亚军、季军及多项专项奖',
    organizer: '海发海岛海钓'
  }
];

function openEventListTab(options) {
  options = options || {};
  if (options.id) {
    wx.setStorageSync('eventListOpenId', options.id);
  }
  wx.switchTab({ url: EVENT_LIST_PATH });
}

function getCompetitionById(id) {
  var key = String(id);
  var list = getCompetitionList();
  for (var i = 0; i < list.length; i++) {
    if (String(list[i].id) === key) {
      return list[i];
    }
  }
  return null;
}

var _cachedCompetitions = null;
var _cachedCompetitionsKey = '';
var _fetchCompetitionPromises = {};

function normalizeCover(cover) {
  if (!cover) return '/images/competition1.jpg';
  return cover;
}

function normalizeCompetition(item) {
  if (!item || typeof item !== 'object') return item;
  return Object.assign({}, item, {
    cover: normalizeCover(item.cover)
  });
}

function normalizeCompetitionList(list) {
  if (!Array.isArray(list)) return [];
  return list.map(normalizeCompetition);
}

function getCompetitionList() {
  return _cachedCompetitions || COMPETITION_LIST;
}

function sliceCompetitionList(list, limit) {
  if (!limit || limit <= 0) {
    return list;
  }
  return list.slice(0, limit);
}

function fetchCompetitionList(options) {
  options = options || {};
  var api = require('../config/api');
  if (!api.USE_API) {
    _cachedCompetitions = normalizeCompetitionList(COMPETITION_LIST.slice());
    _cachedCompetitionsKey = 'all';
    return Promise.resolve(sliceCompetitionList(_cachedCompetitions, options.limit));
  }
  var request = require('./request');
  var cacheKey = 'all';
  if (_cachedCompetitions && _cachedCompetitionsKey === cacheKey) {
    return Promise.resolve(sliceCompetitionList(_cachedCompetitions, options.limit));
  }
  if (_fetchCompetitionPromises[cacheKey]) {
    return _fetchCompetitionPromises[cacheKey].then(function (list) {
      return sliceCompetitionList(list, options.limit);
    });
  }
  _fetchCompetitionPromises[cacheKey] = request
    .get('/competitions', { limit: 50 })
    .then(function (list) {
      _cachedCompetitions = normalizeCompetitionList(
        Array.isArray(list) ? list : COMPETITION_LIST.slice()
      );
      _cachedCompetitionsKey = cacheKey;
      return _cachedCompetitions;
    })
    .catch(function () {
      if (options.strict) {
        return Promise.reject(new Error('加载失败，请重试'));
      }
      _cachedCompetitions = normalizeCompetitionList(COMPETITION_LIST.slice());
      _cachedCompetitionsKey = cacheKey;
      return _cachedCompetitions;
    })
    .finally(function () {
      delete _fetchCompetitionPromises[cacheKey];
    });
  return _fetchCompetitionPromises[cacheKey].then(function (list) {
    return sliceCompetitionList(list, options.limit);
  });
}

function fetchCompetitionById(id, options) {
  options = options || {};
  var api = require('../config/api');
  if (!api.USE_API) {
    return Promise.resolve(getCompetitionById(id));
  }
  if (!options.force) {
    var cached = getCompetitionById(id);
    if (cached) {
      return Promise.resolve(cached);
    }
  }
  var request = require('./request');
  return request
    .get('/competitions/' + id)
    .then(function (item) {
      if (!item) return getCompetitionById(id);
      if (_cachedCompetitions) {
        var idx = _cachedCompetitions.findIndex(function (c) {
          return String(c.id) === String(id);
        });
        if (idx >= 0) _cachedCompetitions[idx] = item;
      }
      return item;
    })
    .catch(function () {
      if (options.strict) {
        return Promise.reject(new Error('加载失败，请重试'));
      }
      return getCompetitionById(id);
    });
}

var _registeredCompIds = null;
var _registeredCacheTs = 0;
var REGISTRATION_CACHE_TTL = 60000;

function invalidateRegistrationCache() {
  _registeredCompIds = null;
  _registeredCacheTs = 0;
  try {
    require('./pageRefresh').resetRefresh('event-orders');
  } catch (e) {}
}

function fetchRegisteredCompetitionIds(options) {
  options = options || {};
  var api = require('../config/api');
  var token = wx.getStorageSync('token');
  if (!api.USE_API || !token) {
    return Promise.resolve([]);
  }
  var now = Date.now();
  if (!options.force && _registeredCompIds && now - _registeredCacheTs < REGISTRATION_CACHE_TTL) {
    return Promise.resolve(_registeredCompIds);
  }
  return fetchMyRegistrations({ page: 1, pageSize: 50 })
    .then(function (res) {
      var items = (res && res.items) || [];
      _registeredCompIds = items.map(function (item) {
        return String(item.competitionId);
      });
      _registeredCacheTs = Date.now();
      return _registeredCompIds;
    })
    .catch(function () {
      return _registeredCompIds || [];
    });
}

function hasRegisteredCompetition(legacyId) {
  if (legacyId == null || legacyId === '') {
    return Promise.resolve(false);
  }
  var id = String(legacyId);
  return fetchRegisteredCompetitionIds().then(function (ids) {
    return ids.indexOf(id) >= 0;
  });
}

function registerCompetition(id, form) {
  var api = require('../config/api');
  if (!api.USE_API) {
    return Promise.resolve({ ok: true });
  }
  var request = require('./request');
  return request
    .post('/competitions/' + id + '/register', {
      realName: form.realName,
      phone: form.phone,
      people: Number(form.people),
      emergencyContact: form.emergencyContact || '',
      remark: form.remark || ''
    })
    .then(function (res) {
      invalidateRegistrationCache();
      return res;
    });
}

function fetchMyRegistrations(options) {
  options = options || {};
  var api = require('../config/api');
  var token = wx.getStorageSync('token');
  if (!api.USE_API || !token) {
    return Promise.resolve([]);
  }
  var request = require('./request');
  return request
    .get('/competitions/my/registrations', {
      page: options.page || 1,
      pageSize: options.pageSize || 20
    })
    .then(function (res) {
      if (Array.isArray(res)) {
        return {
          items: res,
          total: res.length,
          page: 1,
          pageSize: res.length,
          hasMore: false
        };
      }
      var items = (res && res.items) || [];
      var page = (res && res.page) || options.page || 1;
      var pageSize = (res && res.pageSize) || options.pageSize || 20;
      var total = res && res.total != null ? res.total : items.length;
      return {
        items: items,
        total: total,
        page: page,
        pageSize: pageSize,
        hasMore: page * pageSize < total
      };
    })
    .catch(function () {
      return { items: [], total: 0, page: 1, pageSize: 20, hasMore: false };
    });
}

function getIndexEventCards(limit) {
  var list = getCompetitionList();
  if (limit && limit > 0) {
    list = list.slice(0, limit);
  }
  return list.map(function (item) {
    return {
      id: Number(item.id),
      banner: item.cover,
      title: item.name,
      location: item.location,
      date: item.time
    };
  });
}

function openEventDetail(id) {
  if (!id && id !== 0) return;
  wx.navigateTo({
    url: EVENT_DETAIL_PATH + '?id=' + id
  });
}

var FEATURE_TITLES = {
  measure: '长度测量',
  weight: '比赛称重',
  ranking: '赛事排行',
  score: '个人成绩',
  report: '积分赛举报',
  appeal: '积分赛申诉'
};

var FEATURE_DESC = {
  measure: '按赛事规则测量渔获长度，数据将用于成绩统计与排名（正式比赛期间由裁判核验后生效）。',
  weight: '比赛称重环节记录单尾/总重数据，支持现场录入与成绩公示。',
  ranking: '查看当前赛事积分榜与组别排名，了解实时战况。',
  score: '查询个人参赛成绩、有效渔获记录与历史场次表现。',
  report: '对积分赛中的违规行为进行举报，组委会将在赛后核实处理。',
  appeal: '对成绩、判罚等有异议时可提交申诉，请附说明与佐证材料。'
};

var _cachedBanners = null;
var _bannersCacheTs = 0;
var BANNERS_CACHE_TTL = 5 * 60 * 1000;

function fetchBanners() {
  var api = require('../config/api');
  if (!api.USE_API) {
    return Promise.resolve(null);
  }
  var now = Date.now();
  if (_cachedBanners && now - _bannersCacheTs < BANNERS_CACHE_TTL) {
    return Promise.resolve(_cachedBanners);
  }
  var request = require('./request');
  return request
    .get('/banners')
    .then(function (list) {
      if (Array.isArray(list) && list.length) {
        _cachedBanners = list;
        _bannersCacheTs = Date.now();
        return _cachedBanners;
      }
      return null;
    })
    .catch(function () {
      return _cachedBanners;
    });
}

function goEventOrdersAfterSuccess() {
  var pageHome = require('./pageHome');
  invalidateRegistrationCache();
  wx.showToast({
    title: '报名提交成功',
    icon: 'success',
    duration: 1500,
    mask: true
  });
  setTimeout(function () {
    var url = '/packageOrder/pages/event-orders/event-orders?refresh=1&from=success';
    wx.redirectTo({
      url: url,
      fail: function () {
        wx.navigateTo({ url: url });
      },
      success: function () {
        setTimeout(function () {
          pageHome.promptReturnHome({
            title: '报名成功',
            content: '报名记录已保存。可返回首页，或留在此页查看订单。',
            confirmText: '留在此页',
            cancelText: '返回首页'
          });
        }, 400);
      }
    });
  }, 1500);
}

module.exports = {
  buildFeatureRoute: buildFeatureRoute,
  pickActiveCompetitionId: pickActiveCompetitionId,
  getToolCards: getToolCards,
  EVENT_LIST_PATH: EVENT_LIST_PATH,
  EVENT_DETAIL_PATH: EVENT_DETAIL_PATH,
  EVENT_REGISTER_PATH: EVENT_REGISTER_PATH,
  LIST_PAGE_TITLE: LIST_PAGE_TITLE,
  LIST_SERIES_TITLE: LIST_SERIES_TITLE,
  AD_BANNER: AD_BANNER,
  SIGNUP_BANNER: SIGNUP_BANNER,
  FEATURE_CARDS: FEATURE_CARDS,
  UTILITY_CARDS: UTILITY_CARDS,
  COMPETITION_LIST: COMPETITION_LIST,
  FEATURE_TITLES: FEATURE_TITLES,
  FEATURE_DESC: FEATURE_DESC,
  EVENT_TOOL_CARDS: getToolCards('1'),
  getCompetitionList: getCompetitionList,
  fetchCompetitionList: fetchCompetitionList,
  fetchCompetitionById: fetchCompetitionById,
  registerCompetition: registerCompetition,
  hasRegisteredCompetition: hasRegisteredCompetition,
  fetchRegisteredCompetitionIds: fetchRegisteredCompetitionIds,
  invalidateRegistrationCache: invalidateRegistrationCache,
  fetchMyRegistrations: fetchMyRegistrations,
  fetchBanners: fetchBanners,
  getCompetitionById: getCompetitionById,
  getIndexEventCards: getIndexEventCards,
  openEventListTab: openEventListTab,
  openEventDetail: openEventDetail,
  goEventOrdersAfterSuccess: goEventOrdersAfterSuccess
};
