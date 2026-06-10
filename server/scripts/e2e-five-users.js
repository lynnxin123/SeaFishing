/**
 * 5 个测试账号全链路 API 冒烟测试（开发模式 dev:openid）
 * 运行：node scripts/e2e-five-users.js
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const BASE = process.env.API_BASE || 'http://127.0.0.1:3000/api';

const { E2E_USERS, openidFromCode } = require('./e2e-users');
const USERS = E2E_USERS;

const results = { pass: 0, fail: 0, errors: [] };

function tomorrow() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

/** 用于取消/退款测试：距出航 >72h */
function sailDateForCancelTest() {
  const d = new Date();
  d.setDate(d.getDate() + 5);
  return d.toISOString().slice(0, 10);
}

async function api(method, path, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = 'Bearer ' + token;
  const res = await fetch(BASE + path, {
    method,
    headers,
    body: body != null ? JSON.stringify(body) : undefined,
  });
  let data = null;
  const text = await res.text();
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }
  return { status: res.status, data };
}

function ok(name, cond, detail) {
  if (cond) {
    results.pass++;
    console.log('  ✓', name);
    return true;
  }
  results.fail++;
  const msg = detail ? name + ' — ' + detail : name;
  results.errors.push(msg);
  console.log('  ✗', msg);
  return false;
}

async function login(user) {
  const res = await api('POST', '/auth/wx-login', {
    code: user.code,
    nickName: user.nickName,
    avatarUrl: '',
  });
  ok(user.nickName + ' 登录', res.status === 200 || res.status === 201, JSON.stringify(res.data));
  return res.data;
}

async function testPublic() {
  console.log('\n[公开接口]');
  const health = await api('GET', '/health');
  ok('健康检查', health.status === 200 && health.data && health.data.ok);

  const banners = await api('GET', '/banners');
  ok('轮播图', banners.status === 200 && Array.isArray(banners.data) && banners.data.length >= 1);

  const boats = await api('GET', '/boats?page=1&pageSize=10');
  ok('船只列表', boats.status === 200 && boats.data && boats.data.items && boats.data.items.length >= 1);

  const comps = await api('GET', '/competitions');
  ok('赛事列表', comps.status === 200 && Array.isArray(comps.data) && comps.data.length >= 1);

  const spots = await api('GET', '/spots');
  ok('钓点列表', spots.status === 200 && Array.isArray(spots.data) && spots.data.length >= 1);

  return {
    boat: boats.data.items[0],
    competition: comps.data[0],
    spot: spots.data[0],
  };
}

async function pickSlot(boatId, date) {
  const res = await api(
    'GET',
    '/bookings/slots/availability?boatId=' +
      encodeURIComponent(boatId) +
      '&date=' +
      encodeURIComponent(date),
  );
  const slots = res.data && res.data.slots ? res.data.slots : [];
  return slots.find((s) => s.availableShared) || slots[0] || null;
}

async function resetTesterBookings(openid) {
  const user = await prisma.user.findFirst({ where: { openid } });
  if (!user) return;
  const since = new Date();
  since.setDate(since.getDate() - 7);
  await prisma.booking.deleteMany({
    where: { userId: user.id, createdAt: { gte: since } },
  });
}

