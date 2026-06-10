/**
 * 后端 API 配置
 * - 开发者工具：勾选「不校验合法域名」后可使用 http://127.0.0.1
 * - 真机/上线前再改：BASE_URL → https 正式域名 + 微信公众平台配置合法域名
 * - 上线前再开：微信支付、手机号快速验证、真实气象 API（当前均为开发占位）
 */
/** 开发者工具内快速切换的 5 个测试账号（对应 server/scripts/e2e-users.js） */
var TEST_ACCOUNTS = [
  { code: 'dev:test01', nickName: '测试01' },
  { code: 'dev:test02', nickName: '测试02' },
  { code: 'dev:test03', nickName: '测试03' },
  { code: 'dev:test04', nickName: '测试04' },
  { code: 'dev:test05', nickName: '测试05' }
];

module.exports = {
  USE_API: true,
  BASE_URL: 'http://127.0.0.1:3000/api',
  /** 正式上线前改为 false，并开启微信实名认证 */
  SKIP_ID_VERIFY: true,
  /** 登录页是否显示「开发测试账号」快捷入口，本地联调时可改为 true */
  SHOW_DEV_ACCOUNTS: false,
  TEST_ACCOUNTS: TEST_ACCOUNTS
};
