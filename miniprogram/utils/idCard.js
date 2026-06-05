function trim(str) {
  return String(str || '').replace(/^\s+|\s+$/g, '');
}

/** 校验中文姓名（2-20 字，支持少数民族间隔符 ·） */
function validateRealName(name) {
  name = trim(name);
  if (!name) {
    return { ok: false, message: '请输入姓名' };
  }
  if (!/^[\u4e00-\u9fa5·]{2,20}$/.test(name)) {
    return { ok: false, message: '请输入正确的中文姓名' };
  }
  return { ok: true, value: name };
}

/** 18 位中国大陆居民身份证校验（格式 + 出生日期 + 校验位） */
function validateIdCard(idNumber) {
  var id = trim(idNumber).toUpperCase();

  if (!id) {
    return { ok: false, message: '请输入证件号' };
  }

  if (!/^\d{17}[\dX]$/.test(id)) {
    return { ok: false, message: '请输入18位身份证号码' };
  }

  var year = parseInt(id.substring(6, 10), 10);
  var month = parseInt(id.substring(10, 12), 10);
  var day = parseInt(id.substring(12, 14), 10);
  var birth = new Date(year, month - 1, day);
  var now = new Date();

  if (
    birth.getFullYear() !== year ||
    birth.getMonth() !== month - 1 ||
    birth.getDate() !== day
  ) {
    return { ok: false, message: '身份证号码出生日期无效' };
  }

  if (birth.getTime() > now.getTime()) {
    return { ok: false, message: '身份证号码出生日期无效' };
  }

  var weights = [7, 9, 10, 5, 8, 4, 2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2];
  var checkCodes = '10X98765432';
  var sum = 0;

  for (var i = 0; i < 17; i++) {
    sum += parseInt(id.charAt(i), 10) * weights[i];
  }

  if (checkCodes.charAt(sum % 11) !== id.charAt(17)) {
    return { ok: false, message: '身份证号码不正确，请核对后重试' };
  }

  return { ok: true, value: id };
}

module.exports = {
  validateRealName: validateRealName,
  validateIdCard: validateIdCard
};
