var STORAGE_KEY = 'message_read_ids';

var DEFAULT_MESSAGES = [
  {
    id: 'welcome',
    title: '欢迎使用海发海钓',
    summary: '平台主推船只、赛事报名、海钓地图已开放，祝您渔获满满。',
    content:
      '欢迎使用海发海钓小程序。您可在首页预约主推船只，在赛事 Tab 报名海钓比赛，在海钓地图查看钓点与关联钓船。如有问题请联系客服。',
    time: '系统通知',
    read: false
  },
  {
    id: 'verify',
    title: '实名认证提醒',
    summary: '预约船只与赛事报名前，请先完成实名认证。',
    content: '为保障出海安全，预约船只与赛事报名需完成实名认证。请前往「我的」-「去认证」填写真实姓名与证件信息。',
    time: '系统通知',
    read: false
  },
  {
    id: 'event',
    title: '赛事报名开放',
    summary: '海发海岛海钓系列赛持续更新，敬请关注赛事列表。',
    content: '赛事列表会同步最新场次与报名状态，报名成功后可在「我的」-「赛事报名订单」查看记录。',
    time: '活动通知',
    read: false
  }
];

function getReadIds() {
  try {
    var raw = wx.getStorageSync(STORAGE_KEY);
    return Array.isArray(raw) ? raw : [];
  } catch (e) {
    return [];
  }
}

function saveReadIds(ids) {
  wx.setStorageSync(STORAGE_KEY, ids);
}

function fetchMessages() {
  var readIds = getReadIds();
  return Promise.resolve(
    DEFAULT_MESSAGES.map(function (item) {
      return Object.assign({}, item, {
        read: readIds.indexOf(item.id) >= 0
      });
    })
  );
}

function markRead(id) {
  if (!id) return;
  var ids = getReadIds();
  if (ids.indexOf(id) < 0) {
    ids.push(id);
    saveReadIds(ids);
  }
}

module.exports = {
  fetchMessages: fetchMessages,
  markRead: markRead
};
