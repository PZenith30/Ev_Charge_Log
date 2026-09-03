/**
 * สร้าง public/og.png — การ์ดตัวอย่างที่ขึ้นตอนแชร์ลิงก์ใน LINE / Facebook / X
 *
 * ขนาด 1200x630 (อัตราส่วน 1.91:1) ซึ่งเป็นเกณฑ์ที่ LINE กับ Facebook แสดงการ์ดใบใหญ่
 * เป็นรูปนิ่งที่สร้างไว้ล่วงหน้า ไม่ใช้ ImageResponse ที่เรนเดอร์ตอน runtime
 * เพราะเครื่องนี้ build ไม่ได้ จึงยืนยันผลของ ImageResponse ไม่ได้เลย
 * ส่วนไฟล์นิ่งเปิดดูด้วยตาได้ก่อน deploy
 *
 * พื้นเป็นสีสว่าง เพราะคำว่า "Kilo" ในโลโก้เป็นสีกรมท่าเข้ม ถ้าวางบนพื้นเข้มจะจมหายไป
 *
 * ใช้ไฟล์ที่ doc/make-brand.js สกัดไว้ ถ้าเปลี่ยนโลโก้ต้องรันตัวนั้นก่อน
 * รัน: node doc/make-og.js public
 */
const fs = require('fs');
const path = require('path');
const { decodePng, encodePng, resize } = require('./make-brand');

const OUT = process.argv[2] || path.join(__dirname, '..', 'public');
const W = 1200;
const H = 630;
const BG = [0xf7, 0xf9, 0xfc];      // โทเคน --bg ของแอป

const ICON = 236;
const GAP = 54;
const WORD_W = 545;

// ใช้ไฟล์ที่มนมุมและโปร่งใสนอกกรอบแล้ว จะได้ตรงกับไอคอนที่ส่งขึ้นจริงเป๊ะ
const icon = resize(decodePng(fs.readFileSync(path.join(OUT, 'icon-512.png'))), ICON, ICON);
const wordSrc = decodePng(fs.readFileSync(path.join(__dirname, 'brand-wordmark.png')));
const wordH = Math.round((wordSrc.h / wordSrc.w) * WORD_W);
const word = resize(wordSrc, WORD_W, wordH);

// จัดกลุ่มไอคอน+ชื่อให้อยู่กลางการ์ดพอดี
const groupW = ICON + GAP + WORD_W;
const startX = Math.round((W - groupW) / 2);
const iconY = Math.round(H / 2 - ICON / 2);
const wordX = startX + ICON + GAP;
// ชื่อแบรนด์มีสโลแกนพ่วงอยู่ข้างล่าง ถ้าจัดทั้งบล็อกให้กึ่งกลาง ตัวอักษรใหญ่จะดูลอยขึ้นข้างบน
// จึงเลื่อนลงเล็กน้อยให้ตัวอักษรใหญ่อยู่ระดับเดียวกับไอคอน
const wordY = Math.round(H / 2 - wordH * 0.42);

const rgba = Buffer.alloc(W * H * 4);
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const d = (y * W + x) * 4;
    let r = BG[0];
    let g = BG[1];
    let b = BG[2];

    const blend = (img, ox, oy) => {
      const lx = x - ox;
      const ly = y - oy;
      if (lx < 0 || ly < 0 || lx >= img.w || ly >= img.h) return;
      const s = (ly * img.w + lx) * 4;
      const a = img.data[s + 3] / 255;
      if (a <= 0) return;
      r = r * (1 - a) + img.data[s] * a;
      g = g * (1 - a) + img.data[s + 1] * a;
      b = b * (1 - a) + img.data[s + 2] * a;
    };
    blend(icon, startX, iconY);
    blend(word, wordX, wordY);

    rgba[d] = Math.round(r);
    rgba[d + 1] = Math.round(g);
    rgba[d + 2] = Math.round(b);
    rgba[d + 3] = 255;
  }
}

const file = path.join(OUT, 'og.png');
fs.writeFileSync(file, encodePng(W, H, rgba));
console.log(`og.png  ${W}x${H}  ${fs.statSync(file).size} bytes`);
