/**
 * tabBar 图标 — 语义清晰、线条加粗
 * 运行: node scripts/generate-tab-icons.js
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const SCALE = 4;
const SIZE = 81;
const RENDER = SIZE * SCALE;
const OUT = path.join(__dirname, '../miniprogram/images');

const COLORS = {
  inactive: { r: 156, g: 163, b: 175 },
  active: { r: 12, g: 109, b: 255 }
};

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
  const pad = 10 * SCALE;
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

function drawWave(px, w, y, color, sw) {
  const left = s(10);
  const right = s(54);
  let px0 = left;
  let py0 = y;
  const steps = 24;
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const x = left + (right - left) * t;
    const yy = y + Math.sin(t * Math.PI * 2) * 2.2 * SCALE;
    drawLineAA(px, w, px0, py0, x, yy, color, sw * 0.85);
    px0 = x;
    py0 = yy;
  }
}

function render(drawFn, active) {
  const px = Buffer.alloc(RENDER * RENDER * 4);
  const color = active ? COLORS.active : COLORS.inactive;
  const sw = 2.8 * SCALE;
  drawFn(px, RENDER, color, sw);
  return downsample(px, RENDER, SIZE);
}

const icons = {
  home(px, w, c, sw) {
    drawPolyline(px, w, [[s(10), s(30)], [s(32), s(12)], [s(54), s(30)]], c, sw, false);
    drawPolyline(px, w, [[s(16), s(30)], [s(48), s(30)], [s(48), s(52)], [s(16), s(52)]], c, sw, true);
    drawPolyline(px, w, [[s(28), s(52)], [s(28), s(38)], [s(36), s(38)], [s(36), s(52)]], c, sw, true);
  },

  boat(px, w, c, sw) {
    drawPolyline(
      px,
      w,
      [[s(12), s(34)], [s(20), s(26)], [s(44), s(26)], [s(52), s(34)], [s(12), s(34)]],
      c,
      sw,
      true
    );
    drawPolyline(px, w, [[s(28), s(26)], [s(28), s(18)], [s(34), s(18)], [s(34), s(26)]], c, sw, true);
    drawLineAA(px, w, s(10), s(34), s(54), s(34), c, sw * 0.9);
    drawWave(px, w, s(40), c, sw);
    drawWave(px, w, s(48), c, sw * 0.85);
  },

  map(px, w, c, sw) {
    const cx = s(32);
    drawArc(px, w, cx, s(24), s(12), Math.PI, 0, c, sw);
    drawLineAA(px, w, cx - s(12), s(24), cx, s(50), c, sw);
    drawLineAA(px, w, cx + s(12), s(24), cx, s(50), c, sw);
    fillCircle(px, w, cx, s(26), sw * 2.2, c, 255);
  },

  event(px, w, c, sw) {
    drawLineAA(px, w, s(20), s(44), s(44), s(44), c, sw);
    drawPolyline(px, w, [[s(24), s(44)], [s(24), s(30)], [s(40), s(30)], [s(40), s(44)]], c, sw, true);
    drawPolyline(px, w, [[s(28), s(30)], [s(32), s(18)], [s(36), s(30)]], c, sw, true);
    drawLineAA(px, w, s(28), s(22), s(36), s(22), c, sw * 0.85);
    drawCircleOutline(px, w, s(32), s(16), s(4), c, sw * 0.8);
  },

  my(px, w, c, sw) {
    drawCircleOutline(px, w, s(32), s(22), s(9), c, sw);
    drawArc(px, w, s(32), s(42), s(14), Math.PI * 1.08, Math.PI * 1.92, c, sw);
  }
};

if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

for (const name of Object.keys(icons)) {
  fs.writeFileSync(path.join(OUT, `tab-${name}.png`), render(icons[name], false));
  fs.writeFileSync(path.join(OUT, `tab-${name}-active.png`), render(icons[name], true));
  console.log(`tab-${name} ok`);
}

console.log('done');
