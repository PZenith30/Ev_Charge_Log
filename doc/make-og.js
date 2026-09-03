/**
 * สร้าง public/og.png — รูปตัวอย่างที่ขึ้นตอนแชร์ลิงก์ใน LINE / Facebook / X
 *
 * ขนาด 1200x630 ตามอัตราส่วน 1.91:1 ที่ LINE กับ Facebook ใช้แสดงการ์ดใบใหญ่
 * วาดด้วยรูปหลายเหลี่ยมล้วน ไม่พึ่งฟอนต์หรือไลบรารีภายนอก เพราะเครื่องนี้ build ไม่ได้
 * จึงต้องได้ไฟล์จริงที่ตรวจด้วยตาได้ ไม่ใช่รูปที่สร้างตอน runtime แล้วลุ้นว่าจะออกมาถูก
 *
 * ในรูปมีแค่โลโก้กับชื่อ ไม่ใส่คำอธิบายภาษาไทย เพราะ LINE แสดง og:title กับ
 * og:description เป็นข้อความข้างการ์ดอยู่แล้ว ใส่ซ้ำในรูปจะรกเปล่าๆ
 *
 * รัน: node doc/make-og.js public
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const OUT = process.argv[2] || path.join(__dirname, '..', 'public');
const W = 1200;
const H = 630;

const { decodePng, resize } = require('./make-icons-from-logo');

const BG = [0x11, 0x18, 0x27];      // สีแถบข้างของแอป
const TEXT = [0xf8, 0xfa, 0xfc];
const ACCENT = [0x3b, 0x82, 0xf6];  // สีน้ำเงินเดียวกับสายฟ้าในโลโก้ ตรงกับโทเคน --dc ของแอปพอดี

/* ------------------------------- PNG encoder ------------------------------- */
const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}
function encodePng(w, h, rgb) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;   // color type 2 = RGB ทึบทั้งภาพ ไม่ต้องเก็บช่อง alpha ให้เปลืองที่
  const raw = Buffer.alloc(h * (w * 3 + 1));
  for (let y = 0; y < h; y++) {
    raw[y * (w * 3 + 1)] = 0;
    rgb.copy(raw, y * (w * 3 + 1) + 1, y * w * 3, (y + 1) * w * 3);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/* --------------------------------- เรขาคณิต -------------------------------- */
function inPoly(px, py, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
/** กรอบสี่เหลี่ยมของรูป ใช้ข้ามการทดสอบทีละจุดให้เร็วขึ้นมาก */
function bbox(poly) {
  let x0 = Infinity; let y0 = Infinity; let x1 = -Infinity; let y1 = -Infinity;
  for (const [x, y] of poly) {
    if (x < x0) x0 = x;
    if (x > x1) x1 = x;
    if (y < y0) y0 = y;
    if (y > y1) y1 = y;
  }
  return { x0, y0, x1, y1 };
}
const circle = (cx, cy, r, seg = 64) =>
  Array.from({ length: seg }, (_, i) => {
    const a = (i / seg) * Math.PI * 2;
    return [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
  });
const rect = (x, y, w, h) => [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
const move = (poly, dx, dy, s = 1) => poly.map(([x, y]) => [dx + x * s, dy + y * s]);


/* ------------------------------- ตัวอักษร ------------------------------- */
/**
 * ฟอนต์เรขาคณิตเล็กๆ เขียนเอง เฉพาะตัวที่ใช้ในคำว่า KiloEV
 * ทุกตัวอยู่บนกล่องสูง 100 หน่วย เส้นหนา 17 ฐานอยู่ที่ y=100
 * ทำเองเพราะ Node ที่ใช้ได้ในเครื่องนี้อ่านไฟล์ฟอนต์ไม่ได้ และไม่อยากเพิ่ม dependency
 */
const GLYPHS = {
  K: { w: 82, add: [
    rect(0, 0, 17, 100),
    [[15, 44], [82, 0], [82, 20], [15, 62]],
    [[15, 40], [82, 80], [82, 100], [15, 58]],
  ] },
  i: { w: 17, add: [rect(0, 30, 17, 70), rect(0, 4, 17, 17)] },
  l: { w: 17, add: [rect(0, 0, 17, 100)] },
  o: { w: 76, add: [circle(38, 65, 35)], sub: [circle(38, 65, 18)] },
  E: { w: 62, add: [rect(0, 0, 17, 100), rect(0, 0, 62, 17), rect(0, 42, 54, 16), rect(0, 83, 62, 17)] },
  V: { w: 80, add: [[[0, 0], [18, 0], [40, 74], [62, 0], [80, 0], [49, 100], [31, 100]]] },
};

/** วางคำเป็นรูปหลายเหลี่ยม พร้อมสีของแต่ละตัว */
function layoutWord(word, x, yTop, size, colorAt, tracking = 14) {
  const s = size / 100;
  const shapes = [];
  let cx = x;
  for (let i = 0; i < word.length; i++) {
    const g = GLYPHS[word[i]];
    if (!g) throw new Error(`ยังไม่ได้วาดตัวอักษร "${word[i]}"`);
    const color = colorAt(i);
    for (const p of g.add) shapes.push({ poly: move(p, cx, yTop, s), color, sub: false });
    for (const p of g.sub || []) shapes.push({ poly: move(p, cx, yTop, s), color, sub: true });
    cx += (g.w + tracking) * s;
  }
  return { shapes, width: cx - x - tracking * s };
}

/* --------------------------------- วาดภาพ --------------------------------- */
const MARK_SIZE = 250;
const TEXT_SIZE = 124;

// วัดความกว้างของคำก่อน เพื่อจัดกลุ่มโลโก้+ชื่อให้อยู่กลางภาพพอดี
const probe = layoutWord('KiloEV', 0, 0, TEXT_SIZE, () => TEXT);
const GAP = 62;
const groupW = MARK_SIZE + GAP + probe.width;
const startX = Math.round((W - groupW) / 2);
const midY = H / 2;

// โลโก้จริงแบบพื้นหลังโปร่งใส สร้างไว้โดย doc/make-icons-from-logo.js
const logo = resize(decodePng(fs.readFileSync(path.join(__dirname, 'logo-cutout.png'))), MARK_SIZE);
const logoX = startX;
const logoY = Math.round(midY - MARK_SIZE / 2);

// ชื่อแอป — "Kilo" สีอ่อน "EV" สีน้ำเงินตามสายฟ้าในโลโก้
const shapes = layoutWord(
  'KiloEV',
  startX + MARK_SIZE + GAP,
  midY - TEXT_SIZE / 2,
  TEXT_SIZE,
  (i) => (i >= 4 ? ACCENT : TEXT)
).shapes;

// เตรียมกรอบไว้ล่วงหน้า ไม่ต้องทดสอบทุกรูปกับทุกจุด
const prepared = shapes.map((s) => ({ ...s, box: bbox(s.poly) }));

const SS = 3;
const rgb = Buffer.alloc(W * H * 3);
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    let hits = 0;
    let r = 0;
    let g = 0;
    let b = 0;
    for (let sy = 0; sy < SS; sy++) {
      for (let sx = 0; sx < SS; sx++) {
        const px = x + (sx + 0.5) / SS;
        const py = y + (sy + 0.5) / SS;
        let color = null;
        for (const s of prepared) {
          if (px < s.box.x0 || px > s.box.x1 || py < s.box.y0 || py > s.box.y1) continue;
          if (!inPoly(px, py, s.poly)) continue;
          color = s.sub ? null : s.color;   // รูปที่ทำหน้าที่เจาะ จะล้างสีที่ทับอยู่
        }
        if (color) { hits++; r += color[0]; g += color[1]; b += color[2]; }
      }
    }
    // ชั้นล่างสุดคือพื้นหลัง แล้ววางโลโก้ทับ ก่อนจะเอาตัวอักษรทับอีกที
    const base = [BG[0], BG[1], BG[2]];
    const lx = x - logoX;
    const ly = y - logoY;
    if (lx >= 0 && ly >= 0 && lx < MARK_SIZE && ly < MARK_SIZE) {
      const s = (ly * MARK_SIZE + lx) * 4;
      const a = logo.data[s + 3] / 255;
      if (a > 0) for (let c = 0; c < 3; c++) base[c] = base[c] * (1 - a) + logo.data[s + c] * a;
    }

    const total = SS * SS;
    const i = (y * W + x) * 3;
    if (!hits) {
      rgb[i] = Math.round(base[0]); rgb[i + 1] = Math.round(base[1]); rgb[i + 2] = Math.round(base[2]);
      continue;
    }
    const f = hits / total;                       // สัดส่วนที่โดนตัวอักษรทับในพิกเซลนี้
    const avg = [r / hits, g / hits, b / hits];
    for (let c = 0; c < 3; c++) rgb[i + c] = Math.round(base[c] * (1 - f) + avg[c] * f);
  }
}

const file = path.join(OUT, 'og.png');
fs.writeFileSync(file, encodePng(W, H, rgb));
console.log(`og.png  ${W}x${H}  ${fs.statSync(file).size} bytes`);
