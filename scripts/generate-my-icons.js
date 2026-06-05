/**
 * 我的页 / 约船页 UI 图标
 * 运行: node scripts/generate-my-icons.js
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const SCALE = 4;
const SIZE = 96;
const RENDER = SIZE * SCALE;
const OUT = path.join(__dirname, '../miniprogram/images');
const STROKE = { r: 72, g: 78, b: 88 };
const COLOR = STROKE;

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = c & 1 ? (0xedb88320 ^ (c >>> 1)) : c >>> 1;
  }
  return (c ^ ~0) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function createPngFromBuffer(px, w, h) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    const row = y * (w * 4 + 1);
    raw[row] = 0;
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      raw[row + 1 + x * 4] = px[i];
      raw[row + 1 + x * 4 + 1] = px[i + 1];
      raw[row + 1 + x * 4 + 2] = px[i + 2];
      raw[row + 1 + x * 4 + 3] = px[i + 3];
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

function downsample(big, bigSize, smallSize) {
  const small = Buffer.alloc(smallSize * smallSize * 4);
  const ratio = bigSize / smallSize;
  for (let y = 0; y < smallSize; y++) {
    for (let x = 0; x < smallSize; x++) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      for (let dy = 0; dy < ratio; dy++) {
        for (let dx = 0; dx < ratio; dx++) {
          const i = ((y * ratio + dy) * bigSize + (x * ratio + dx)) * 4;
          const alpha = big[i + 3] / 255;
          r += big[i] * alpha;
          g += big[i + 1] * alpha;
          b += big[i + 2] * alpha;
          a += alpha;
        }
      }
      const n = ratio * ratio;
      const si = (y * smallSize + x) * 4;
      if (a > 0) {
        small[si] = Math.round(r / a);
        small[si + 1] = Math.round(g / a);
        small[si + 2] = Math.round(b / a);
        small[si + 3] = Math.round((a / n) * 255);
      }
    }
  }
  return createPngFromBuffer(small, smallSize, smallSize);
}

function s(v) {
  const pad = 8 * SCALE;
  return (v / 64) * (RENDER - pad * 2) + pad;
}

function blend(bg, fg, alpha) {
  const t = alpha / 255;
  return {
    r: Math.round(bg.r * (1 - t) + fg.r * t),
    g: Math.round(bg.g * (1 - t) + fg.g * t),
    b: Math.round(bg.b * (1 - t) + fg.b * t),
    a: Math.min(255, Math.round(bg.a * (1 - t) + 255 * t))
  };
}

function setPx(px, w, x, y, color, alpha) {
  if (x < 0 || y < 0 || x >= w || y >= w || alpha <= 0) return;
  const i = (Math.floor(y) * w + Math.floor(x)) * 4;
  const bg = { r: px[i], g: px[i + 1], b: px[i + 2], a: px[i + 3] };
  const c = blend(bg, color, alpha);
  px[i] = c.r;
  px[i + 1] = c.g;
  px[i + 2] = c.b;
  px[i + 3] = c.a;
}

function distSeg(px, py, x0, y0, x1, y1) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const len2 = dx * dx + dy * dy;
  if (len2 < 1e-6) return Math.hypot(px - x0, py - y0);
  let t = ((px - x0) * dx + (py - y0) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x0 + t * dx), py - (y0 + t * dy));
}

function drawLineAA(px, w, x0, y0, x1, y1, color, radius) {
  const minX = Math.floor(Math.min(x0, x1) - radius - 2);
  const maxX = Math.ceil(Math.max(x0, x1) + radius + 2);
  const minY = Math.floor(Math.min(y0, y1) - radius - 2);
  const maxY = Math.ceil(Math.max(y0, y1) + radius + 2);
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const d = distSeg(x + 0.5, y + 0.5, x0, y0, x1, y1);
      if (d <= radius + 1) {
        const alpha = Math.max(0, Math.min(255, Math.round((1 - Math.max(0, d - radius + 0.65)) * 255)));
        if (alpha > 0) setPx(px, w, x, y, color, alpha);
      }
    }
  }
}

function drawPolyline(px, w, pts, color, radius, closed) {
  for (let i = 0; i < pts.length - 1; i++) {
    drawLineAA(px, w, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], color, radius);
  }
  if (closed && pts.length > 2) {
    const last = pts[pts.length - 1];
    const first = pts[0];
    drawLineAA(px, w, last[0], last[1], first[0], first[1], color, radius);
  }
}

function drawArc(px, w, cx, cy, r, start, end, color, radius) {
  const steps = Math.max(32, Math.ceil(Math.abs(end - start) * r * 0.6));
  let px0;
  let py0;
  for (let i = 0; i <= steps; i++) {
    const t = start + ((end - start) * i) / steps;
    const x = cx + Math.cos(t) * r;
    const y = cy + Math.sin(t) * r;
    if (i > 0) drawLineAA(px, w, px0, py0, x, y, color, radius);
    px0 = x;
    py0 = y;
  }
}

function drawCircleOutline(px, w, cx, cy, r, color, sw) {
  drawArc(px, w, cx, cy, r, 0, Math.PI * 2, color, sw);
}

function fillCircle(px, w, cx, cy, r, color, alpha) {
  const rr = r + 1;
  for (let y = Math.floor(cy - rr); y <= Math.ceil(cy + rr); y++) {
    for (let x = Math.floor(cx - rr); x <= Math.ceil(cx + rr); x++) {
      const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
      if (d <= r) {
        const a = Math.min(255, Math.round(alpha * (d < r - 0.5 ? 1 : Math.max(0, r - d + 0.5))));
        setPx(px, w, x, y, color, a);
      }
    }
  }
}

function pointInPoly(pxx, pyy, pts) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const xi = pts[i][0];
    const yi = pts[i][1];
    const xj = pts[j][0];
    const yj = pts[j][1];
    const intersect = yi > pyy !== yj > pyy && pxx < ((xj - xi) * (pyy - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function fillPoly(px, w, pts, color, alpha) {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  pts.forEach((p) => {
    minX = Math.min(minX, p[0]);
    maxX = Math.max(maxX, p[0]);
    minY = Math.min(minY, p[1]);
    maxY = Math.max(maxY, p[1]);
  });
  for (let y = Math.floor(minY); y <= Math.ceil(maxY); y++) {
    for (let x = Math.floor(minX); x <= Math.ceil(maxX); x++) {
      if (pointInPoly(x + 0.5, y + 0.5, pts)) {
        setPx(px, w, x, y, color, alpha);
      }
    }
  }
}

function starPoints(cx, cy, outerR, innerR) {
  const pts = [];
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? outerR : innerR;
    const a = -Math.PI / 2 + (Math.PI * i) / 5;
    pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
  }
  return pts;
}

function fillStar(px, w, cx, cy, outerR, innerR, color, alpha) {
  fillPoly(px, w, starPoints(cx, cy, outerR, innerR), color, alpha);
}

function drawStarOutline(px, w, cx, cy, outerR, innerR, color, sw) {
  drawPolyline(px, w, starPoints(cx, cy, outerR, innerR), color, sw, true);
}

const FILL = { r: 88, g: 94, b: 104 };
const LIGHT = { r: 255, g: 255, b: 255 };

function render(drawFn, strokeWidth) {
  const px = Buffer.alloc(RENDER * RENDER * 4);
  const sw = (strokeWidth || 2.8) * SCALE;
  drawFn(px, RENDER, STROKE, sw);
  return downsample(px, RENDER, SIZE);
}

const icons = {
  /** 消息铃铛：实心通知铃铛 */
  bell(px, w, c, sw) {
    const cx = s(32);
    fillCircle(px, w, cx, s(10), s(3.2), FILL, 255);
    fillPoly(
      px,
      w,
      [
        [cx - s(3.5), s(13)],
        [cx + s(3.5), s(13)],
        [cx + s(17), s(36)],
        [cx + s(15), s(41)],
        [cx - s(15), s(41)],
        [cx - s(17), s(36)]
      ],
      FILL,
      255
    );
    drawLineAA(px, w, cx - s(15), s(41), cx + s(15), s(41), FILL, sw * 0.55);
    fillCircle(px, w, cx, s(47), s(4.2), LIGHT, 255);
    drawArc(px, w, cx, s(10), s(5.5), Math.PI * 1.05, Math.PI * 1.95, FILL, sw * 0.45);
  },

  /** 勋章：绶带 + 五边形奖牌 + 白星 */
  medal(px, w, c, sw) {
    const cx = s(32);
    fillPoly(
      px,
      w,
      [[cx - s(10), s(8)], [cx + s(10), s(8)], [cx + s(10), s(13)], [cx - s(10), s(13)]],
      FILL,
      255
    );
    fillPoly(
      px,
      w,
      [
        [cx - s(12), s(15)],
        [cx + s(12), s(15)],
        [cx + s(15), s(27)],
        [cx, s(48)],
        [cx - s(15), s(27)]
      ],
      FILL,
      255
    );
    fillStar(px, w, cx, s(30), s(8.5), s(3.5), LIGHT, 255);
  },

  /** 积分：实心星 + 四周光芒 */
  point(px, w, c, sw) {
    const cx = s(32);
    const cy = s(32);
    const rays = [
      [0, -1],
      [1, 0],
      [0, 1],
      [-1, 0],
      [0.7, -0.7],
      [0.7, 0.7],
      [-0.7, 0.7],
      [-0.7, -0.7]
    ];
    rays.forEach(([dx, dy]) => {
      const inner = s(14);
      const outer = s(22);
      drawLineAA(
        px,
        w,
        cx + dx * inner,
        cy + dy * inner,
        cx + dx * outer,
        cy + dy * outer,
        c,
        sw * 0.65
      );
    });
    fillStar(px, w, cx, cy, s(11), s(4.8), FILL, 255);
  },

  /** 鱼粮：整条跳跃的鱼（拱形跃起） */
  fish(px, w, c, sw) {
    fillPoly(px, w, [[s(8), s(44)], [s(4), s(36)], [s(4), s(50)]], FILL, 255);
    fillPoly(
      px,
      w,
      [
        [s(8), s(44)],
        [s(16), s(40)],
        [s(24), s(30)],
        [s(34), s(18)],
        [s(44), s(12)],
        [s(54), s(16)],
        [s(58), s(24)],
        [s(52), s(28)],
        [s(40), s(26)],
        [s(30), s(30)],
        [s(20), s(38)],
        [s(12), s(46)],
        [s(8), s(44)]
      ],
      FILL,
      255
    );
    fillPoly(px, w, [[s(34), s(16)], [s(38), s(6)], [s(42), s(16)]], FILL, 255);
    fillPoly(px, w, [[s(22), s(36)], [s(18), s(44)], [s(26), s(40)]], FILL, 255);
    fillCircle(px, w, s(50), s(20), s(3.5), LIGHT, 255);
    drawLineAA(px, w, s(56), s(24), s(60), s(22), FILL, sw * 0.35);
    drawLineAA(px, w, s(56), s(26), s(60), s(28), FILL, sw * 0.35);
  },

  avatar(px, w, c, sw) {
    const headC = { r: 248, g: 249, b: 251 };
    fillCircle(px, w, s(32), s(24), s(11), headC, 255);
    drawPolyline(
      px,
      w,
      [[s(18), s(38)], [s(46), s(38)], [s(46), s(50)], [s(18), s(50)]],
      headC,
      sw * 0.5,
      true
    );
    drawCircleOutline(px, w, s(32), s(24), s(10), c, sw * 0.7);
    drawArc(px, w, s(32), s(50), s(16), Math.PI * 0.12, Math.PI * 0.88, c, sw * 0.7);
  },

  /** 约船页：价格排序 */
  'sort-price'(px, w, c, sw) {
    const cx = s(32);
    drawLineAA(px, w, cx, s(14), cx, s(50), c, sw * 0.85);
    drawLineAA(px, w, s(20), s(22), cx, s(14), c, sw * 0.85);
    drawLineAA(px, w, s(44), s(22), cx, s(14), c, sw * 0.85);
    drawLineAA(px, w, s(20), s(42), cx, s(50), c, sw * 0.85);
    drawLineAA(px, w, s(44), s(42), cx, s(50), c, sw * 0.85);
    drawLineAA(px, w, s(24), s(28), s(40), s(28), c, sw);
    drawLineAA(px, w, s(26), s(34), s(38), s(34), c, sw * 0.9);
    drawLineAA(px, w, cx, s(34), s(30), s(40), c, sw * 0.9);
    drawLineAA(px, w, cx, s(34), s(34), s(40), c, sw * 0.9);
  },

  /** 约船页：筛选漏斗 */
  filter(px, w, c, sw) {
    drawPolyline(
      px,
      w,
      [[s(14), s(16)], [s(50), s(16)], [s(36), s(36)], [s(36), s(48)], [s(28), s(48)], [s(28), s(36)]],
      c,
      sw,
      true
    );
    drawLineAA(px, w, s(22), s(24), s(42), s(24), c, sw * 0.75);
    drawLineAA(px, w, s(26), s(30), s(38), s(30), c, sw * 0.7);
  }
};

if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

const strokeWidths = {
  bell: 2.8,
  medal: 2.8,
  point: 2.6,
  fish: 2.8,
  avatar: 2.4,
  'sort-price': 2.6,
  filter: 2.6
};

Object.keys(icons).forEach((name) => {
  const fileName = name === 'sort-price' ? 'icon-sort-price.png' : name === 'filter' ? 'icon-filter.png' : `my-icon-${name}.png`;
  const file = path.join(OUT, fileName);
  fs.writeFileSync(file, render(icons[name], strokeWidths[name]));
  console.log('wrote', file);
});

console.log('done');
