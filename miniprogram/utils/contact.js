var TEST_PHONE_RE = /^1380000000[1-9]$/;
var TEST_WECHAT_RE = /^haidia_test_/i;

function trim(s) {
  return String(s || '').replace(/^\s+|\s+$/g, '');
}

function isTestAccount() {
  var auth = require('./auth');
  var profile = auth.getUserProfile() || {};
  return profile.isTestAccount === true;
}

function validateContact(phone, wechatId, options) {
  options = options || {};
  var test = options.isTestAccount != null ? options.isTestAccount : isTestAccount();
  var p = trim(phone);
  var w = trim(wechatId);

  if (!p && !w) {
    return { ok: false, message: '请填写手机号或微信号' };
  }

  if (p) {
    if (!/^1\d{10}$/.test(p)) {
      return { ok: false, message: '手机号格式不正确' };
    }
    if (!test && TEST_PHONE_RE.test(p)) {
      return { ok: false, message: '请填写真实手机号' };
    }
  }

  if (w) {
    if (w.length < 6 || w.length > 32) {
      return { ok: false, message: '微信号长度应为6-32位' };
    }
    if (!test && TEST_WECHAT_RE.test(w)) {
      return { ok: false, message: '请填写真实微信号' };
    }
  }

  if (!test && !p) {
    return { ok: false, message: '正式用户请填写真实手机号' };
  }

  return { ok: true };
}

function contactHint() {
  return isTestAccount()
    ? '测试账号可使用模拟联系方式'
    : '请填写真实手机号（必填）与微信号（选填）';
}

module.exports = {
  isTestAccount: isTestAccount,
  validateContact: validateContact,
  contactHint: contactHint
};
