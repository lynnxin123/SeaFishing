/**
 * 海钓船预约 & 取消订单全场景 API 测试（5 个 dev:tester 账号）
 * 运行：node scripts/e2e-booking-cancel-full.js
 */
const { PrismaClient } = require('@prisma/client');
const { execSync } = require('child_process');
const path = require('path');

const prisma = new PrismaClient();
const BASE = process.env.API_BASE || 'http://127.0.0.1:3000/api';

const { E2E_USERS } = require('./e2e-users');
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
  const d = new Date(Date.now() + hoursFromNow * 3600000);
  return d;
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
    tokens.push({ ...u, token: res.data.token, userId: dbUser && dbUser.id });
  }
  return tokens;
}

async function getBoat() {
  const res = await api('GET', '/boats?page=1&pageSize=5');
  const items = res.data && res.data.items ? res.data.items : [];
  if (!items.length) throw new Error('无船只数据');
  return items[0];
}

async function getSecondBoat(firstBoatId) {
  const res = await api('GET', '/boats?page=1&pageSize=10');
  const items = res.data && res.data.items ? res.data.items : [];
  return items.find((b) => b.boatId !== firstBoatId) || items[1] || items[0];
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

async function pickAltSlot(boatId, date, excludeId) {
  const res = await api(
    'GET',
    '/bookings/slots/availability?boatId=' +
      encodeURIComponent(boatId) +
      '&date=' +
      encodeURIComponent(date),
  );
  const slots = res.data && res.data.slots ? res.data.slots : [];
  return slots.find((s) => s.availableShared && s.sailSlotId !== excludeId) || null;
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
      bookingType: 'shared',
      sailSlotId: slot.sailSlotId,
      slotTime: slot.slotTime,
    },
    token,
  );
  const orderId = res.data && res.data.id;
  if (!orderId || !(res.status === 200 || res.status === 201)) {
    return res;
  }

  const shouldPay = extra.pendingPayOnly ? false : extra.paid !== false;
  if (shouldPay || extra.status === 'pending_accept') {
    const paid = await api('PATCH', '/bookings/' + orderId + '/pay', null, token);
    if (paid.status === 200 && paid.data) {
      res.data = paid.data;
    }
    return res;
  }

  if (extra.status && extra.status !== 'pending_pay') {
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

async function getInventory(boatBusinessId, sailSlotId, sailDate) {
  const boat = await prisma.boat.findFirst({ where: { boatId: boatBusinessId } });
  if (!boat) return null;
  return prisma.slotInventory.findFirst({
    where: { boatId: boat.id, sailSlotId, sailDate },
  });
}

async function runRefundTierTests(tokens, boat) {
  const cat = '一、退款规则';
  const user = tokens[0];
  const tiers = [
    { hours: 80, pct: 100, label: '72h以上全额' },
    { hours: 60, pct: 50, label: '48-72h退50%' },
    { hours: 36, pct: 20, label: '24-48h退20%' },
  ];

  for (let i = 0; i < tiers.length; i++) {
    const t = tiers[i];
    const date = dateStr(10 + i);
    const slot = await pickSlot(boat.boatId, date);
    if (!slot) {
      log(cat, t.label, false, '无可用时段');
      continue;
    }
    const before = await getInventory(boat.boatId, slot.sailSlotId, date);
    const bookedBefore = before ? before.bookedPeople : 0;

    const created = await createBooking(user.token, boat, date, slot);
    const orderId = created.data && created.data.id;
    log(cat, t.label + ' · 创建订单', (created.status === 200 || created.status === 201) && orderId);

    if (!orderId) continue;
    await setDepartureAt(orderId, isoAt(t.hours));

    const preview = await api('GET', '/bookings/' + orderId + '/cancel-preview', null, user.token);
    const pct = preview.data && preview.data.refundPercent;
    log(cat, t.label + ' · 退款比例', pct === t.pct, 'got ' + pct);

    const cancel = await api('PATCH', '/bookings/' + orderId + '/cancel', { reason: '测试' }, user.token);
    log(cat, t.label + ' · 取消成功', cancel.status === 200 && cancel.data.status === 'cancelled');

    const after = await getInventory(boat.boatId, slot.sailSlotId, date);
    const bookedAfter = after ? after.bookedPeople : 0;
    log(cat, t.label + ' · 库存回滚', bookedAfter === bookedBefore, bookedBefore + '->' + bookedAfter);
  }

  // 临界节点
  const boundaries = [
    { hours: 72.05, pct: 100, name: '临界72h' },
    { hours: 48.05, pct: 50, name: '临界48h' },
    { hours: 24.05, pct: 20, name: '临界24h' },
  ];
  for (const b of boundaries) {
    const date = dateStr(20 + b.hours);
    const slot = await pickSlot(boat.boatId, date);
    if (!slot) {
      log(cat, b.name, false, '无时段');
      continue;
    }
    const created = await createBooking(user.token, boat, date, slot);
    const orderId = created.data && created.data.id;
    if (!orderId) {
      log(cat, b.name, false, '创建失败');
      continue;
    }
    await setDepartureAt(orderId, isoAt(b.hours));
    const preview = await api('GET', '/bookings/' + orderId + '/cancel-preview', null, user.token);
    const pct = preview.data && preview.data.refundPercent;
    const can = preview.data && preview.data.canCancel;
    log(cat, b.name + ' 可取消+比例', can && pct === b.pct, 'can=' + can + ' pct=' + pct);
    await api('PATCH', '/bookings/' + orderId + '/cancel', { reason: '测试' }, user.token);
  }
}

async function runForbiddenCancelTests(tokens, boat) {
  const cat = '二、禁止取消';

  // 24h 内
  const dateNear = dateStr(3);
  const slotNear = await pickSlot(boat.boatId, dateNear);
  if (slotNear) {
    const c = await createBooking(tokens[1].token, boat, dateNear, slotNear);
    const id = c.data && c.data.id;
    if (id) {
      await setDepartureAt(id, isoAt(10));
      const preview = await api('GET', '/bookings/' + id + '/cancel-preview', null, tokens[1].token);
      log(cat, '出航前24h内不可取消', preview.data && !preview.data.canCancel);
      const cancel = await api('PATCH', '/bookings/' + id + '/cancel', {}, tokens[1].token);
      log(cat, '24h内取消被拒绝', cancel.status === 400);
    }
  }

  // 已过出航
  const datePast = dateStr(25);
  const slotPast = await pickSlot(boat.boatId, datePast);
  if (slotPast) {
    const c = await createBooking(tokens[2].token, boat, datePast, slotPast);
    const id = c.data && c.data.id;
    if (id) {
      await setDepartureAt(id, isoAt(-2));
      const preview = await api('GET', '/bookings/' + id + '/cancel-preview', null, tokens[2].token);
      log(cat, '已过出航不可取消', preview.data && !preview.data.canCancel);
      const cancelPast = await api('PATCH', '/bookings/' + id + '/cancel', {}, tokens[2].token);
      log(cat, '已过出航取消被拒', cancelPast.status === 400);
    } else {
      log(cat, '已过出航不可取消', false, '创建失败');
    }
  } else {
    log(cat, '已过出航不可取消', false, '无时段');
  }

  // 已出海/已完成
  const dateDone = dateStr(26);
  const slotDone = await pickSlot(boat.boatId, dateDone);
  if (slotDone) {
    const c = await createBooking(tokens[3].token, boat, dateDone, slotDone);
    const id = c.data && c.data.id;
    if (id) {
      await prisma.booking.update({ where: { id }, data: { status: 'departed' } });
      const preview = await api('GET', '/bookings/' + id + '/cancel-preview', null, tokens[3].token);
      log(cat, '已出海不可取消', preview.data && !preview.data.canCancel);
      const cancel = await api('PATCH', '/bookings/' + id + '/cancel', {}, tokens[3].token);
      log(cat, '已出海取消被拒', cancel.status === 400);

      await prisma.booking.update({ where: { id }, data: { status: 'completed' } });
      const preview2 = await api('GET', '/bookings/' + id + '/cancel-preview', null, tokens[3].token);
      log(cat, '已完成不可取消', preview2.data && !preview2.data.canCancel);
    } else {
      log(cat, '已出海不可取消', false, '创建失败');
    }
  } else {
    log(cat, '已出海不可取消', false, '无时段');
  }

  // 二次取消
  const dateCancel = dateStr(27);
  const slotCancel = await pickSlot(boat.boatId, dateCancel);
  if (slotCancel) {
    const c = await createBooking(tokens[4].token, boat, dateCancel, slotCancel);
    const id = c.data && c.data.id;
    if (id) {
      await setDepartureAt(id, isoAt(100));
      await api('PATCH', '/bookings/' + id + '/cancel', {}, tokens[4].token);
      const again = await api('PATCH', '/bookings/' + id + '/cancel', {}, tokens[4].token);
      log(cat, '已取消订单二次取消拦截', again.status === 400);
    } else {
      log(cat, '已取消订单二次取消拦截', false, '创建失败');
    }
  } else {
    log(cat, '已取消订单二次取消拦截', false, '无时段');
  }

  // 节假日
  const holidayDate = dateStr(40);
  const slotH = await pickSlot(boat.boatId, holidayDate);
  if (slotH) {
    const rules = await prisma.bookingRuleConfig.findUnique({ where: { id: 'default' } });
    const r = rules.rules;
    await prisma.bookingRuleConfig.update({
      where: { id: 'default' },
      data: { rules: { ...r, holidays: [holidayDate] } },
    });
    const c = await createBooking(tokens[1].token, boat, holidayDate, slotH);
    const id = c.data && c.data.id;
    if (id) {
      await setDepartureAt(id, isoAt(100));
      const preview = await api('GET', '/bookings/' + id + '/cancel-preview', null, tokens[1].token);
      log(cat, '节假日订单不可取消', preview.data && !preview.data.canCancel);
    }
    await prisma.bookingRuleConfig.update({
      where: { id: 'default' },
      data: { rules: { ...r, holidays: [] } },
    });
  } else {
    log(cat, '节假日订单不可取消', false, '无时段');
  }
}

async function runSpecialTests(tokens, boat) {
  const cat = '三、特殊业务';
  const user = tokens[2];

  const date = dateStr(8);
  const slot = await pickSlot(boat.boatId, date);
  if (!slot) return;

  const c = await createBooking(user.token, boat, date, slot);
  const id = c.data && c.data.id;
  if (!id) return;

  await setDepartureAt(id, isoAt(10));
  const weather = await api(
    'PATCH',
    '/bookings/' + id + '/cancel',
    { cancelType: 'weather', reason: '海事禁航' },
    user.token,
  );
  log(
    cat,
    '天气/海事取消全额退',
    weather.status === 200 &&
      weather.data.status === 'cancelled' &&
      weather.data.refundPercent === 100,
    JSON.stringify(weather.data).slice(0, 80),
  );

  const stat = await prisma.userBookingStat.findUnique({
    where: { userId: user.userId },
  });
  log(cat, '天气取消不计爽约', !stat || stat.noShowCount === 0);

  const date2 = dateStr(9);
  const slot2 = await pickSlot(boat.boatId, date2);
  if (slot2) {
    const c2 = await createBooking(user.token, boat, date2, slot2);
    const id2 = c2.data && c2.data.id;
    if (id2) {
      await setDepartureAt(id2, isoAt(80));
      await api('PATCH', '/bookings/' + id2 + '/cancel', {}, user.token);
      const rebook = await createBooking(user.token, boat, date2, slot2);
      log(cat, '取消后同船同时段可再约', rebook.status === 200 || rebook.status === 201);
      if (rebook.data && rebook.data.id) {
        await setDepartureAt(rebook.data.id, isoAt(80));
        await api('PATCH', '/bookings/' + rebook.data.id + '/cancel', {}, user.token);
      }
    }
  }
}

async function runDuplicateAndCrossTests(tokens, boat) {
  const cat = '四、防重复&交叉';
  const u1 = tokens[0];
  const u2 = tokens[3];
  const u3 = tokens[4];
  const boat2 = await getSecondBoat(boat.boatId);

  const date = dateStr(12);
  const slot = await pickSlot(boat.boatId, date);
  if (!slot) return;

  const first = await createBooking(u1.token, boat, date, slot);
  const id1 = first.data && first.data.id;
  log(cat, '用户1预约成功', !!id1);

  const dup = await createBooking(u1.token, boat, date, slot);
  log(cat, '同账号同天同时段拦截', dup.status === 400, JSON.stringify(dup.data).slice(0, 100));

  const altDate = dateStr(13);
  const slotA = await pickSlot(boat.boatId, altDate);
  const slotB = slotA ? await pickAltSlot(boat2.boatId, dateStr(14), '') : null;

  if (slotA) {
    const b1 = await createBooking(u1.token, boat, altDate, slotA);
    log(cat, '7天内第2次预约', b1.status === 200 || b1.status === 201);
    const b2 = await createBooking(u1.token, boat2, dateStr(14), slotB || slotA);
    log(cat, '7天内第3次预约应拦截', b2.status === 400, JSON.stringify(b2.data).slice(0, 80));
    if (b1.data && b1.data.id) {
      await setDepartureAt(b1.data.id, isoAt(90));
      await api('PATCH', '/bookings/' + b1.data.id + '/cancel', {}, u1.token);
    }
  }

  const shareDate = dateStr(15);
  const shareSlot = await pickSlot(boat.boatId, shareDate);
  if (shareSlot) {
    const inv0 = await getInventory(boat.boatId, shareSlot.sailSlotId, shareDate);
    const before = inv0 ? inv0.bookedPeople : 0;
    const o2 = await createBooking(u2.token, boat, shareDate, shareSlot, { people: 1 });
    const o3 = await createBooking(u3.token, boat, shareDate, shareSlot, { people: 2 });
    log(cat, '多账号抢占库存', (o2.status === 200 || o2.status === 201) && (o3.status === 200 || o3.status === 201));
    const inv1 = await getInventory(boat.boatId, shareSlot.sailSlotId, shareDate);
    log(cat, '库存扣减正确', inv1 && inv1.bookedPeople === before + 3, before + '+3=' + (inv1 && inv1.bookedPeople));

    if (id1) {
      const cross = await api('PATCH', '/bookings/' + id1 + '/cancel', {}, u2.token);
      log(cat, 'B取消A订单越权拦截', cross.status === 404 || cross.status === 400 || cross.status === 403);
    }

    if (o2.data && o2.data.id) {
      await setDepartureAt(o2.data.id, isoAt(90));
      await api('PATCH', '/bookings/' + o2.data.id + '/cancel', {}, u2.token);
    }
    if (o3.data && o3.data.id) {
      await setDepartureAt(o3.data.id, isoAt(90));
      await api('PATCH', '/bookings/' + o3.data.id + '/cancel', {}, u3.token);
    }
  }
}

async function runBookingWindowTests(tokens, boat) {
  const cat = '五、预约时间窗';
  const user = tokens[0];

  const yesterday = dateStr(-1);
  const pastRes = await api(
    'GET',
    '/bookings/slots/availability?boatId=' +
      encodeURIComponent(boat.boatId) +
      '&date=' +
      encodeURIComponent(yesterday),
  );
  const pastSlots = pastRes.data && pastRes.data.slots ? pastRes.data.slots : [];
  const pastSlot = pastSlots.find((s) => s.slotTime === '08:00') || pastSlots[0];
  log(
    cat,
    '昨日时段标记不可约',
    pastSlot && pastSlot.bookingClosed && !pastSlot.availableShared,
    pastSlot ? pastSlot.bookingClosedReason : '无时段',
  );

  if (pastSlot) {
    const pastBook = await createBooking(user.token, boat, yesterday, pastSlot, {
      pendingPayOnly: true,
    });
    log(
      cat,
      '已过出航时间拦截下单',
      pastBook.status === 400,
      JSON.stringify(pastBook.data).slice(0, 100),
    );
  } else {
    log(cat, '已过出航时间拦截下单', false, '无时段');
  }

  const rulesRow = await prisma.bookingRuleConfig.findUnique({ where: { id: 'default' } });
  const baseRules = rulesRow && rulesRow.rules ? rulesRow.rules : {};
  const tomorrow = dateStr(1);
  await prisma.bookingRuleConfig.update({
    where: { id: 'default' },
    data: { rules: { ...baseRules, minBookingLeadHours: 999 } },
  });

  const cutoffRes = await api(
    'GET',
    '/bookings/slots/availability?boatId=' +
      encodeURIComponent(boat.boatId) +
      '&date=' +
      encodeURIComponent(tomorrow),
  );
  const cutoffSlots =
    cutoffRes.data && cutoffRes.data.slots ? cutoffRes.data.slots : [];
  const cutoffSlot =
    cutoffSlots.find((s) => s.slotTime === '08:00') || cutoffSlots[0];
  log(
    cat,
    '提前量不足时段标记不可约',
    cutoffSlot && cutoffSlot.bookingClosed && !cutoffSlot.availableShared,
    cutoffSlot ? cutoffSlot.bookingClosedReason : '无时段',
  );

  if (cutoffSlot) {
    const cutoffBook = await createBooking(user.token, boat, tomorrow, cutoffSlot, {
      pendingPayOnly: true,
    });
    log(
      cat,
      '提前量不足拦截下单',
      cutoffBook.status === 400,
      JSON.stringify(cutoffBook.data).slice(0, 100),
    );
  } else {
    log(cat, '提前量不足拦截下单', false, '无时段');
  }

  await prisma.bookingRuleConfig.update({
    where: { id: 'default' },
    data: { rules: { ...baseRules, minBookingLeadHours: 2 } },
  });
}

async function runErrorTests(tokens, boat) {
  const cat = '六、异常容错';
  const user = tokens[0];

  const noAuth = await api('PATCH', '/bookings/fake-id/cancel', {});
  log(cat, '未登录取消拦截', noAuth.status === 401);

  const date = dateStr(16);
  const slot = await pickSlot(boat.boatId, date);
  if (!slot) return;

  const c = await createBooking(user.token, boat, date, slot);
  const id = c.data && c.data.id;
  if (!id) return;

  await setDepartureAt(id, isoAt(90));
  const c1 = await api('PATCH', '/bookings/' + id + '/cancel', {}, user.token);
  const c2 = await api('PATCH', '/bookings/' + id + '/cancel', {}, user.token);
  log(cat, '重复点击取消防重', c1.status === 200 && c2.status === 400);

  await prisma.booking.update({ where: { id }, data: { status: 'departed' } });
  const bad = await api('PATCH', '/bookings/' + id + '/cancel', {}, user.token);
  log(cat, '异常状态取消有提示', bad.status === 400 && bad.data && bad.data.message);
}

async function runDetailUiDataTest(tokens, boat) {
  const cat = '七、详情数据';
  const user = tokens[4];
  const date = dateStr(55);
  const slot = await pickSlot(boat.boatId, date);
  if (!slot) {
    log(cat, '已取消订单不展示误导性出航倒计时', false, '无时段');
    return;
  }

  const c = await createBooking(user.token, boat, date, slot);
  const id = c.data && c.data.id;
  if (!id) {
    log(cat, '已取消订单不展示误导性出航倒计时', false, '创建失败');
    return;
  }

  await setDepartureAt(id, isoAt(90));
  await api('PATCH', '/bookings/' + id + '/cancel', {}, user.token);
  const detail = await api('GET', '/bookings/' + id, null, user.token);
  const info = detail.data && detail.data.cancelInfo;
  const hours = info && info.hoursUntilDeparture;
  log(
    cat,
    '已取消订单不展示误导性出航倒计时',
    detail.data.status === 'cancelled' && (hours == null || hours === undefined),
    'hours=' + hours,
  );
}

async function main() {
  console.log('SeaFishing 预约取消全场景测试');
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

  const tokens = await loginAll();
  const boat = await getBoat();

  await runRefundTierTests(tokens, boat);
  await runForbiddenCancelTests(tokens, boat);
  await runSpecialTests(tokens, boat);
  await runDetailUiDataTest(tokens, boat);
  await runDuplicateAndCrossTests(tokens, boat);
  await runBookingWindowTests(tokens, boat);
  await runErrorTests(tokens, boat);

  console.log('\n========== 测试报告 ==========');
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
