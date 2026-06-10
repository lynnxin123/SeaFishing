/**
 * 为已付款流程中的历史订单回填 paid_at（未走 /pay 接口的测试数据）
 * 运行：node scripts/backfill-paid-at.js
 */
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
  const missing = await prisma.booking.count({
    where: { status: { in: PAID_STATUSES }, paidAt: null },
  });
  console.log('待回填订单数:', missing);
  if (missing === 0) return;

  const updated = await prisma.$executeRaw`
    UPDATE bookings
    SET paid_at = updated_at
    WHERE status IN ('pending_accept','accepted','departed','completed','no_show')
      AND paid_at IS NULL
  `;
  console.log('已回填 paid_at 行数:', updated);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
