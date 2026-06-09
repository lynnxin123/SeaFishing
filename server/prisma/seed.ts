import { PrismaClient, BookingStatus, CompetitionStatus } from '@prisma/client';

const prisma = new PrismaClient();

const BOATS = [
  {
    boatId: 'LANHAI001',
    shipName: '蓝海号渔船',
    maxNum: 10,
    shipLen: 9.2,
    shipWid: 2.8,
    score: 4.9,
    sailCount: 12,
    experience: 15,
    captain: '大海',
    price: 1280,
    wharf: '大连码头',
    displayWharf: '大连码头',
    facilities: ['卫生间', '休息室'],
    images: ['/images/Reservation3.jpg'],
    description: '本船经验丰富，适合海钓、休闲使用。',
  },
  {
    boatId: 'SHENHAI001',
    shipName: '深海探索',
    maxNum: 8,
    shipLen: 8.5,
    shipWid: 2.5,
    score: 4.8,
    sailCount: 9,
    experience: 10,
    captain: '阿峰',
    price: 980,
    wharf: '大连码头',
    displayWharf: '大连码头',
    facilities: ['茶水室'],
    images: ['/images/Reservation1.jpg'],
    description: '本船经验丰富，适合海钓、休闲使用。',
  },
  {
    boatId: 'HAIFENG001',
    shipName: '海风之旅',
    maxNum: 8,
    shipLen: 7.8,
    shipWid: 2.4,
    score: 4.7,
    sailCount: 7,
    experience: 8,
    captain: '婷婷',
    price: 1680,
    wharf: '旅顺码头',
    displayWharf: '旅顺码头',
    facilities: ['棋牌室', '休息室'],
    images: ['/images/Reservation2.jpg'],
    description: '本船经验丰富，适合海钓、休闲使用。',
  },
  {
    boatId: '55210',
    shipName: '辽长渔休55210',
    maxNum: 3,
    shipLen: 7.66,
    shipWid: 2.2,
    score: 4.6,
    sailCount: 5,
    experience: 2,
    captain: '郭巍',
    price: 2500,
    wharf: '东獐子渔港',
    displayWharf: '东獐子渔港',
    facilities: [],
    images: ['/images/boat1.jpg'],
    description: '专业海钓船，设备齐全。',
  },
];

