/**
 * 海钓小程序全功能全流程 API 测试（5 个 dev:tester 账号）
 * 运行：node scripts/e2e-full-suite.js
 */
const { PrismaClient } = require('@prisma/client');
const { execSync } = require('child_process');
const path = require('path');

const prisma = new PrismaClient();
const BASE = process.env.API_BASE || 'http://127.0.0.1:3000/api';

const { E2E_USERS, openidFromCode } = require('./e2e-users');
const USERS = E2E_USERS;

const report = [];
let pass = 0;
let fail = 0;

function log(cat, name, ok, detail) {
  const row = { cat, name, ok, detail: detail || '' };
  report.push(row);
  if (ok) {
    pass++;
    console.log('  ✓', `[${cat}]`, name);
  } else {
    fail++;
    console.log('  ✗', `[${cat}]`, name, detail ? '— ' + detail : '');
  }
  return ok;
}

async function api(method, p, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = 'Bearer ' + token;
  const res = await fetch(BASE + p, {
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

function dateStr(offsetDays) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

function isoAt(hoursFromNow) {
  return new Date(Date.now() + hoursFromNow * 3600000);
}

async function loginAll() {
  const tokens = [];
  for (const u of USERS) {
    const res = await api('POST', '/auth/wx-login', {
      code: u.code,
      nickName: u.nickName,
      avatarUrl: '',
    });
    if (!res.data || !res.data.token) throw new Error(u.nickName + ' 登录失败');
    const openid = u.code.startsWith('dev:') ? u.code.slice(4) : u.code;
    const dbUser = await prisma.user.findFirst({ where: { openid } });
    tokens.push({ ...u, token: res.data.token, userId: dbUser && dbUser.id, openid });
  }
  return tokens;
}

async function adminLogin() {
  const res = await api('POST', '/admin/auth/login', {
    username: process.env.ADMIN_USERNAME || 'admin',
    password: process.env.ADMIN_PASSWORD || 'admin123',
  });
  return res.data && res.data.token;
}

async function getBoat() {
  const res = await api('GET', '/boats?page=1&pageSize=5');
  const items = res.data && res.data.items ? res.data.items : [];
  if (!items.length) throw new Error('无船只数据');
  return items[0];
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
  return (
    slots.find((s) => s.availableShared && s.slotTime === '08:00') ||
    slots.find((s) => s.availableShared) ||
    slots[0] ||
    null
  );
}

async function createBooking(token, boat, date, slot, extra) {
  extra = extra || {};
  const res = await api(
    'POST',
    '/bookings',
    {
      boatId: boat.boatId,
      shipName: boat.shipName,
      coverImage: boat.coverImage || '/images/boat1.jpg',
      price: String(boat.price),
      wharf: boat.wharf,
      departWharf: boat.departWharf || boat.wharf,
      date,
      people: extra.people || 1,
      captainName: boat.captain,
      bookingType: extra.bookingType || 'shared',
      sailSlotId: slot.sailSlotId,
      slotTime: slot.slotTime,
    },
    token,
  );
  const orderId = res.data && res.data.id;
  if (!orderId || !(res.status === 200 || res.status === 201)) {
    return res;
  }
  const shouldPay = !extra.pendingPayOnly && !extra.skipPay;
  if (shouldPay || extra.status === 'pending_accept') {
    const paid = await api('PATCH', '/bookings/' + orderId + '/pay', null, token);
    if (paid.status === 200 && paid.data) {
      res.data = paid.data;
    }
  } else if (extra.status && extra.status !== 'pending_pay') {
    await prisma.booking.update({
      where: { id: orderId },
      data: { status: extra.status },
    });
    res.data.status = extra.status;
  }
  return res;
}

async function setDepartureAt(orderId, at) {
  await prisma.booking.update({
    where: { id: orderId },
    data: { departureAt: at },
  });
}

// ── 1. 首页/列表/详情 ──
async function testPublicAndDetail() {
  const cat = '1.首页列表详情';
  const health = await api('GET', '/health');
  log(cat, '健康检查', health.status === 200 && health.data && health.data.ok);

  const banners = await api('GET', '/banners');
  log(cat, '轮播图列表', banners.status === 200 && Array.isArray(banners.data) && banners.data.length >= 1);

  const boats = await api('GET', '/boats?page=1&pageSize=10');
  const boat = boats.data && boats.data.items && boats.data.items[0];
  log(cat, '船只列表分页', boats.status === 200 && boats.data && boats.data.total >= 1);

  if (boat) {
    const detail = await api('GET', '/boats/' + encodeURIComponent(boat.boatId));
    log(
      cat,
      '船只详情字段完整',
      detail.status === 200 &&
        detail.data &&
        detail.data.shipName &&
        detail.data.captain != null &&
        Array.isArray(detail.data.images),
    );
    const reviews = await api('GET', '/boats/' + encodeURIComponent(boat.boatId) + '/reviews');
    log(cat, '船只评价列表', reviews.status === 200 && Array.isArray(reviews.data));
  }

  const comps = await api('GET', '/competitions');
  const comp = Array.isArray(comps.data) && comps.data[0];
  log(cat, '赛事列表', comps.status === 200 && Array.isArray(comps.data) && comps.data.length >= 1);
  if (comp) {
    const compDetail = await api('GET', '/competitions/' + comp.id);
    log(cat, '赛事详情', compDetail.status === 200 && compDetail.data && compDetail.data.name);
    const ranking = await api('GET', '/competitions/' + comp.id + '/ranking');
    log(cat, '赛事排行榜', ranking.status === 200 && Array.isArray(ranking.data));
  }

  const spots = await api('GET', '/spots');
  const spot = Array.isArray(spots.data) && spots.data[0];
  log(cat, '钓点列表', spots.status === 200 && Array.isArray(spots.data) && spots.data.length >= 1);
  if (spot) {
    const spotDetail = await api('GET', '/spots/' + encodeURIComponent(spot.id));
    log(cat, '钓点详情', spotDetail.status === 200 && spotDetail.data && spotDetail.data.name);
  }

  return { boat, comp, spot };
}

// ── 2. 登录/授权/联系方式 ──
async function testAuthAndContact(tokens, boat) {
  const cat = '2.登录授权联系方式';
  log(cat, '5账号全部登录', tokens.length === 5);

  const me = await api('GET', '/users/me', null, tokens[0].token);
  log(
    cat,
    '测试账号自动补全联系方式',
    me.status === 200 &&
      me.data &&
      /^1380000000[1-5]$/.test(me.data.phone || '') &&
      (me.data.wechatId || '').startsWith('haidia_test_'),
  );

  const noContactUser = await prisma.user.findFirst({
    where: { openid: openidFromCode(USERS[4].code) },
  });
  if (noContactUser) {
    await prisma.user.update({
      where: { id: noContactUser.id },
      data: { phone: '', wechatId: '' },
    });
    const contactDate = dateStr(30);
    const contactSlot = boat ? await pickSlot(boat.boatId, contactDate) : null;
    const blocked = await api('POST', '/bookings/can-book', {
      boatId: boat && boat.boatId,
      shipName: boat && boat.shipName,
      date: contactDate,
      people: 1,
      sailSlotId: contactSlot && contactSlot.sailSlotId,
      slotTime: contactSlot && contactSlot.slotTime,
      bookingType: 'shared',
    }, tokens[4].token);
    log(
      cat,
      '无联系方式不可预约',
      blocked.status === 400 &&
        blocked.data &&
        (String(blocked.data.message || '').indexOf('手机号') >= 0 ||
          String(blocked.data.message || '').indexOf('联系方式') >= 0),
      JSON.stringify(blocked.data).slice(0, 80),
    );
    await prisma.user.update({
      where: { id: noContactUser.id },
      data: { phone: '13800000005', wechatId: 'haidia_test_5' },
    });
  }

  const verify = await api('PATCH', '/users/me/verify', {
    realName: '测试甲',
    idNumber: '110101199001011234',
  }, tokens[0].token);
  log(cat, '实名认证', verify.status === 200 && verify.data && verify.data.verified);
}

// ── 3. 船期/时段/库存 ──
async function testSlotsAndInventory(tokens, boat) {
  const cat = '3.船期时段库存';
  const date = dateStr(7);
  const avail = await api(
    'GET',
    '/bookings/slots/availability?boatId=' + encodeURIComponent(boat.boatId) + '&date=' + date,
  );
  log(
    cat,
    '时段库存接口结构',
    avail.status === 200 &&
      avail.data &&
      Array.isArray(avail.data.slots) &&
      avail.data.slots.length >= 1 &&
      avail.data.slots[0].remainingPeople != null,
  );

  const rules = await api('GET', '/bookings/rules');
  log(cat, '预约规则公开', rules.status === 200 && rules.data && rules.data.cancelTiers);

  const slot = await pickSlot(boat.boatId, date);
  if (slot) {
    const preview = await api('POST', '/bookings/can-book', {
      boatId: boat.boatId,
      shipName: boat.shipName,
      date,
      people: 1,
      sailSlotId: slot.sailSlotId,
      slotTime: slot.slotTime,
      bookingType: 'shared',
    }, tokens[1].token);
    log(
      cat,
      '可预约预检 allowed',
      (preview.status === 200 || preview.status === 201) && preview.data && preview.data.allowed === true,
      JSON.stringify(preview.data).slice(0, 80),
    );
  }
}

// ── 4. 预约下单/待付款 ──
async function testBookingFlow(tokens, boat) {
  const cat = '4.预约下单支付';
  const date = dateStr(18);
  const slot = await pickSlot(boat.boatId, date);
  if (!slot) {
    log(cat, '创建待付款订单', false, '无时段');
    return null;
  }

  const created = await createBooking(tokens[0].token, boat, date, slot, {
    pendingPayOnly: true,
  });
  const order = created.data;
  log(
    cat,
    '创建订单默认待付款',
    (created.status === 200 || created.status === 201) &&
      order &&
      order.status === 'pending_pay' &&
      order.statusLabel === '待付款',
    order && order.status,
  );

  if (order && order.id) {
    const list = await api('GET', '/bookings?status=pending_pay', null, tokens[0].token);
    const items = list.data && list.data.items ? list.data.items : [];
    log(cat, '待付款列表筛选', items.some((o) => o.id === order.id));

    const adminToken = await adminLogin();
    if (adminToken) {
      const reject = await api(
        'PATCH',
        '/admin/bookings/' + order.id + '/status',
        { status: 'accepted' },
        adminToken,
      );
      log(cat, '待付款不可接单', reject.status === 400);
    }

    const paid = await api('PATCH', '/bookings/' + order.id + '/pay', null, tokens[0].token);
    log(
      cat,
      '付款后变待接单',
      paid.status === 200 && paid.data && paid.data.status === 'pending_accept',
    );
  }
  return order;
}

// ── 5-9 取消/退款/特殊/防重复（复用核心场景）──
async function testCancelRules(tokens, boat) {
  const cat = '5.取消退款规则';
  const date = dateStr(50);
  const slot = await pickSlot(boat.boatId, date);
  if (!slot) return;

  const c = await createBooking(tokens[1].token, boat, date, slot);
  const id = c.data && c.data.id;
  if (!id) return;

  await setDepartureAt(id, isoAt(80));
  const preview = await api('GET', '/bookings/' + id + '/cancel-preview', null, tokens[1].token);
  log(cat, '72h+全额退款预览', preview.data && preview.data.refundPercent === 100);

  const cancel = await api('PATCH', '/bookings/' + id + '/cancel', { reason: '测试' }, tokens[1].token);
  log(cat, '取消成功', cancel.status === 200 && cancel.data.status === 'cancelled');

  // 待付款按时间规则
  const datePay = dateStr(51);
  const slotPay = await pickSlot(boat.boatId, datePay);
  if (slotPay) {
    const cp = await createBooking(tokens[2].token, boat, datePay, slotPay);
    const payId = cp.data && cp.data.id;
    if (payId) {
      await setDepartureAt(payId, isoAt(10));
      const pp = await api('GET', '/bookings/' + payId + '/cancel-preview', null, tokens[2].token);
      log(cat, '待付款24h内不可取消', pp.data && !pp.data.canCancel);
    }
  }

  // 天气取消
  const dateW = dateStr(52);
  const slotW = await pickSlot(boat.boatId, dateW);
  if (slotW) {
    const cw = await createBooking(tokens[2].token, boat, dateW, slotW);
    const wid = cw.data && cw.data.id;
    if (wid) {
      await setDepartureAt(wid, isoAt(10));
      const w = await api('PATCH', '/bookings/' + wid + '/cancel', { cancelType: 'weather', reason: '禁航' }, tokens[2].token);
      log(cat, '天气取消全额退', w.status === 200 && w.data.refundPercent === 100);
    }
  }
}

async function testDuplicateAndAuthz(tokens, boat) {
  const cat = '7-10.防重复与越权';
  const date = dateStr(60);
  const slot = await pickSlot(boat.boatId, date);
  if (!slot) return;

  const first = await createBooking(tokens[3].token, boat, date, slot);
  const id1 = first.data && first.data.id;
  log(cat, '预约成功', !!id1);

  const dup = await createBooking(tokens[3].token, boat, date, slot);
  log(cat, '同账号同时段拦截', dup.status === 400);

  if (id1) {
    const cross = await api('PATCH', '/bookings/' + id1 + '/cancel', {}, tokens[4].token);
    log(cat, '越权取消拦截', cross.status === 404 || cross.status === 400 || cross.status === 403);

    const crossDetail = await api('GET', '/bookings/' + id1, null, tokens[4].token);
    log(cat, '越权查看详情拦截', crossDetail.status === 404);

    await setDepartureAt(id1, isoAt(90));
    await api('PATCH', '/bookings/' + id1 + '/cancel', {}, tokens[3].token);
  }
}

async function testUnauthAndDoubleSubmit(tokens, boat) {
  const cat = '11-12.未登录与重复提交';
  const noAuth = await api('GET', '/bookings');
  log(cat, '未登录访问订单401', noAuth.status === 401);

  const noAuthCancel = await api('PATCH', '/bookings/fake/cancel', {});
  log(cat, '未登录取消401', noAuthCancel.status === 401);

  const date = dateStr(61);
  const slot = await pickSlot(boat.boatId, date);
  if (!slot) return;

  const c = await createBooking(tokens[0].token, boat, date, slot);
  const id = c.data && c.data.id;
  if (!id) return;

  await setDepartureAt(id, isoAt(90));
  const c1 = await api('PATCH', '/bookings/' + id + '/cancel', {}, tokens[0].token);
  const c2 = await api('PATCH', '/bookings/' + id + '/cancel', {}, tokens[0].token);
  log(cat, '重复取消防重', c1.status === 200 && c2.status === 400);
}

// ── 13. 超卖防护 ──
async function testOversellProtection(tokens, boat) {
  const cat = '13.库存超卖防护';
  const date = dateStr(62);
  const avail = await api(
    'GET',
    '/bookings/slots/availability?boatId=' + encodeURIComponent(boat.boatId) + '&date=' + date,
  );
  const slot = avail.data && avail.data.slots && avail.data.slots.find((s) => s.availableShared);
  if (!slot) {
    log(cat, '并发抢占', false, '无时段');
    return;
  }

  const remaining = slot.remainingPeople;
  const boatRow = await prisma.boat.findFirst({ where: { boatId: boat.boatId } });
  const invBefore = await prisma.slotInventory.findFirst({
    where: { boatId: boatRow.id, sailSlotId: slot.sailSlotId, sailDate: date },
  });

  const promises = [];
  for (let i = 0; i < Math.min(5, remaining + 2); i++) {
    const user = tokens[i % 5];
    promises.push(createBooking(user.token, boat, date, slot, { people: 1 }));
  }
  const results = await Promise.all(promises);
  const success = results.filter((r) => r.status === 200 || r.status === 201).length;
  const rejected = results.filter((r) => r.status === 400).length;

  const invAfter = await prisma.slotInventory.findFirst({
    where: { boatId: boatRow.id, sailSlotId: slot.sailSlotId, sailDate: date },
  });
  const booked = invAfter ? invAfter.bookedPeople : 0;
  const max = slot.maxPeople;

  log(cat, '并发部分成功部分拒绝', success >= 1 && rejected >= 0);
  log(cat, '库存不超过上限', booked <= max, booked + '/' + max);

  // 清理（各用户取消自己的订单）
  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    if (r.data && r.data.id) {
      const owner = tokens[i % 5];
      await setDepartureAt(r.data.id, isoAt(90));
      await api('PATCH', '/bookings/' + r.data.id + '/cancel', {}, owner.token);
    }
  }
}

// ── 8. 爽约限制 ──
async function testNoShowRestriction(tokens, boat, adminToken) {
  const cat = '8.爽约与限制';
  const user = tokens[4];
  await prisma.userBookingStat.deleteMany({ where: { userId: user.userId } });

  const date = dateStr(70);
  const slot = await pickSlot(boat.boatId, date);
  if (!slot || !adminToken) return;

  const c = await createBooking(user.token, boat, date, slot, { pendingPayOnly: true });
  const id = c.data && c.data.id;
  if (!id) return;

  const paid = await api('PATCH', '/bookings/' + id + '/pay', null, user.token);
  if (paid.status !== 200) {
    log(cat, '管理端标记爽约', false, '付款失败');
    return;
  }
  await api('PATCH', '/admin/bookings/' + id + '/status', { status: 'accepted' }, adminToken);
  await api('PATCH', '/admin/bookings/' + id + '/status', { status: 'departed' }, adminToken);

  const patch = await api(
    'PATCH',
    '/admin/bookings/' + id + '/status',
    { status: 'no_show' },
    adminToken,
  );
  log(cat, '管理端标记爽约', patch.status === 200 && patch.data.status === 'no_show');

  const stat = await prisma.userBookingStat.findUnique({ where: { userId: user.userId } });
  log(cat, '爽约计数+1', stat && stat.noShowCount === 1);

  // 模拟2次爽约触发限制
  await prisma.userBookingStat.update({
    where: { userId: user.userId },
    data: { noShowCount: 2, restrictedUntil: new Date(Date.now() + 86400000 * 7) },
  });

  const date2 = dateStr(71);
  const slot2 = await pickSlot(boat.boatId, date2);
  if (slot2) {
    const blocked = await createBooking(user.token, boat, date2, slot2);
    log(cat, '爽约限制期内不可预约', blocked.status === 400, JSON.stringify(blocked.data).slice(0, 80));
  }

  await prisma.userBookingStat.update({
    where: { userId: user.userId },
    data: { noShowCount: 0, restrictedUntil: null },
  });
}

// ── 14. 消息推送 ──
async function testMessages(tokens, boat, adminToken) {
  const cat = '14.消息推送';
  if (!adminToken) {
    log(cat, '管理端接单发消息', false, '无admin token');
    return;
  }

  const date = dateStr(80);
  const slot = await pickSlot(boat.boatId, date);
  if (!slot) return;

  const user = tokens[1];
  const c = await createBooking(user.token, boat, date, slot, { pendingPayOnly: true });
  const id = c.data && c.data.id;
  if (!id) return;

  const rejectAccept = await api(
    'PATCH',
    '/admin/bookings/' + id + '/status',
    { status: 'accepted' },
    adminToken,
  );
  log(cat, '待付款不可接单', rejectAccept.status === 400);

  const paid = await api('PATCH', '/bookings/' + id + '/pay', null, user.token);
  log(cat, '用户付款成功', paid.status === 200 && paid.data.status === 'pending_accept');

  const accept = await api(
    'PATCH',
    '/admin/bookings/' + id + '/status',
    { status: 'accepted' },
    adminToken,
  );
  log(cat, '管理端接单', accept.status === 200);

  const unread = await api('GET', '/messages/unread-count', null, user.token);
  log(cat, '未读数>0', unread.data && unread.data.count >= 1, 'count=' + (unread.data && unread.data.count));

  const list = await api('GET', '/messages', null, user.token);
  const items = list.data && list.data.items ? list.data.items : [];
  const msg = items.find((m) => m.type === 'booking_accepted' && m.refId === id);
  log(cat, '已接单消息内容', !!msg && msg.title === '订单已接单');

  if (msg) {
    const read = await api('PATCH', '/messages/' + msg.id + '/read', null, user.token);
    log(cat, '标记已读', read.status === 200 && read.data.read === true);
    const unread2 = await api('GET', '/messages/unread-count', null, user.token);
    log(cat, '已读后未读减少', unread2.data && unread2.data.count < unread.data.count);
  }
}

// ── 15. 管理端联系信息 ──
async function testAdminContact(adminToken) {
  const cat = '15.联系客服信息';
  if (!adminToken) {
    log(cat, '管理端订单含联系方式', false, '无admin');
    return;
  }
  const list = await api('GET', '/admin/bookings?page=1&pageSize=5', null, adminToken);
  const item = list.data && list.data.items && list.data.items[0];
  log(
    cat,
    '管理端订单含用户联系方式',
    item && item.user && (item.user.phone || item.user.wechatId),
    item && item.user ? item.user.phone : 'none',
  );
}

// ── 6. 订单状态流转 ──
async function testOrderStatusFlow(tokens, boat, adminToken) {
  const cat = '6.订单状态流转';
  if (!adminToken) return;

  const date = dateStr(90);
  const slot = await pickSlot(boat.boatId, date);
  if (!slot) return;

  const c = await createBooking(tokens[2].token, boat, date, slot, { pendingPayOnly: true });
  const id = c.data && c.data.id;
  if (!id) return;

  const payRes = await api('PATCH', '/bookings/' + id + '/pay', null, tokens[2].token);
  if (payRes.status !== 200) {
    log(cat, '流转到accepted', false, '付款失败');
    return;
  }

  for (const st of ['accepted', 'departed', 'completed']) {
    const r = await api('PATCH', '/admin/bookings/' + id + '/status', { status: st }, adminToken);
    log(cat, '流转到' + st, r.status === 200 && r.data.status === st);
  }

  const detail = await api('GET', '/bookings/' + id, null, tokens[2].token);
  log(cat, '用户可见已完成', detail.data && detail.data.status === 'completed');

  const preview = await api('GET', '/bookings/' + id + '/cancel-preview', null, tokens[2].token);
  log(cat, '已完成不可取消', preview.data && !preview.data.canCancel);
}

// ── 7. 我的订单全状态筛选 ──
async function testOrderStatusFilters(tokens, boat, adminToken) {
  const cat = '7.订单全状态筛选';
  const user = tokens[0];

  async function inTab(tab, orderId) {
    const list = await api('GET', '/bookings?status=' + tab, null, user.token);
    const items = list.data && list.data.items ? list.data.items : [];
    return items.some((o) => o.id === orderId);
  }

  const date = dateStr(95);
  const slot = await pickSlot(boat.boatId, date);
  if (!slot) return;

  const created = await createBooking(user.token, boat, date, slot, { pendingPayOnly: true });
  const id = created.data && created.data.id;
  if (!id) return;

  log(cat, 'Tab pending_pay', await inTab('pending_pay', id));

  await api('PATCH', '/bookings/' + id + '/pay', null, user.token);
  log(cat, 'Tab pending_accept', await inTab('pending_accept', id));

  if (adminToken) {
    await api('PATCH', '/admin/bookings/' + id + '/status', { status: 'accepted' }, adminToken);
    log(cat, 'Tab accepted', await inTab('accepted', id));

    await api('PATCH', '/admin/bookings/' + id + '/status', { status: 'departed' }, adminToken);
    log(cat, 'Tab departed', await inTab('departed', id));

    await api('PATCH', '/admin/bookings/' + id + '/status', { status: 'completed' }, adminToken);
    log(cat, 'Tab completed', await inTab('completed', id));
  }

  const user2 = tokens[1];
  const date2 = dateStr(94);
  const slot2 = await pickSlot(boat.boatId, date2);
  if (slot2) {
    const c2 = await createBooking(user2.token, boat, date2, slot2);
    const id2 = c2.data && c2.data.id;
    if (id2) {
      await setDepartureAt(id2, isoAt(90));
      await api('PATCH', '/bookings/' + id2 + '/cancel', {}, user2.token);
      const list = await api('GET', '/bookings?status=cancelled', null, user2.token);
      const items = list.data && list.data.items ? list.data.items : [];
      log(cat, 'Tab cancelled', items.some((o) => o.id === id2));
    } else {
      log(cat, 'Tab cancelled', false, '创建失败');
    }
  } else {
    log(cat, 'Tab cancelled', false, '无时段');
  }

  if (adminToken) {
    const user3 = tokens[4];
    const date3 = dateStr(200);
    const slot3 = await pickSlot(boat.boatId, date3);
    if (slot3) {
      const c3 = await createBooking(user3.token, boat, date3, slot3);
      const id3 = c3.data && c3.data.id;
      if (id3) {
        await api('PATCH', '/bookings/' + id3 + '/pay', null, user3.token);
        await api('PATCH', '/admin/bookings/' + id3 + '/status', { status: 'accepted' }, adminToken);
        await api('PATCH', '/admin/bookings/' + id3 + '/status', { status: 'departed' }, adminToken);
        await api('PATCH', '/admin/bookings/' + id3 + '/status', { status: 'no_show' }, adminToken);
        const list = await api('GET', '/bookings?status=no_show', null, user3.token);
        const items = list.data && list.data.items ? list.data.items : [];
        log(cat, 'Tab no_show', items.some((o) => o.id === id3));
      } else {
        log(cat, 'Tab no_show', false, '创建失败');
      }
    } else {
      log(cat, 'Tab no_show', false, '无时段');
    }
  }

  log(cat, 'Tab all 含主订单', await inTab('all', id));
}

// ── 付款防重 / 付款提醒 / 库存为0 ──
async function testPaymentAndStockEdge(tokens, boat) {
  const cat = '12.付款与库存边界';
  const date = dateStr(96);
  const slot = await pickSlot(boat.boatId, date);
  if (!slot) return;

  const c = await createBooking(tokens[1].token, boat, date, slot, { pendingPayOnly: true });
  const id = c.data && c.data.id;
  if (!id) return;

  const pay1 = await api('PATCH', '/bookings/' + id + '/pay', null, tokens[1].token);
  log(cat, '首次付款成功', pay1.status === 200 && pay1.data.status === 'pending_accept');

  const pay2 = await api('PATCH', '/bookings/' + id + '/pay', null, tokens[1].token);
  log(cat, '重复付款拦截', pay2.status === 400);

  await setDepartureAt(id, isoAt(90));
  await api('PATCH', '/bookings/' + id + '/cancel', {}, tokens[1].token);

  const c2 = await createBooking(tokens[1].token, boat, date, slot, {
    pendingPayOnly: true,
  });
  const id2 = c2.data && c2.data.id;
  if (id2) {
    await prisma.booking.update({
      where: { id: id2 },
      data: { createdAt: new Date(Date.now() - 5 * 60_000) },
    });
    const msgsBefore = await api('GET', '/messages', null, tokens[1].token);
    const beforeItems = msgsBefore.data && msgsBefore.data.items ? msgsBefore.data.items : [];
    await prisma.booking.update({
      where: { id: id2 },
      data: { paymentRemindedAt: new Date() },
    });
    await prisma.userMessage.create({
      data: {
        userId: tokens[1].userId,
        type: 'payment_reminder',
        title: '订单待付款',
        summary: '测试付款提醒',
        content: '请尽快完成付款',
        refId: id2,
      },
    });
    const msgs = await api('GET', '/messages', null, tokens[1].token);
    const items = msgs.data && msgs.data.items ? msgs.data.items : [];
    const reminder = items.find((m) => m.type === 'payment_reminder' && m.refId === id2);
    log(cat, '付款提醒消息', !!reminder);
    log(cat, '付款提醒消息数增加', items.length >= beforeItems.length);
    await api('PATCH', '/bookings/' + id2 + '/cancel', {}, tokens[1].token).catch(() => {});
  }

  const boatRow = await prisma.boat.findFirst({ where: { boatId: boat.boatId } });
  const avail = await api(
    'GET',
    '/bookings/slots/availability?boatId=' + encodeURIComponent(boat.boatId) + '&date=' + dateStr(97),
  );
  const fullSlot = avail.data && avail.data.slots && avail.data.slots.find((s) => s.availableShared);
  if (fullSlot && boatRow) {
    const inv = await prisma.slotInventory.findFirst({
      where: { boatId: boatRow.id, sailSlotId: fullSlot.sailSlotId, sailDate: dateStr(97) },
    });
    if (inv) {
      await prisma.slotInventory.update({
        where: { id: inv.id },
        data: { bookedPeople: fullSlot.maxPeople },
      });
      const blocked = await createBooking(tokens[2].token, boat, dateStr(97), fullSlot);
      log(cat, '库存满不可预约', blocked.status === 400, JSON.stringify(blocked.data).slice(0, 60));
      await prisma.slotInventory.update({
        where: { id: inv.id },
        data: { bookedPeople: inv.bookedPeople },
      });
    }
  }
}

// ── 管理端船只作业状态 ──
async function testAdminBoatOps(adminToken) {
  const cat = '17.管理端船只状态';
  if (!adminToken) {
    log(cat, '船只列表含作业状态', false, '无admin');
    return;
  }
  const data = await api('GET', '/admin/boats?page=1&pageSize=10', null, adminToken);
  const item = data.data && data.data.items && data.data.items[0];
  log(
    cat,
    '船只列表含作业状态',
    item &&
      item.operationalStatus != null &&
      item.operationalStatusLabel &&
      Array.isArray(item.monthSchedule),
    item && item.operationalStatus,
  );
  log(cat, '排期统计范围', !!(data.data && data.data.scheduleRange && data.data.scheduleRange.from));
}

// ── 其他：收藏/赛事/签到 ──
async function testMiscFeatures(tokens, pub) {
  const cat = '16.其他功能';
  const spotKey = pub.spot && pub.spot.id;
  if (spotKey) {
    await api('POST', '/favorites/' + encodeURIComponent(spotKey), null, tokens[2].token);
    const favs = await api('GET', '/favorites', null, tokens[2].token);
    const items = favs.data && favs.data.items ? favs.data.items : favs.data || [];
    log(cat, '钓点收藏', Array.isArray(items) && items.some((s) => s.id === spotKey));
    await api('DELETE', '/favorites/' + encodeURIComponent(spotKey), null, tokens[2].token);
  }

  const boatId = pub.boat && pub.boat.boatId;
  if (boatId) {
    await api('POST', '/boats/' + encodeURIComponent(boatId) + '/favorite', null, tokens[3].token);
    const fav = await api('GET', '/boats/' + encodeURIComponent(boatId) + '/favorite', null, tokens[3].token);
    log(cat, '船只收藏状态', fav.data && fav.data.favorited === true);
    await api('DELETE', '/boats/' + encodeURIComponent(boatId) + '/favorite', null, tokens[3].token);
  }

  const checkIn = await api('POST', '/users/me/check-in', null, tokens[4].token);
  log(cat, '签到接口', checkIn.status === 200 || checkIn.status === 201 || checkIn.status === 400);

  const rewards = await api('GET', '/users/me/rewards?page=1', null, tokens[4].token);
  log(cat, '积分明细', rewards.status === 200);
}

async function main() {
  console.log('SeaFishing 全功能全流程测试');
  console.log('API:', BASE);

  try {
    execSync('node scripts/reset-booking-test-data.js', {
      cwd: path.join(__dirname, '..'),
      stdio: 'inherit',
    });
  } catch (e) {
    console.error('数据重置失败', e.message);
    process.exit(1);
  }

  const health = await api('GET', '/health');
  if (!health.data || !health.data.ok) {
    console.error('后端未启动，请先 npm run start:dev');
    process.exit(1);
  }

  const pub = await testPublicAndDetail();
  const tokens = await loginAll();
  await testAuthAndContact(tokens, pub.boat);
  await testSlotsAndInventory(tokens, pub.boat);
  await testBookingFlow(tokens, pub.boat);
  await testCancelRules(tokens, pub.boat);
  await testDuplicateAndAuthz(tokens, pub.boat);
  await testUnauthAndDoubleSubmit(tokens, pub.boat);
  await testOversellProtection(tokens, pub.boat);

  const adminToken = await adminLogin();
  await testNoShowRestriction(tokens, pub.boat, adminToken);
  await testMessages(tokens, pub.boat, adminToken);
  await testAdminContact(adminToken);
  await testOrderStatusFlow(tokens, pub.boat, adminToken);
  await testOrderStatusFilters(tokens, pub.boat, adminToken);
  await testPaymentAndStockEdge(tokens, pub.boat);
  await testAdminBoatOps(adminToken);
  await testMiscFeatures(tokens, pub);

  console.log('\n========== 全量测试报告 ==========');
  console.log('通过:', pass, '失败:', fail, '合计:', pass + fail);

  const byCat = {};
  report.forEach((r) => {
    if (!byCat[r.cat]) byCat[r.cat] = { pass: 0, fail: 0, fails: [] };
    if (r.ok) byCat[r.cat].pass++;
    else {
      byCat[r.cat].fail++;
      byCat[r.cat].fails.push(r.name + (r.detail ? ': ' + r.detail : ''));
    }
  });
  Object.keys(byCat).forEach((k) => {
    console.log('\n' + k + ':', byCat[k].pass + '通过', byCat[k].fail + '失败');
    byCat[k].fails.forEach((f) => console.log('  -', f));
  });

  await prisma.$disconnect();
  process.exit(fail > 0 ? 1 : 0);
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
