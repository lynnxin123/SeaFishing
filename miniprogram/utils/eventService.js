/** 赛事服务：静态数据与跳转路径，后续可替换为接口返回 */

var FEATURE_ROUTES = {
  measure: '/pages/event-feature/event-feature?type=measure',
  weight: '/pages/event-feature/event-feature?type=weight',
  ranking: '/pages/event-feature/event-feature?type=ranking',
  score: '/pages/event-feature/event-feature?type=score',
  report: '/pages/event-feature/event-feature?type=report',
  appeal: '/pages/event-feature/event-feature?type=appeal'
};

var EVENT_LIST_PATH = '/pages/event-list/event-list';
var EVENT_DETAIL_PATH = '/pages/event-detail/event-detail';
var EVENT_REGISTER_PATH = '/pages/event-register/event-register';
var LIST_PAGE_TITLE = '赛事报名';
var LIST_SERIES_TITLE = '海发海岛海钓系列赛';

var AD_BANNER = {
  image: '/images/competition1.jpg',
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
    route: FEATURE_ROUTES.measure,
    needLogin: true
  },
  {
    id: 'weight',
    title: '比赛称重',
    subtitle: '一"称"定音 胜负揭晓',
    icon: '/images/competition2.jpg',
    bg: 'cream',
    route: FEATURE_ROUTES.weight,
    needLogin: true
  },
  {
    id: 'ranking',
    title: '赛事排行',
    subtitle: '群星闪耀 巅峰荣耀',
    icon: '/images/competition3.jpg',
    bg: 'lavender',
    route: FEATURE_ROUTES.ranking,
    needLogin: true
  },
  {
    id: 'score',
    title: '个人成绩',
    subtitle: '不负韶华 只争朝夕',
    icon: '/images/competition2.jpg',
    bg: 'blue',
    route: FEATURE_ROUTES.score,
    needLogin: true
  }
];

var UTILITY_CARDS = [
  {
    id: 'report',
    title: '积分赛举报',
    iconType: 'gavel',
    route: FEATURE_ROUTES.report,
    needLogin: true
  },
  {
    id: 'appeal',
    title: '积分赛申诉',
    iconType: 'doc',
    route: FEATURE_ROUTES.appeal,
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
  for (var i = 0; i < COMPETITION_LIST.length; i++) {
    if (String(COMPETITION_LIST[i].id) === key) {
      return COMPETITION_LIST[i];
    }
  }
  return null;
}

function getIndexEventCards() {
  return COMPETITION_LIST.map(function (item) {
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

module.exports = {
  FEATURE_ROUTES: FEATURE_ROUTES,
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
  getCompetitionById: getCompetitionById,
  getIndexEventCards: getIndexEventCards,
  openEventListTab: openEventListTab,
  openEventDetail: openEventDetail
};
