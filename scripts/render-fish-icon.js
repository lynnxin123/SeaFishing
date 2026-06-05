/**
 * 精致跳跃鱼图标 PNG
 * 运行: node scripts/render-fish-icon.js
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const SIZE = 96;
const SCALE = 6;
const RENDER = SIZE * SCALE;
const OUT = path.join(__dirname, '../miniprogram/images/my-icon-fish.png');
const SVG_OUT = path.join(__dirname, '../miniprogram/images/my-icon-fish.svg');

const FILL_TOP = { r: 130, g: 136, b: 148 };
const FILL_BOTTOM = { r: 96, g: 102, b: 114 };
const LIGHT = { r: 255, g: 255, b: 255 };

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

function createPng(px, w, h) {
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

function cubic(t, a, b, c, d) {
  const u = 1 - t;
  return u * u * u * a + 3 * u * u * t * b + 3 * u * t * t * c + t * t * t * d;
}

function sampleCubic(p0, p1, p2, p3, steps) {
  const pts = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    pts.push([cubic(t, p0[0], p1[0], p2[0], p3[0]), cubic(t, p0[1], p1[1], p2[1], p3[1])]);
  }
  return pts;
}

function rotatePoint(x, y, deg, cx, cy) {
  const rad = (deg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const dx = x - cx;
  const dy = y - cy;
  return [cx + dx * cos - dy * sin, cy + dx * sin + dy * cos];
}

function transformPts(pts, deg, cx, cy, factor) {
  return pts.map((p) => {
    const r = rotatePoint(p[0], p[1], deg, cx, cy);
    return [r[0] * factor, r[1] * factor];
  });
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

function blendColor(top, bottom, t) {
  return {
    r: Math.round(top.r * (1 - t) + bottom.r * t),
    g: Math.round(top.g * (1 - t) + bottom.g * t),
    b: Math.round(top.b * (1 - t) + bottom.b * t)
  };
}

function setPx(px, w, x, y, color, alpha) {
  if (x < 0 || y < 0 || x >= w || y >= w || alpha <= 0) return;
  const i = (Math.floor(y) * w + Math.floor(x)) * 4;
  const t = alpha / 255;
  px[i] = Math.round(px[i] * (1 - t) + color.r * t);
  px[i + 1] = Math.round(px[i + 1] * (1 - t) + color.g * t);
  px[i + 2] = Math.round(px[i + 2] * (1 - t) + color.b * t);
  px[i + 3] = Math.min(255, Math.round(px[i + 3] * (1 - t) + 255 * t));
}

function fillPolyGradient(px, w, pts, minY, maxY) {
  let minX = Infinity;
  let maxX = -Infinity;
  let y0 = Infinity;
  let y1 = -Infinity;
  pts.forEach((p) => {
    minX = Math.min(minX, p[0]);
    maxX = Math.max(maxX, p[0]);
    y0 = Math.min(y0, p[1]);
    y1 = Math.max(y1, p[1]);
  });
  const span = Math.max(1, maxY - minY);
  for (let y = Math.floor(y0); y <= Math.ceil(y1); y++) {
    for (let x = Math.floor(minX); x <= Math.ceil(maxX); x++) {
      if (pointInPoly(x + 0.5, y + 0.5, pts)) {
        const t = Math.max(0, Math.min(1, (y - minY) / span));
        setPx(px, w, x, y, blendColor(FILL_TOP, FILL_BOTTOM, t), 255);
      }
    }
  }
}

function fillCircle(px, w, cx, cy, r, color) {
  for (let y = Math.floor(cy - r - 1); y <= Math.ceil(cy + r + 1); y++) {
    for (let x = Math.floor(cx - r - 1); x <= Math.ceil(cx + r + 1); x++) {
      const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
      if (d <= r) {
        const alpha = Math.min(255, Math.round(255 * (d < r - 0.8 ? 1 : Math.max(0, r - d + 0.8))));
        setPx(px, w, x, y, color, alpha);
      }
    }
  }
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
  return small;
}

// 侧视鱼身：尾鳍与身体连成一体，头部圆润，整体微跃起
const tailTop = [8, 46];
const tailRoot = [16, 50];
const tailBottom = [8, 54];

const belly = sampleCubic(tailRoot, [24, 54], [42, 56], [58, 54], 10)
  .concat(sampleCubic([58, 54], [70, 52], [78, 50], [82, 48], 8))
  .concat(sampleCubic([82, 48], [86, 48], [86, 46], [82, 44], 6));

const back = sampleCubic([82, 44], [78, 38], [66, 32], [50, 30], 10)
  .concat(sampleCubic([50, 30], [34, 28], [22, 32], [16, 38], 8))
  .concat([[tailTop[0], tailTop[1]]]);

const bodyOutline = [tailTop, tailRoot, tailBottom]
  .concat(belly.slice(1))
  .concat(back.slice(1));

const dorsal = [
  [40, 30],
  [44, 18],
  [50, 30]
];
const bellyFin = [
  [54, 52],
  [50, 60],
  [60, 54]
];

const pivotX = 48;
const pivotY = 44;
const rotateDeg = -18;

const bodyPts = transformPts(bodyOutline, rotateDeg, pivotX, pivotY, SCALE);
const dorsalPts = transformPts(dorsal, rotateDeg, pivotX, pivotY, SCALE);
const bellyPts = transformPts(bellyFin, rotateDeg, pivotX, pivotY, SCALE);

const eye = rotatePoint(74, 42, rotateDeg, pivotX, pivotY);

let minY = Infinity;
let maxY = -Infinity;
bodyPts.forEach((p) => {
  minY = Math.min(minY, p[1]);
  maxY = Math.max(maxY, p[1]);
});

const px = Buffer.alloc(RENDER * RENDER * 4);
fillPolyGradient(px, RENDER, bodyPts, minY, maxY);
fillPolyGradient(px, RENDER, dorsalPts, minY, maxY);
fillPolyGradient(px, RENDER, bellyPts, minY, maxY);
fillCircle(px, RENDER, eye[0] * SCALE, eye[1] * SCALE, 5.6 * SCALE, FILL_BOTTOM);
fillCircle(px, RENDER, eye[0] * SCALE, eye[1] * SCALE, 4.2 * SCALE, LIGHT);

const smallPx = downsample(px, RENDER, SIZE);
fs.writeFileSync(OUT, createPng(smallPx, SIZE, SIZE));

const svgPath =
  'M8 46 L16 50 L8 54 L' +
  belly
    .slice(1)
    .map((p) => p[0] + ' ' + p[1])
    .join(' L') +
  ' L' +
  back
    .slice(1)
    .map((p) => p[0] + ' ' + p[1])
    .join(' L') +
  ' Z';

const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="96" height="96" viewBox="0 0 96 96" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="fishGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#828894"/>
      <stop offset="100%" stop-color="#606672"/>
    </linearGradient>
  </defs>
  <g transform="rotate(-18 48 44)" fill="url(#fishGrad)">
    <path d="${svgPath}"/>
    <polygon points="40,30 44,18 50,30"/>
    <polygon points="54,52 50,60 60,54"/>
  </g>
  <g transform="rotate(-18 48 44)">
    <circle cx="74" cy="42" r="5" fill="#fff"/>
    <circle cx="74" cy="42" r="5.5" fill="none" stroke="#606672" stroke-width="1.2"/>
  </g>
</svg>
`;

fs.writeFileSync(SVG_OUT, svg);
console.log('wrote', OUT);
console.log('wrote', SVG_OUT);