const SPOTS = [
  {
    spotKey: 'spot-001',
    name: '星海公园岸钓区',
    type: 'shore',
    latitude: 38.878,
    longitude: 121.574,
    depth: '2-8米',
    fishSpecies: ['鲈鱼', '黑鱼', '黄鱼'],
    bestMonths: '4月-10月',
    chargeType: 'free',
    priceNote: '免费',
    seaRange: 'near',
    windSensitive: false,
    boatKeys: [] as string[],
  },
  {
    spotKey: 'spot-002',
    name: '金石滩滨海岸钓点',
    type: 'shore',
    latitude: 39.052,
    longitude: 122.008,
    depth: '3-12米',
    fishSpecies: ['鲅鱼', '鲈鱼', '章鱼'],
    bestMonths: '5月-11月',
    chargeType: 'paid',
    priceNote: '收费 30元/人',
    seaRange: 'near',
    windSensitive: false,
    boatKeys: [] as string[],
  },
  {
    spotKey: 'spot-003',
    name: '老虎滩船钓码头',
    type: 'pier',
    latitude: 38.867,
    longitude: 121.681,
    depth: '码头水深 5米',
    fishSpecies: ['黄鱼', '鲈鱼', '带鱼'],
    bestMonths: '全年',
    chargeType: 'paid',
    priceNote: '码头停泊费另计',
    seaRange: 'near',
    windSensitive: true,
    boatKeys: ['SHENHAI001', 'HAIFENG001'],
  },
  {
    spotKey: 'spot-004',
    name: '东港国际游艇码头',
    type: 'pier',
    latitude: 38.923,
    longitude: 121.668,
    depth: '码头水深 6米',
    fishSpecies: ['黄鱼', '黑鱼', '鲅鱼'],
    bestMonths: '3月-11月',
    chargeType: 'paid',
    priceNote: '按船收费',
    seaRange: 'near',
    windSensitive: true,
    boatKeys: ['LANHAI001', 'SHENHAI001', 'HAIFENG001'],
  },
  {
    spotKey: 'spot-005',
    name: '旅顺新港船钓码头',
    type: 'pier',
    latitude: 38.8,
    longitude: 121.262,
    depth: '码头水深 8米',
    fishSpecies: ['鲈鱼', '章鱼', '带鱼'],
    bestMonths: '4月-12月',
    chargeType: 'paid',
    priceNote: '停泊费 + 燃油',
    seaRange: 'near',
    windSensitive: true,
    boatKeys: ['HAIFENG001', 'LANHAI001'],
  },
  {
    spotKey: 'spot-006',
    name: '獐子岛深海钓场',
    type: 'deep',
    latitude: 39.02,
    longitude: 122.73,
    depth: '20-60米',
    fishSpecies: ['黄鱼', '带鱼', '鲅鱼'],
    bestMonths: '6月-10月',
    chargeType: 'paid',
    priceNote: '包船出海',
    seaRange: 'far',
    windSensitive: true,
    boatKeys: ['LANHAI001', 'SHENHAI001'],
  },
  {
    spotKey: 'spot-007',
    name: '广鹿岛深海钓场',
    type: 'deep',
    latitude: 39.18,
    longitude: 122.35,
    depth: '25-80米',
    fishSpecies: ['黄鱼', '鲈鱼', '章鱼'],
    bestMonths: '5月-11月',
    chargeType: 'paid',
    priceNote: '包船出海',
    seaRange: 'far',
    windSensitive: true,
    boatKeys: ['HAIFENG001', 'SHENHAI001'],
  },
  {
    spotKey: 'spot-008',
    name: '长山群岛海钓基地',
    type: 'pier',
    latitude: 39.28,
    longitude: 122.58,
    depth: '15-40米',
    fishSpecies: ['黄鱼', '鲅鱼', '鲈鱼', '带鱼'],
    bestMonths: '6月-9月',
    chargeType: 'paid',
    priceNote: '赛事/包船',
    seaRange: 'far',
    windSensitive: true,
    eventId: 1,
    eventTitle: '大鱼挑战赛',
    boatKeys: ['LANHAI001', 'SHENHAI001', 'HAIFENG001'],
  },
  {
    spotKey: 'spot-009',
    name: '大连东部竞技钓场',
    type: 'deep',
    latitude: 38.96,
    longitude: 122.42,
    depth: '18-50米',
    fishSpecies: ['黄鱼', '鲈鱼', '黑鱼'],
    bestMonths: '9月-11月',
    chargeType: 'paid',
    priceNote: '赛事专用海域',
    seaRange: 'far',
    windSensitive: true,
    eventId: 2,
    eventTitle: '金秋海钓赛',
    boatKeys: ['LANHAI001', 'HAIFENG001'],
  },
];

const COMPETITIONS = [
  {
    legacyId: 1,
    name: '大鱼挑战赛',
    cover: '/images/competition1.jpg',
    status: CompetitionStatus.upcoming,
    statusText: '即将开赛',
    location: '长山群岛',
    time: '2026.07.12-07.14',
    summary: '长山群岛海域大鱼挑战，等你来战',
    intro: '大鱼挑战赛聚焦长山群岛周边海域，以单尾渔获重量为核心评判标准。',
    rules: ['参赛船只须符合组委会安全出海要求', '作钓区域与时段以赛前公告为准'],
    prizes: '设大鱼王及单项奖，具体奖金以赛前公告为准',
  },
  {
    legacyId: 2,
    name: '金秋海钓赛',
    cover: '/images/competition2.jpg',
    status: CompetitionStatus.registering,
    statusText: '报名中',
    location: '大连海域',
    time: '2026.09.18-09.20',
    summary: '大连海域金秋海钓盛会',
    intro: '金秋海钓赛在大连海域举行，结合秋季渔汛特点设置多组别竞赛。',
    rules: ['报名需完成实名认证', '全程服从船长与赛事裁判安排'],
    prizes: '冠亚季军及最佳团队奖',
  },
  {
    legacyId: 3,
    name: '冠军对决赛',
    cover: '/images/competition3.jpg',
    status: CompetitionStatus.upcoming,
    statusText: '即将开赛',
    location: '烟台海岸',
    time: '2026.08.05-08.07',
    summary: '年度冠军巅峰对决',
    intro: '冠军对决赛是海发海岛海钓系列赛年度总决赛。',
    rules: ['仅限获得分站赛晋级资格选手报名'],
    prizes: '年度总冠军、亚军、季军及多项专项奖',
  },
];