async function testUser1Booking(token, boat) {
  console.log('\n[用户1 · 预约订单]');
  await resetTesterBookings(openidFromCode(USERS[0].code));

  const verify = await api('PATCH', '/users/me/verify', {
    realName: '测试甲',
    idNumber: '110101199001011234',
  }, token);
  ok('实名认证', verify.status === 200 && verify.data && verify.data.verified);

  const rules = await api('GET', '/bookings/rules');
  ok('预约规则公开接口', rules.status === 200 && rules.data && rules.data.cancelTiers);

  const sailDate = sailDateForCancelTest();
  const slot = await pickSlot(boat.boatId, sailDate);
  ok('时段库存查询', !!slot && !!slot.sailSlotId, JSON.stringify(slot));

  const create = await api('POST', '/bookings', {
    boatId: boat.boatId,
    shipName: boat.shipName,
    coverImage: boat.coverImage,
    price: String(boat.price),
    wharf: boat.wharf,
    departWharf: boat.departWharf,
    date: sailDate,
    people: 2,
    captainName: boat.captain,
    bookingType: 'shared',
    sailSlotId: slot ? slot.sailSlotId : '',
    slotTime: slot ? slot.slotTime : '08:00',
  }, token);
  ok(
    '创建预约',
    (create.status === 201 || create.status === 200) &&
      create.data &&
      create.data.status === 'pending_pay',
    JSON.stringify(create.data),
  );
  const orderId = create.data && create.data.id;
  if (orderId) {
    const pay = await api('PATCH', '/bookings/' + orderId + '/pay', null, token);
    ok('付款后待接单', pay.status === 200 && pay.data && pay.data.status === 'pending_accept');
  }

  const list = await api('GET', '/bookings?page=1&pageSize=20', null, token);
  const items = list.data && list.data.items ? list.data.items : list.data;
  ok('预约列表含新订单', Array.isArray(items) && items.some((o) => o.id === orderId),
    'items=' + (items && items.length));

  if (orderId) {
    const preview = await api('GET', '/bookings/' + orderId + '/cancel-preview', null, token);
    ok('取消预览', preview.status === 200 && preview.data && preview.data.refundPercent != null);

    const detail = await api('GET', '/bookings/' + orderId, null, token);
    ok('订单详情', detail.status === 200 && detail.data && detail.data.cancelInfo);

    const cancel = await api('PATCH', '/bookings/' + orderId + '/cancel', { reason: '测试取消' }, token);
    ok('取消预约', cancel.status === 200 && cancel.data && cancel.data.status === 'cancelled');

    const list2 = await api('GET', '/bookings?status=cancelled', null, token);
    const items2 = list2.data && list2.data.items ? list2.data.items : list2.data;
    ok('取消后可在已取消列表看到', Array.isArray(items2) && items2.some((o) => o.id === orderId));
  }

  const slot2 = slot || (await pickSlot(boat.boatId, sailDate));
  const create2 = await api('POST', '/bookings', {
    boatId: boat.boatId,
    shipName: boat.shipName,
    date: sailDate,
    people: 1,
    bookingType: 'shared',
    sailSlotId: slot2 ? slot2.sailSlotId : '',
    slotTime: slot2 ? slot2.slotTime : '08:00',
  }, token);
  ok('再次预约', create2.status === 200 || create2.status === 201);
  const orderId2 = create2.data && create2.data.id;

  if (orderId2 && slot2) {
    const dup = await api('POST', '/bookings', {
      boatId: boat.boatId,
      shipName: boat.shipName,
      date: sailDate,
      people: 1,
      bookingType: 'shared',
      sailSlotId: slot2.sailSlotId,
      slotTime: slot2.slotTime,
    }, token);
    ok('同天同时段防重复', dup.status === 400, JSON.stringify(dup.data));
  }

  return orderId2;
}

async function testUser2Event(token, competition) {
  console.log('\n[用户2 · 赛事报名]');
  const legacyId = competition.id;
  const reg = await api('POST', '/competitions/' + legacyId + '/register', {
    realName: '测试乙',
    phone: '13800138002',
    people: 2,
    emergencyContact: '紧急联系人',
    remark: 'e2e测试',
  }, token);
  ok('赛事报名', reg.status === 201 || reg.status === 200 || reg.status === 400,
    JSON.stringify(reg.data));

  const dup = await api('POST', '/competitions/' + legacyId + '/register', {
    realName: '测试乙',
    phone: '13800138002',
    people: 1,
  }, token);
  ok('重复报名应拒绝', dup.status === 400);

  const list = await api('GET', '/competitions/my/registrations?page=1&pageSize=20', null, token);
  const items = list.data && list.data.items ? list.data.items : list.data;
  ok('报名列表有记录', Array.isArray(items) && items.length >= 1,
    'total=' + (list.data && list.data.total));
}

