/**
 * E2E 测试账号配置（dev:openid 开发登录）
 * 本次深度测试使用 test01 ~ test05
 */
const E2E_USERS = [
  { code: 'dev:test01', nickName: '测试01', role: 'booking' },
  { code: 'dev:test02', nickName: '测试02', role: 'event' },
  { code: 'dev:test03', nickName: '测试03', role: 'spot-fav' },
  { code: 'dev:test04', nickName: '测试04', role: 'boat-fav' },
  { code: 'dev:test05', nickName: '测试05', role: 'rewards' },
];

function openidFromCode(code) {
  return code && code.startsWith('dev:') ? code.slice(4) : code || '';
}

const E2E_OPENIDS = E2E_USERS.map((u) => openidFromCode(u.code));

module.exports = {
  E2E_USERS,
  E2E_OPENIDS,
  openidFromCode,
};
