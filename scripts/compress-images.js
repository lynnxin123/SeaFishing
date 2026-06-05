/**
 * Compress large boat/captain images for WeChat miniprogram (main package limit 2MB).
 * Usage (from repo root, after placing source PNGs in miniprogram/images):
 *   npm install sharp --no-save
 *   node scripts/compress-images.js
 */
const fs = require('fs');
const path = require('path');

async function main() {
  let sharp;
  try {
    sharp = require('sharp');
  } catch {
    console.error('Run: npm install sharp --no-save');
    process.exit(1);
  }

  const imgDir = path.join(__dirname, '../miniprogram/images');
  const names = ['boat1', 'boat2', 'boat3', 'boat4', 'captain1', 'captain2', 'captain3'];

  for (const name of names) {
    const png = path.join(imgDir, `${name}.png`);
    const jpg = path.join(imgDir, `${name}.jpg`);
    const input = fs.existsSync(png) ? png : fs.existsSync(jpg) ? jpg : null;
    if (!input) {
      console.warn('skip (no source):', name);
      continue;
    }
    await sharp(input)
      .resize({ width: 640, withoutEnlargement: true })
      .jpeg({ quality: 82, mozjpeg: true })
      .toFile(jpg);
    const kb = (fs.statSync(jpg).size / 1024).toFixed(1);
    console.log(`${name}.jpg -> ${kb} KB`);
    if (input.endsWith('.png')) fs.unlinkSync(png);
  }

  let total = 0;
  const root = path.join(__dirname, '../miniprogram');
  (function walk(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else total += fs.statSync(p).size;
    }
  })(root);
  console.log('miniprogram total MB:', (total / 1024 / 1024).toFixed(2));
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
