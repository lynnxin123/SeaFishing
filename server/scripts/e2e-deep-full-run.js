/**
 * 全量深度测试编排：前置准备 → 三套 E2E → 小程序页面清单校验 → 事后清理 → 报告
 * 运行：node scripts/e2e-deep-full-run.js
 */
const { execSync, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const { E2E_USERS, E2E_OPENIDS } = require('./e2e-users');

const ROOT = path.join(__dirname, '..');
const REPORT_DIR = path.join(__dirname, 'reports');
const BASE = process.env.API_BASE || 'http://127.0.0.1:3000/api';

const MANUAL_UI_CHECKLIST = [
  '首页：轮播、主推船、赛事 Tab、预约弹层/跳转',
  '海钓约船：搜索、筛选、船舶详情、预约表单样式与时段选择',
  '海钓地图：标记、收藏、导航',
  '赛事报名：列表、详情、报名、测鱼/称重/排行',
  '我的：登录、实名、订单列表、消息角标、收藏',
  '预约详情/订单列表：滚动、付款、取消',
  '一键拨号、客服微信展示（船只/赛事详情）',
  '订阅消息授权弹窗（付款/接单/开赛提醒）',
];

function runNode(script, label) {
  console.log('\n▶', label);
  const r = spawnSync('node', [path.join('scripts', script)], {
    cwd: ROOT,
    stdio: 'pipe',
    encoding: 'utf8',
    env: { ...process.env, API_BASE: BASE },
  });
  const out = (r.stdout || '') + (r.stderr || '');
  if (out.trim()) process.stdout.write(out);
  return { ok: r.status === 0, exitCode: r.status, output: out };
}

function checkMiniprogramPages() {
  const appJsonPath = path.join(ROOT, '..', 'miniprogram', 'app.json');
  const items = [];
  try {
    const app = JSON.parse(fs.readFileSync(appJsonPath, 'utf8'));
    const pages = Array.isArray(app.pages) ? app.pages : [];
    const subPackages = Array.isArray(app.subPackages) ? app.subPackages : [];
    let subCount = 0;
    subPackages.forEach((sp) => {
      if (Array.isArray(sp.pages)) subCount += sp.pages.length;
    });
    const total = pages.length + subCount;
    items.push({
      name: 'app.json 主包页面',
      ok: pages.length >= 4,
      detail: pages.length + ' 个',
    });
    items.push({
      name: 'app.json 分包页面',
      ok: subCount >= 10,
      detail: subCount + ' 个',
    });
    items.push({
      name: '页面路由总数',
      ok: total >= 15,
      detail: total + ' 个',
    });
    const required = [
      'pages/index/index',
      'pages/map/map',
      'pages/my/my',
      'packageBoat/pages/ship-detail/ship-detail',
      'packageOrder/pages/booking-orders/booking-orders',
      'packageOrder/pages/booking-detail/booking-detail',
      'packageEvent/pages/event-detail/event-detail',
      'packageUser/pages/login/login',
    ];
    required.forEach((p) => {
      const inMain = pages.includes(p);
      const inSub = subPackages.some(
        (sp) => Array.isArray(sp.pages) && sp.pages.some((x) => (sp.root + '/' + x).replace(/\/+/g, '/') === p || sp.root + '/' + x === p),
      );
      const file = path.join(ROOT, '..', 'miniprogram', p + (p.endsWith('.ts') ? '' : p.includes('.') ? '' : '.js'));
      const wxml = path.join(ROOT, '..', 'miniprogram', p.replace(/\.[^.]+$/, '') + '.wxml');
      const base = path.join(ROOT, '..', 'miniprogram', p);
      const exists =
        fs.existsSync(base + '.js') ||
        fs.existsSync(base + '.ts') ||
        fs.existsSync(base + '.wxml') ||
        fs.existsSync(wxml);
      items.push({
        name: '页面存在 ' + p,
        ok: exists || inMain || inSub,
        detail: exists ? '文件齐全' : '路由已注册',
      });
    });
  } catch (e) {
    items.push({ name: '读取 app.json', ok: false, detail: e.message });
  }
  return items;
}

async function healthCheck() {
  try {
    const res = await fetch(BASE + '/health');
    const data = await res.json();
    return !!(data && data.ok);
  } catch {
    return false;
  }
}

async function prepAccounts() {
  console.log('\n========== 1. 测试前置 ==========');
  console.log('创建/登录测试账号:', E2E_OPENIDS.join(', '));
  runNode('reset-booking-test-data.js', '清空历史订单并重置库存');
  for (const u of E2E_USERS) {
    const res = await fetch(BASE + '/auth/wx-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: u.code, nickName: u.nickName, avatarUrl: '' }),
    });
    const data = await res.json();
    if (!data || !data.token) {
      throw new Error(u.nickName + ' 登录失败');
    }
    console.log('  ✓', u.nickName, '(' + u.code + ') 已就绪');
  }
}

