/**
 * 地图标注图标：岸钓 / 码头 / 深海 / 赛事
 * 运行: node scripts/generate-map-markers.js
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const W = 48;
const H = 60;
const OUT = path.join(__dirname, '../miniprogram/images');

const COLORS = {
  shore: { r: 34, g: 160, b: 90 },
  pier: { r: 12, g: 109, b: 255 },
  deep: { r: 245, g: 140, b: 24 },
  event: { r: 230, g: 57, b: 70 }
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

function setPx(px, w, h, x, y, color, alpha) {
  if (x < 0 || y < 0 || x >= w || y >= h || alpha <= 0) return;
  const i = (Math.floor(y) * w + Math.floor(x)) * 4;
  const t = alpha / 255;
  px[i] = Math.round(px[i] * (1 - t) + color.r * t);
  px[i + 1] = Math.round(px[i + 1] * (1 - t) + color.g * t);
  px[i + 2] = Math.round(px[i + 2] * (1 - t) + color.b * t);
  px[i + 3] = Math.min(255, Math.round(px[i + 3] * (1 - t) + 255 * t));
}

function drawPin(px, w, h, color) {
  const cx = w / 2;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = x + 0.5 - cx;
      const dy = y + 0.5;
      if (dy < 42) {
        const d = Math.hypot(dx, dy - 20);
        if (d <= 16) setPx(px, w, h, x, y, color, 255);
      }
      const tipD = Math.hypot(dx * 0.85, dy - 50);
      if (dy >= 30 && dy <= 56 && tipD < 14 - (dy - 30) * 0.35) {
        setPx(px, w, h, x, y, color, 255);
      }
    }
  }
  setPx(px, w, h, cx, 20, { r: 255, g: 255, b: 255 }, 255);
  for (let a = 0; a < Math.PI * 2; a += 0.2) {
    const rx = cx + Math.cos(a) * 6;
    const ry = 20 + Math.sin(a) * 6;
    setPx(px, w, h, rx, ry, { r: 255, g: 255, b: 255 }, 200);
  }
}

Object.keys(COLORS).forEach((key) => {
  const px = Buffer.alloc(W * H * 4);
  drawPin(px, W, H, COLORS[key]);
  fs.writeFileSync(path.join(OUT, `map-marker-${key}.png`), createPng(px, W, H));
  console.log('map-marker-' + key);
});

console.log('done');
