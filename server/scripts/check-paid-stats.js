const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const PAID_STATUSES = [
  'pending_accept',
  'accepted',
  'departed',
  'completed',
  'no_show',
];

async function main() {
  const paidAgg = await prisma.booking.aggregate({
    where: { status: { in: PAID_STATUSES } },
    _sum: { totalAmount: true },
    _count: true,
  });
  console.log('实付口径（已付款状态）:', paidAgg);
  const withPaidAt = await prisma.booking.count({
    where: { paidAt: { not: null } },
  });
  console.log('with paidAt:', withPaidAt);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