async function testUser3SpotFav(token, spot) {
  console.log('\n[用户3 · 钓点收藏]');
  const spotKey = spot.id;
  const add = await api('POST', '/favorites/' + encodeURIComponent(spotKey), null, token);
  ok('收藏钓点', add.status === 201 || add.status === 200);

  const list = await api('GET', '/favorites?page=1&pageSize=20', null, token);
  const items = list.data && list.data.items ? list.data.items : list.data;
  ok('收藏列表含钓点', Array.isArray(items) && items.some((s) => s.id === spotKey),
    'count=' + (items && items.length));

  const del = await api('DELETE', '/favorites/' + encodeURIComponent(spotKey), null, token);
  ok('取消收藏钓点', del.status === 200);

  const list2 = await api('GET', '/favorites', null, token);
  const items2 = list2.data && list2.data.items ? list2.data.items : list2.data;
  const empty = !Array.isArray(items2) || !items2.some((s) => s.id === spotKey);
  ok('取消后列表无该钓点', empty);
}

async function testUser4BoatFav(token, boat) {
  console.log('\n[用户4 · 船只收藏与评价]');
  const boatId = boat.boatId;
  const add = await api('POST', '/boats/' + encodeURIComponent(boatId) + '/favorite', null, token);
  ok('收藏船只', add.status === 201 || add.status === 200);

  const check = await api('GET', '/boats/' + encodeURIComponent(boatId) + '/favorite', null, token);
  ok('收藏状态为 true', check.status === 200 && check.data && check.data.favorited === true);

  const list = await api('GET', '/boats/favorites/me?page=1&pageSize=20', null, token);
  const items = list.data && list.data.items ? list.data.items : list.data;
  ok('我的收藏船只列表', Array.isArray(items) && items.length >= 1);

  const review = await api('POST', '/boats/' + encodeURIComponent(boatId) + '/reviews', {
    content: 'E2E测试评价，船很稳',
    score: 5,
  }, token);
  ok('提交评价', review.status === 201 || review.status === 200, JSON.stringify(review.data));

  const reviews = await api('GET', '/boats/' + encodeURIComponent(boatId) + '/reviews', null, token);
  ok('评价列表', reviews.status === 200 && Array.isArray(reviews.data) && reviews.data.length >= 1);

  const del = await api('DELETE', '/boats/' + encodeURIComponent(boatId) + '/favorite', null, token);
  ok('取消收藏船只', del.status === 200);
}

async function testUser5Rewards(token) {
  console.log('\n[用户5 · 签到与积分]');
  const checkIn1 = await api('POST', '/users/me/check-in', null, token);
  ok('首次签到', checkIn1.status === 201 || checkIn1.status === 200 || checkIn1.status === 400,
    JSON.stringify(checkIn1.data));

  const checkIn2 = await api('POST', '/users/me/check-in', null, token);
  ok('重复签到应提示', checkIn2.status === 400 || (checkIn2.data && checkIn2.data.message));

  const rewards = await api('GET', '/users/me/rewards?page=1&pageSize=20', null, token);
  ok('积分明细', rewards.status === 200);
  const items = rewards.data && rewards.data.items ? rewards.data.items : rewards.data;
  ok('积分明细有记录', Array.isArray(items) ? items.length >= 1 : true,
    JSON.stringify(rewards.data).slice(0, 120));
}

async function testCompetitionTools(token, legacyId) {
  console.log('\n[赛事工具 · 测鱼/称重/排行]');
  const measure = await api('POST', '/competitions/' + legacyId + '/measure', {
    fishSpecies: '黄鱼',
    fishLengthCm: 45,
  }, token);
  ok('提交测鱼', measure.status === 201 || measure.status === 200, JSON.stringify(measure.data));

  const weight = await api('POST', '/competitions/' + legacyId + '/weight', {
    species: '黄鱼',
    weightKg: 3.2,
    remark: 'e2e',
  }, token);
  ok('提交称重', weight.status === 201 || weight.status === 200, JSON.stringify(weight.data));

  const score = await api('GET', '/competitions/my/score?legacyId=' + legacyId, null, token);
  ok('我的成绩', score.status === 200 && score.data);

  const ranking = await api('GET', '/competitions/' + legacyId + '/ranking');
  ok('排行榜', ranking.status === 200 && Array.isArray(ranking.data));

  const feedback = await api('POST', '/competitions/feedback', {
    type: 'appeal',
    competitionId: String(legacyId),
    content: 'e2e测试申诉',
  }, token);
  ok('提交申诉', feedback.status === 201 || feedback.status === 200, JSON.stringify(feedback.data));
}

