/**
 * 安全重置预约测试数据：清空订单/爽约/库存占用，保留表结构与船只/时段配置
 * 运行：node scripts/reset-booking-test-data.js
 */
const { PrismaClient } = require('@prisma/client');
const { E2E_OPENIDS } = require('./e2e-users');
const prisma = new PrismaClient();

async function main() {
  console.log('重置预约测试数据...');

  const deletedMsgs = await prisma.userMessage.deleteMany({
    where: { type: { in: ['payment_reminder', 'booking_accepted'] } },
  });
  console.log('  已删除预约相关消息:', deletedMsgs.count);

  const deletedBookings = await prisma.booking.deleteMany({});
  console.log('  已删除订单:', deletedBookings.count);

  const resetInventory = await prisma.slotInventory.updateMany({
    data: { bookedPeople: 0, bookedOrders: 0, maritimeBlocked: false },
  });
  console.log('  已重置库存行:', resetInventory.count);

  const resetStats = await prisma.userBookingStat.updateMany({
    data: { noShowCount: 0, restrictedUntil: null },
  });
  console.log('  已重置爽约统计:', resetStats.count);

  const rules = await prisma.bookingRuleConfig.findUnique({ where: { id: 'default' } });
  if (rules && rules.rules) {
    const r = rules.rules;
    if (Array.isArray(r.holidays) && r.holidays.length) {
      await prisma.bookingRuleConfig.update({
        where: { id: 'default' },
        data: { rules: { ...r, holidays: [] } },
      });
      console.log('  已清空节假日标记');
    }
  }

  for (let i = 0; i < E2E_OPENIDS.length; i++) {
    const openid = E2E_OPENIDS[i];
    const n = String(i + 1);
    await prisma.user.updateMany({
      where: { openid },
      data: {
        phone: '1380000000' + n,
        wechatId: 'haidia_test_' + n,
      },
    });
  }
  console.log('  已补全测试账号联系方式:', E2E_OPENIDS.join(', '));

  console.log('重置完成（船只、时段、规则配置已保留）');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
