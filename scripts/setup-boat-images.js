const fs = require('fs');
const path = require('path');

const imgDir = path.join(__dirname, '../miniprogram/images');
const copies = [
  ['Reservation1.jpg', 'boat1.jpg'],
  ['Reservation2.jpg', 'boat2.jpg'],
  ['Reservation3.jpg', 'boat3.jpg'],
  ['banner-1.jpg', 'boat4.jpg'],
  ['competition1.jpg', 'captain1.jpg'],
  ['competition2.jpg', 'captain2.jpg'],
  ['competition3.jpg', 'captain3.jpg']
];

for (const [src, dest] of copies) {
  fs.copyFileSync(path.join(imgDir, src), path.join(imgDir, dest));
  console.log('created', dest);
}

const dupDir = path.join(imgDir, 'images');
if (fs.existsSync(dupDir)) {
  fs.rmSync(dupDir, { recursive: true, force: true });
  console.log('removed duplicate folder images/images');
}

let total = 0;
function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p);
    else total += fs.statSync(p).size;
  }
}
walk(path.join(__dirname, '../miniprogram'));
console.log('miniprogram total MB:', (total / 1024 / 1024).toFixed(2));
