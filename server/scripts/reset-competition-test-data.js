/**
 * 清空赛事报名及相关测试数据，保留赛事配置
 * 运行：node scripts/reset-competition-test-data.js
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('重置赛事测试数据...');

  const registrations = await prisma.competitionRegistration.deleteMany({});
  console.log('  已删除报名记录:', registrations.count);

  const measures = await prisma.competitionMeasureRecord.deleteMany({});
  console.log('  已删除测鱼记录:', measures.count);

  const weights = await prisma.competitionWeightRecord.deleteMany({});
  console.log('  已删除称重记录:', weights.count);

  const rankings = await prisma.competitionRanking.deleteMany({});
  console.log('  已删除排行榜记录:', rankings.count);

  const feedbacks = await prisma.competitionFeedback.deleteMany({});
  console.log('  已删除赛事申诉/反馈:', feedbacks.count);

  console.log('重置完成（赛事列表与配置已保留）');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
