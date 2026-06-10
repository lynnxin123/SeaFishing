/**
 * 清理「订单已不存在或状态已变」的预约类消息
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const BOOKING_MSG_TYPES = ['payment_reminder', 'booking_accepted'];
const ACCEPTED_STATUSES = ['accepted', 'departed', 'completed'];

async function main() {
  const msgs = await prisma.userMessage.findMany({
    where: {
      type: { in: BOOKING_MSG_TYPES },
      refId: { not: null },
    },
    select: { id: true, userId: true, type: true, refId: true },
  });
  if (!msgs.length) {
    console.log('无预约类消息需检查');
    return;
  }

  const refIds = [...new Set(msgs.map((m) => m.refId).filter(Boolean))];
  const bookings = await prisma.booking.findMany({
    where: { id: { in: refIds } },
    select: { id: true, status: true },
  });
  const byId = new Map(bookings.map((b) => [b.id, b.status]));

  const staleIds = [];
  for (const m of msgs) {
    const status = byId.get(m.refId);
    if (!status) {
      staleIds.push(m.id);
      continue;
    }
    if (m.type === 'payment_reminder' && status !== 'pending_pay') {
      staleIds.push(m.id);
      continue;
    }
    if (m.type === 'booking_accepted' && !ACCEPTED_STATUSES.includes(status)) {
      staleIds.push(m.id);
    }
  }

  if (!staleIds.length) {
    console.log('无失效消息');
    return;
  }

  const removed = await prisma.userMessage.deleteMany({
    where: { id: { in: staleIds } },
  });
  console.log('已清理失效预约消息:', removed.count);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
