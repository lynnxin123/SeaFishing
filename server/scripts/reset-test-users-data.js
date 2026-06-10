/**
 * 清空 5 个开发测试账号（tester1~tester5）及全部关联数据
 * 账号下次 dev 登录会自动重建，联系方式自动补全
 * 运行：node scripts/reset-test-users-data.js
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const { E2E_OPENIDS } = require('./e2e-users');
const TESTER_OPENIDS = E2E_OPENIDS.concat([
  'tester1',
  'tester2',
  'tester3',
  'tester4',
  'tester5',
]);

async function deleteByUserIds(label, fn) {
  const userIds = await prisma.user
    .findMany({
      where: { openid: { in: TESTER_OPENIDS } },
      select: { id: true },
    })
    .then((rows) => rows.map((r) => r.id));

  if (!userIds.length) {
    console.log('  ' + label + ': 0（无测试账号）');
    return 0;
  }
  const result = await fn(userIds);
  const count = result.count != null ? result.count : result;
  console.log('  ' + label + ':', count);
  return count;
}

async function main() {
  console.log('清空测试账号及关联数据...');

  const users = await prisma.user.findMany({
    where: { openid: { in: TESTER_OPENIDS } },
    select: { id: true, openid: true, nickName: true },
  });

  if (!users.length) {
    console.log('  未找到测试账号 (test01~05 / tester1~5)');
    return;
  }

  const userIds = users.map((u) => u.id);

  const bookings = await prisma.booking.deleteMany({
    where: { userId: { in: userIds } },
  });
  console.log('  已删除预约订单:', bookings.count);

  const regs = await prisma.competitionRegistration.deleteMany({
    where: { userId: { in: userIds } },
  });
  console.log('  已删除赛事报名:', regs.count);

  const measures = await prisma.competitionMeasureRecord.deleteMany({
    where: { userId: { in: userIds } },
  });
  const weights = await prisma.competitionWeightRecord.deleteMany({
    where: { userId: { in: userIds } },
  });
  const rankings = await prisma.competitionRanking.deleteMany({
    where: { userId: { in: userIds } },
  });
  const feedbacks = await prisma.competitionFeedback.deleteMany({
    where: { userId: { in: userIds } },
  });
  console.log(
    '  已删除测鱼/称重/排行/反馈:',
    measures.count,
    weights.count,
    rankings.count,
    feedbacks.count,
  );

  const messages = await prisma.userMessage.deleteMany({
    where: { userId: { in: userIds } },
  });
  console.log('  已删除站内消息:', messages.count);

  const rewards = await prisma.rewardLog.deleteMany({
    where: { userId: { in: userIds } },
  });
  console.log('  已删除积分明细:', rewards.count);

  const mapFav = await prisma.mapFavorite.deleteMany({
    where: { userId: { in: userIds } },
  });
  const boatFav = await prisma.boatFavorite.deleteMany({
    where: { userId: { in: userIds } },
  });
  const reviews = await prisma.boatReview.deleteMany({
    where: { userId: { in: userIds } },
  });
  console.log('  已删除钓点/船只收藏与评价:', mapFav.count, boatFav.count, reviews.count);

  const stats = await prisma.userBookingStat.deleteMany({
    where: { userId: { in: userIds } },
  });
  console.log('  已删除爽约统计:', stats.count);

  for (const u of users) {
    await prisma.user.delete({ where: { id: u.id } });
    console.log('  已删除账号:', u.openid, u.nickName || '');
  }

  const inventory = await prisma.slotInventory.updateMany({
    data: { bookedPeople: 0, bookedOrders: 0, maritimeBlocked: false },
  });
  console.log('  已重置时段库存行:', inventory.count);

  console.log('完成。测试账号已删除，旧 token 已失效');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
