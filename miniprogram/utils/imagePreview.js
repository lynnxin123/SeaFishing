/**
 * 本地图片预览：先 getImageInfo 解析为可用路径，避免 previewImage 一直加载
 */
function normalizeSrc(src) {
  if (!src) return '';
  if (/^(https?:\/\/|wxfile:|cloud:|data:)/.test(src)) {
    return src;
  }
  return src.charAt(0) === '/' ? src : '/' + src;
}

function resolveImagePath(src) {
  return new Promise(function (resolve) {
    var path = normalizeSrc(src);
    if (!path) {
      resolve('');
      return;
    }
    if (/^(https?:\/\/|wxfile:|cloud:)/.test(path)) {
      resolve(path);
      return;
    }
    wx.getImageInfo({
      src: path,
      success: function (res) {
        resolve(res.path || path);
      },
      fail: function () {
        resolve(path);
      }
    });
  });
}

/**
 * @param {string[]} urls 原图地址列表
 * @param {number} currentIndex 当前预览索引
 */
function previewImages(urls, currentIndex) {
  urls = urls || [];
  if (!urls.length) {
    wx.showToast({ title: '暂无可预览图片', icon: 'none' });
    return;
  }

  var index = typeof currentIndex === 'number' ? currentIndex : 0;
  if (index < 0 || index >= urls.length) {
    index = 0;
  }

  wx.showLoading({ title: '加载中', mask: true });

  Promise.all(urls.map(resolveImagePath))
    .then(function (resolved) {
      wx.hideLoading();
      var valid = resolved.filter(function (p) {
        return !!p;
      });
      if (!valid.length) {
        wx.showToast({ title: '图片加载失败', icon: 'none' });
        return;
      }
      var current = resolved[index] || valid[0];
      if (valid.indexOf(current) === -1) {
        current = valid[0];
      }
      wx.previewImage({
        current: current,
        urls: valid
      });
    })
    .catch(function () {
      wx.hideLoading();
      wx.showToast({ title: '图片加载失败', icon: 'none' });
    });
}

module.exports = {
  previewImages: previewImages
};
