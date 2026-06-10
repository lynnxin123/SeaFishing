/**
 * 仅删除全部预约订单，并重置时段库存占用（避免库存数据不一致）
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const deletedMsgs = await prisma.userMessage.deleteMany({
    where: { type: { in: ['payment_reminder', 'booking_accepted'] } },
  });
  const deleted = await prisma.booking.deleteMany({});
  const inventory = await prisma.slotInventory.updateMany({
    data: { bookedPeople: 0, bookedOrders: 0, maritimeBlocked: false },
  });
  console.log('已删除预约相关消息:', deletedMsgs.count);
  console.log('已删除预约订单:', deleted.count);
  console.log('已重置库存行:', inventory.count);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
