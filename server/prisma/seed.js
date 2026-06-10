const { PrismaClient } = require('@prisma/client');

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
    description: '本船经验丰富，适合海钓、休闲使用。'
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
    description: '本船经验丰富，适合海钓、休闲使用。'
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
    description: '本船经验丰富，适合海钓、休闲使用。'
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
    description: '专业海钓船，设备齐全。'
  }
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
    boatKeys: []
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
    boatKeys: ['SHENHAI001', 'HAIFENG001']
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
    boatKeys: ['LANHAI001', 'SHENHAI001', 'HAIFENG001']
  }
];

const COMPETITIONS = [
  {
    legacyId: 1,
    name: '大鱼挑战赛',
    cover: '/images/competition1.jpg',
    status: 'upcoming',
    statusText: '即将开赛',
    location: '长山群岛',
    time: '2026.07.12-07.14',
    summary: '长山群岛海域大鱼挑战，等你来战',
    intro: '大鱼挑战赛聚焦长山群岛周边海域，以单尾渔获重量为核心评判标准。',
    rules: ['参赛船只须符合组委会安全出海要求', '作钓区域与时段以赛前公告为准'],
    prizes: '设大鱼王及单项奖，具体奖金以赛前公告为准'
  },
  {
    legacyId: 2,
    name: '金秋海钓赛',
    cover: '/images/competition2.jpg',
    status: 'registering',
    statusText: '报名中',
    location: '大连海域',
    time: '2026.09.18-09.20',
    summary: '大连海域金秋海钓盛会',
    intro: '金秋海钓赛在大连海域举行，结合秋季渔汛特点设置多组别竞赛。',
    rules: ['报名需完成实名认证', '全程服从船长与赛事裁判安排'],
    prizes: '冠亚季军及最佳团队奖'
  },
  {
    legacyId: 3,
    name: '冠军对决赛',
    cover: '/images/competition3.jpg',
    status: 'upcoming',
    statusText: '即将开赛',
    location: '烟台海岸',
    time: '2026.08.05-08.07',
    summary: '年度冠军巅峰对决',
    intro: '冠军对决赛是海发海岛海钓系列赛年度总决赛。',
    rules: ['仅限获得分站赛晋级资格选手报名'],
    prizes: '年度总冠军、亚军、季军及多项专项奖'
  }
];

async function main() {
  console.log('Seeding database...');

  for (const boat of BOATS) {
    await prisma.boat.upsert({
      where: { boatId: boat.boatId },
      update: boat,
      create: boat
    });
  }

  const boatMap = new Map(
    (await prisma.boat.findMany()).map(function (b) {
      return [b.boatId, b.id];
    })
  );

  for (const spot of SPOTS) {
    const boatKeys = spot.boatKeys;
    const spotData = Object.assign({}, spot);
    delete spotData.boatKeys;

    const created = await prisma.fishingSpot.upsert({
      where: { spotKey: spot.spotKey },
      update: spotData,
      create: spotData
    });

    await prisma.spotBoatLink.deleteMany({ where: { spotId: created.id } });
    for (const boatKey of boatKeys) {
      const boatId = boatMap.get(boatKey);
      if (boatId) {
        await prisma.spotBoatLink.create({
          data: { spotId: created.id, boatId: boatId }
        });
      }
    }
  }

  for (const comp of COMPETITIONS) {
    await prisma.competition.upsert({
      where: { legacyId: comp.legacyId },
      update: comp,
      create: comp
    });
  }

  var DEFAULT_RULES = {
    minBookingLeadHours: 2,
    maxBookingsIn7Days: 2,
    cancelTiers: [
      { minHours: 72, refundPercent: 100, canCancel: true, label: '出航前72小时以上，全额退款' },
      { minHours: 48, refundPercent: 50, canCancel: true, label: '出航前48-72小时，退款50%' },
      { minHours: 24, refundPercent: 20, canCancel: true, label: '出航前24-48小时，退款20%' },
      { minHours: 0, refundPercent: 0, canCancel: false, label: '出航前24小时内，不可取消' }
    ],
    holidayNoCancel: true,
    holidays: [],
    noShowPenalty: { count2RestrictDays: 7, count3RestrictDays: 30 }
  };

  await prisma.bookingRuleConfig.upsert({
    where: { id: 'default' },
    update: { rules: DEFAULT_RULES },
    create: { id: 'default', rules: DEFAULT_RULES }
  });

  var SAIL_SLOTS = [
    { slotKey: 'morning', slotTime: '08:00', label: '早班 08:00', sortOrder: 1 },
    { slotKey: 'afternoon', slotTime: '13:00', label: '午班 13:00', sortOrder: 2 }
  ];

  var slotMap = new Map();
  for (var si = 0; si < SAIL_SLOTS.length; si++) {
    var slotRow = SAIL_SLOTS[si];
    var savedSlot = await prisma.sailSlot.upsert({
      where: { slotKey: slotRow.slotKey },
      update: slotRow,
      create: slotRow
    });
    slotMap.set(slotRow.slotKey, savedSlot.id);
  }

  var allBoats = await prisma.boat.findMany();
  for (var bi = 0; bi < allBoats.length; bi++) {
    var b = allBoats[bi];
    for (var sj = 0; sj < SAIL_SLOTS.length; sj++) {
      var s = SAIL_SLOTS[sj];
      var slotId = slotMap.get(s.slotKey);
      await prisma.boatSailConfig.upsert({
        where: { boatId_sailSlotId: { boatId: b.id, sailSlotId: slotId } },
        update: {
          maxPeople: b.maxNum,
          maxOrders: s.slotKey === 'morning' ? 2 : 2,
          priceShared: b.price,
          priceCharter: Math.round(b.price * b.maxNum * 0.9),
          active: true
        },
        create: {
          boatId: b.id,
          sailSlotId: slotId,
          maxPeople: b.maxNum,
          maxOrders: 2,
          priceShared: b.price,
          priceCharter: Math.round(b.price * b.maxNum * 0.9),
          active: true
        }
      });
    }
  }

  await prisma.banner.deleteMany();
  await prisma.banner.createMany({
    data: [
      {
        imageUrl: '/images/banner-1.jpg',
        title: '海发船业',
        subtitle: '深海出航，专业钓鱼服务',
        sortOrder: 1
      },
      {
        imageUrl: '/images/banner-2.jpg',
        title: '海发船业',
        subtitle: '大连海钓首选渔船',
        sortOrder: 2
      },
      {
        imageUrl: '/images/banner-3.jpg',
        title: '海发船业',
        subtitle: '专业船队，安心出海',
        sortOrder: 3
      },
      {
        imageUrl: '/images/banner-4.jpg',
        title: '海发船业',
        subtitle: '丰收渔获，精彩不断',
        sortOrder: 4
      }
    ]
  });

  console.log('Seed completed.');
}

main()
  .catch(function (e) {
    console.error(e);
    process.exit(1);
  })
  .finally(async function () {
    await prisma.$disconnect();
  });