async function testSyncBatch(token, boat) {
  console.log('\n[批量同步本地订单]');
  const sync = await api('POST', '/bookings/sync-batch', {
    items: [{
      boatId: boat.boatId,
      shipName: boat.shipName,
      date: tomorrow(),
      people: 1,
      status: 'pending_pay',
    }],
  }, token);
  ok('sync-batch', sync.status === 201 || sync.status === 200, JSON.stringify(sync.data));
}

async function testAdmin() {
  console.log('\n[管理后台]');
  const login = await api('POST', '/admin/auth/login', {
    username: process.env.ADMIN_USERNAME || 'admin',
    password: process.env.ADMIN_PASSWORD || 'admin123',
  });
  ok('管理员登录', login.status === 200 || login.status === 201, JSON.stringify(login.data));
  const adminToken = login.data && login.data.token;
  if (!adminToken) return;

  const bookings = await api('GET', '/admin/bookings?page=1&pageSize=10', null, adminToken);
  ok('管理端订单列表', bookings.status === 200);

  const boats = await api('GET', '/admin/boats?page=1&pageSize=10', null, adminToken);
  ok('管理端船只列表', boats.status === 200);
}

async function testIsolation(tokens) {
  console.log('\n[多账号数据隔离]');
  const list1 = await api('GET', '/bookings', null, tokens[0]);
  const list2 = await api('GET', '/bookings', null, tokens[1]);
  const items1 = list1.data && list1.data.items ? list1.data.items : list1.data || [];
  const items2 = list2.data && list2.data.items ? list2.data.items : list2.data || [];
  const ids1 = items1.map((o) => o.id);
  const ids2 = items2.map((o) => o.id);
  const overlap = ids1.filter((id) => ids2.indexOf(id) >= 0);
  ok('两用户订单 ID 无交叉', overlap.length === 0,
    'overlap=' + overlap.length + ' u1=' + items1.length + ' u2=' + items2.length);
}

async function main() {
  console.log('SeaFishing E2E · 5 账号测试');
  console.log('API:', BASE);

  const pub = await testPublic();
  const sessions = [];

  for (const user of USERS) {
    const session = await login(user);
    if (!session || !session.token) continue;
    sessions.push({ user, token: session.token });
  }

  ok('5 个账号全部登录成功', sessions.length === 5, 'got ' + sessions.length);

  if (sessions[0]) await testUser1Booking(sessions[0].token, pub.boat);
  if (sessions[1]) await testUser2Event(sessions[1].token, pub.competition);
  if (sessions[2]) await testUser3SpotFav(sessions[2].token, pub.spot);
  if (sessions[3]) await testUser4BoatFav(sessions[3].token, pub.boat);
  if (sessions[4]) {
    await testUser5Rewards(sessions[4].token);
    const comp2 = (await api('GET', '/competitions')).data;
    const secondComp = Array.isArray(comp2) && comp2.length > 1 ? comp2[1] : pub.competition;
    const reg2 = await api('POST', '/competitions/' + secondComp.id + '/register', {
      realName: '测试戊',
      phone: '13800138005',
      people: 1,
    }, sessions[4].token);
    ok('用户5报名第二场赛事', reg2.status === 200 || reg2.status === 201 || reg2.status === 400,
      JSON.stringify(reg2.data));
    await testCompetitionTools(sessions[4].token, secondComp.id);
  }

  if (sessions[3]) await testSyncBatch(sessions[3].token, pub.boat);

  if (sessions[0] && sessions[1]) {
    await testIsolation([sessions[0].token, sessions[1].token]);
  }

  await testAdmin();

  console.log('\n========== 结果 ==========');
  console.log('通过:', results.pass);
  console.log('失败:', results.fail);
  if (results.errors.length) {
    console.log('\n失败项:');
    results.errors.forEach((e) => console.log(' -', e));
  }
  await prisma.$disconnect();
  process.exit(results.fail > 0 ? 1 : 0);
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