async function main() {
  console.log('Seeding database...');

  for (const boat of BOATS) {
    await prisma.boat.upsert({
      where: { boatId: boat.boatId },
      update: boat,
      create: boat,
    });
  }

  const boatMap = new Map(
    (await prisma.boat.findMany()).map((b) => [b.boatId, b.id]),
  );

  for (const spot of SPOTS) {
    const { boatKeys, ...spotData } = spot;
    const created = await prisma.fishingSpot.upsert({
      where: { spotKey: spot.spotKey },
      update: spotData,
      create: spotData,
    });

    await prisma.spotBoatLink.deleteMany({ where: { spotId: created.id } });
    for (const boatKey of boatKeys) {
      const boatId = boatMap.get(boatKey);
      if (boatId) {
        await prisma.spotBoatLink.create({
          data: { spotId: created.id, boatId },
        });
      }
    }
  }

  for (const comp of COMPETITIONS) {
    await prisma.competition.upsert({
      where: { legacyId: comp.legacyId },
      update: comp,
      create: comp,
    });
  }

  const SEED_USERS = [
    { id: 'seed-user-1', openid: 'seed_openid_1', nickName: '海钓达人', realName: '海钓达人' },
    { id: 'seed-user-2', openid: 'seed_openid_2', nickName: '浪里白条', realName: '浪里白条' },
    { id: 'seed-user-3', openid: 'seed_openid_3', nickName: '深海猎人', realName: '深海猎人' },
  ];
  for (const u of SEED_USERS) {
    await prisma.user.upsert({
      where: { openid: u.openid },
      update: { nickName: u.nickName, realName: u.realName },
      create: u,
    });
  }

  const compMap = new Map(
    (await prisma.competition.findMany()).map((c) => [c.legacyId, c.id]),
  );

  await prisma.competitionRanking.deleteMany();
  const comp1 = compMap.get(1);
  if (comp1) {
    for (const item of [
      { userId: 'seed-user-1', displayName: '海钓达人', totalScore: 128.5, rank: 1 },
      { userId: 'seed-user-2', displayName: '浪里白条', totalScore: 115.2, rank: 2 },
      { userId: 'seed-user-3', displayName: '深海猎人', totalScore: 98.6, rank: 3 },
    ]) {
      await prisma.competitionRanking.upsert({
        where: {
          competitionId_userId: { competitionId: comp1, userId: item.userId },
        },
        update: item,
        create: { competitionId: comp1, ...item },
      });
    }
  }

  const lanhaiId = boatMap.get('LANHAI001');
  const shenhaiId = boatMap.get('SHENHAI001');
  if (lanhaiId) {
    await prisma.boatReview.deleteMany({ where: { boatId: lanhaiId } });
    await prisma.boatReview.createMany({
      data: [
        { boatId: lanhaiId, userId: 'seed-user-1', nickName: '老船长', score: 5, content: '船很稳，渔获满满，船长经验丰富。' },
        { boatId: lanhaiId, userId: 'seed-user-2', nickName: '钓友阿明', score: 5, content: '设施齐全，服务周到，下次还来。' },
      ],
    });
  }
  if (shenhaiId) {
    await prisma.boatReview.deleteMany({ where: { boatId: shenhaiId } });
    await prisma.boatReview.create({
      data: {
        boatId: shenhaiId,
        userId: 'seed-user-3',
        nickName: '海风客',
        score: 4,
        content: '深海探索号性价比高，适合小团队出海。',
      },
    });
  }

  await prisma.banner.deleteMany();
  await prisma.banner.createMany({
    data: [
      {
        imageUrl: '/images/banner-1.jpg',
        title: '海发船业',
        subtitle: '深海出航，专业钓鱼服务',
        sortOrder: 1,
      },
      {
        imageUrl: '/images/banner-2.jpg',
        title: '海发船业',
        subtitle: '大连海钓首选渔船',
        sortOrder: 2,
      },
      {
        imageUrl: '/images/banner-3.jpg',
        title: '海发船业',
        subtitle: '专业船队，安心出海',
        sortOrder: 3,
      },
      {
        imageUrl: '/images/banner-4.jpg',
        title: '海发船业',
        subtitle: '丰收渔获，精彩不断',
        sortOrder: 4,
      },
    ],
  });

  console.log('Seed completed.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