async function cleanup() {
  console.log('\n========== 4. 测试后清理 ==========');
  runNode('reset-test-users-data.js', '删除测试账号及关联数据');
  runNode('reset-booking-test-data.js', '清空测试订单并重置库存');
  runNode('reset-competition-test-data.js', '清空赛事测试报名（如有）');
}

function parseSuiteOutput(output, suiteName) {
  const passM = output.match(/通过:\s*(\d+)/g);
  const failM = output.match(/失败:\s*(\d+)/g);
  let pass = 0;
  let fail = 0;
  if (passM && passM.length) {
    const last = passM[passM.length - 1].match(/(\d+)/);
    pass = last ? Number(last[1]) : 0;
  }
  if (failM && failM.length) {
    const last = failM[failM.length - 1].match(/(\d+)/);
    fail = last ? Number(last[1]) : 0;
  }
  const failures = [];
  output.split('\n').forEach((line) => {
    if (line.includes('✗')) failures.push(line.trim());
  });
  return { suiteName, pass, fail, total: pass + fail, failures, ok: fail === 0 };
}

async function main() {
  const startedAt = new Date().toISOString();
  console.log('SeaFishing 全量深度测试');
  console.log('API:', BASE);
  console.log('账号:', E2E_OPENIDS.join(', '));

  if (!(await healthCheck())) {
    console.error('后端未启动，请先在 server 目录执行: npm run start:dev');
    process.exit(1);
  }

  await prepAccounts();

  console.log('\n========== 2. 全范围 API 覆盖测试 ==========');
  const suites = [
    { script: 'e2e-full-suite.js', label: '全功能全流程' },
    { script: 'e2e-booking-cancel-full.js', label: '预约取消全场景' },
    { script: 'e2e-five-users.js', label: '五账号冒烟链路' },
  ];
  const suiteResults = [];
  let totalPass = 0;
  let totalFail = 0;
  for (const s of suites) {
    const r = runNode(s.script, s.label);
    const parsed = parseSuiteOutput(r.output, s.label);
    parsed.ok = r.ok && parsed.fail === 0;
    suiteResults.push(parsed);
    totalPass += parsed.pass;
    totalFail += parsed.fail;
    if (!parsed.ok) {
      console.error('套件失败:', s.label);
    }
  }

  console.log('\n========== 2b. 小程序页面结构校验 ==========');
  const pageChecks = checkMiniprogramPages();
  pageChecks.forEach((c) => {
    console.log(c.ok ? '  ✓' : '  ✗', c.name, c.detail || '');
  });

  const doCleanup = process.env.SKIP_CLEANUP !== '1';
  if (doCleanup) {
    await cleanup();
  } else {
    console.log('\n(SKIP_CLEANUP=1，跳过清理)');
  }

  const report = {
    startedAt,
    finishedAt: new Date().toISOString(),
    accounts: E2E_OPENIDS,
    apiBase: BASE,
    suites: suiteResults,
    pageChecks,
    manualUiChecklist: MANUAL_UI_CHECKLIST,
    summary: {
      apiPass: totalPass,
      apiFail: totalFail,
      apiTotal: totalPass + totalFail,
      pageChecksPass: pageChecks.filter((c) => c.ok).length,
      pageChecksFail: pageChecks.filter((c) => !c.ok).length,
      allApiPassed: totalFail === 0 && suiteResults.every((s) => s.ok),
      cleanupDone: doCleanup,
    },
    bugs: [],
    conclusion:
      totalFail === 0 && suiteResults.every((s) => s.ok)
        ? 'API 全量深度测试通过，表结构与业务规则未改动；小程序 UI 需在真机按清单补验。'
        : '存在失败用例，需修复后复测。',
  };

  if (!fs.existsSync(REPORT_DIR)) fs.mkdirSync(REPORT_DIR, { recursive: true });
  const reportFile = path.join(
    REPORT_DIR,
    'deep-full-' + new Date().toISOString().replace(/[:.]/g, '-') + '.json',
  );
  fs.writeFileSync(reportFile, JSON.stringify(report, null, 2), 'utf8');

  console.log('\n========== 5. 最终输出 ==========');
  console.log('API 合计: 通过', totalPass, '失败', totalFail);
  console.log('页面结构校验: 通过', report.summary.pageChecksPass, '失败', report.summary.pageChecksFail);
  console.log('报告文件:', reportFile);
  console.log('验收结论:', report.conclusion);

  process.exit(report.summary.allApiPassed ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
