/** 开发测试账号 openid：tester1~9、test01~test05 */
export function isTestOpenid(openid: string): boolean {
  return /^(tester\d+|test0[1-5])$/.test(openid || '');
}

const TEST_PHONE_RE = /^1380000000[1-9]$/;
const TEST_WECHAT_RE = /^haidia_test_/i;

export function validateContact(
  phone: string | undefined,
  wechatId: string | undefined,
  isTestAccount: boolean,
): { ok: boolean; reason?: string } {
  const p = (phone || '').trim();
  const w = (wechatId || '').trim();

  if (!p && !w) {
    return { ok: false, reason: '请填写手机号或微信号' };
  }

  if (p) {
    if (!/^1\d{10}$/.test(p)) {
      return { ok: false, reason: '手机号格式不正确' };
    }
    if (!isTestAccount && TEST_PHONE_RE.test(p)) {
      return { ok: false, reason: '请填写真实手机号' };
    }
  }

  if (w) {
    if (w.length < 6 || w.length > 32) {
      return { ok: false, reason: '微信号长度应为6-32位' };
    }
    if (!isTestAccount && TEST_WECHAT_RE.test(w)) {
      return { ok: false, reason: '请填写真实微信号' };
    }
  }

  if (!isTestAccount && !p) {
    return {
      ok: false,
      reason: '正式用户请填写真实手机号',
    };
  }

  return { ok: true };
}
