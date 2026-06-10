/**
 * 压缩 miniprogram/images 下大图（JPEG quality 80，PNG 压缩）
 * 运行：node scripts/optimize-miniprogram-images.js
 */
const fs = require('fs');
const path = require('path');

const imagesDir = path.join(__dirname, '../../miniprogram/images');
const TARGETS = [
  'banner-1.jpg',
  'banner-2.jpg',
  'banner-3.jpg',
  'banner-4.jpg',
  'login-bg.jpg',
  'boat-hero.png',
  'competition1.jpg',
  'competition2.jpg',
  'competition3.jpg',
  'boat1.jpg',
  'boat2.jpg',
  'boat3.jpg',
  'Reservation1.jpg',
  'Reservation2.jpg',
  'Reservation3.jpg',
  'captain.jpg',
];

async function main() {
  let sharp;
  try {
    sharp = require('sharp');
  } catch (e) {
    console.error('请先安装 sharp: npm install sharp --prefix server');
    process.exit(1);
  }

  let saved = 0;
  for (const name of TARGETS) {
    const file = path.join(imagesDir, name);
    if (!fs.existsSync(file)) {
      continue;
    }
    const before = fs.statSync(file).size;
    const ext = path.extname(name).toLowerCase();
    const tmp = file + '.opt';
    try {
      if (ext === '.jpg' || ext === '.jpeg') {
        await sharp(file).jpeg({ quality: 80, mozjpeg: true }).toFile(tmp);
      } else if (ext === '.png') {
        await sharp(file).png({ compressionLevel: 9, palette: true }).toFile(tmp);
      } else {
        continue;
      }
      const after = fs.statSync(tmp).size;
      if (after < before) {
        fs.renameSync(tmp, file);
        saved += before - after;
        console.log(name, (before / 1024).toFixed(1) + 'KB ->', (after / 1024).toFixed(1) + 'KB');
      } else {
        fs.unlinkSync(tmp);
        console.log(name, '跳过（压缩后更大）');
      }
    } catch (err) {
      if (fs.existsSync(tmp)) fs.unlinkSync(tmp);
      console.warn(name, err.message);
    }
  }
  console.log('共节省', (saved / 1024).toFixed(1), 'KB');
}

main().catch(console.error);
