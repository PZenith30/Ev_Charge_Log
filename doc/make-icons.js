/**
 * สร้างไอคอน KiloEV เป็นไฟล์ PNG จริง โดยไม่พึ่งไลบรารีภายนอก
 * ใช้ zlib ที่ติดมากับ Node เข้ารหัสข้อมูลภาพ แล้วประกอบ chunk ของ PNG เอง
 *
 * รูปรวม K + L + สายฟ้าไว้ในรูปเดียว
 *   ขาซ้าย  = ขาของทั้ง K และ L ใช้ร่วมกัน
 *   ฐานล่าง = บอกใบ้ตัว L ทำให้บางกว่าขาเพื่อไม่ให้แย่งซีน
 *   สายฟ้า  = จรดขาแล้วแตกออกเป็นแขนบนกับแขนล่างของ K รอยหักกลางคือจังหวะสายฟ้า
 * สีเป็นเขียว Electric Green บนพื้นสีแถบข้างของแอป (#111827) คู่เดียวกับที่เห็นในเว็ป
 * วาดด้วย supersample 4x4 ต่อพิกเซล ขอบจึงเนียนไม่หยัก
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const OUT = process.argv[2] || 'c:\Users\wnata\OneDrive\Desktop\Work2\public';
// พื้นใช้สีแถบข้างของแอป ตัวอักษรใช้สีเน้น Electric Green — คู่สีเดียวกับที่เห็นในเว็ป
const BG = [0x11, 0x18, 0x27];
const FG = [0x22, 0xc5, 0x5e];

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
function encodePng(w, h, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;   // bit depth
  ihdr[9] = 6;   // color type RGBA
  const raw = Buffer.alloc(h * (w * 4 + 1));
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0;   // filter byte
    rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/* --------------------------------- ตัว K --------------------------------- */
/**
 * พิกัดบนกริด 0..32 ชุดเดียวกับ app/icon.svg เพื่อให้ favicon กับ PNG ตรงกันเป๊ะ
 * ลำดับจุดต้องวนรอบรูปโดยไม่ตัดกันเอง ไม่งั้นการทดสอบ point-in-polygon จะเพี้ยน
 */
const MARK = [
  // ขาซ้าย ใช้ร่วมกันเป็นขาของทั้ง K และ L
  [[6.2, 5], [11, 5], [11, 28], [6.2, 28]],
  // ฐานล่าง บางและสั้น แค่บอกใบ้ตัว L ไม่ให้แย่งสายตา
  [[6.2, 25.2], [14.6, 25.2], [14.6, 28], [6.2, 28]],
  // สายฟ้าปลายแหลมสองด้าน จรดขาเป็นก้อนเดียวแล้วแยกเป็นสองแฉก
  // ปลายต้องแหลม ถ้าตัดตรงจะอ่านเป็นแขนตัวอักษรเฉยๆ ไม่เป็นสายฟ้า
  // สองแฉกนี้ทำหน้าที่เป็นแขนบน-แขนล่างของ K ไปพร้อมกัน
  [[10.6, 9.3], [26, 3.3], [14.6, 13.1], [26.4, 25.9], [10.6, 19.3]],
];

function inPolygon(px, py, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
/** มุมโค้งแบบ rounded rect — คืน true เมื่อจุดอยู่ในรูป */
function inRoundedRect(x, y, size, radius) {
  const cx = Math.min(Math.max(x, radius), size - radius);
  const cy = Math.min(Math.max(y, radius), size - radius);
  return (x - cx) ** 2 + (y - cy) ** 2 <= radius * radius;
}

/**
 * @param size ขนาดภาพเป็นพิกเซล
 * @param radiusRatio 0 = สี่เหลี่ยมเต็ม (สำหรับ maskable กับ apple ที่ OS ตัดขอบเอง)
 * @param markScale ขนาดตัว K เทียบกับภาพ — maskable ต้องเล็กลงให้อยู่ในเขตปลอดภัย
 */
function drawIcon(size, radiusRatio, markScale) {
  const rgba = Buffer.alloc(size * size * 4);
  const radius = size * radiusRatio;
  const SS = 4;
  const inner = size * markScale;
  const offset = (size - inner) / 2;
  const polys = MARK.map((p) => p.map(([x, y]) => [offset + (x / 32) * inner, offset + (y / 32) * inner]));

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let bg = 0;
      let fg = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const px = x + (sx + 0.5) / SS;
          const py = y + (sy + 0.5) / SS;
          if (radiusRatio !== 0 && !inRoundedRect(px, py, size, radius)) continue;
          bg++;
          if (polys.some((p) => inPolygon(px, py, p))) fg++;
        }
      }
      const i = (y * size + x) * 4;
      if (bg === 0) { rgba[i + 3] = 0; continue; }   // นอกรูป โปร่งใส
      const ratio = fg / bg;
      for (let c = 0; c < 3; c++) rgba[i + c] = Math.round(BG[c] * (1 - ratio) + FG[c] * ratio);
      rgba[i + 3] = Math.round((bg / (SS * SS)) * 255);
    }
  }
  return encodePng(size, size, rgba);
}

const files = [
  ['icon-192.png', 192, 0.22, 0.78],
  ['icon-512.png', 512, 0.22, 0.78],
  // maskable: พื้นเต็มขอบ ตัว K เล็กลงให้อยู่ในวงปลอดภัย 80% ที่ OS จะไม่ตัด
  ['icon-maskable-512.png', 512, 0, 0.66],
  // iOS ตัดมุมให้เอง จึงส่งพื้นเต็มขอบไป
  ['apple-touch-icon.png', 180, 0, 0.78],
];

// เขียนไฟล์เฉพาะตอนถูกเรียกรันตรงๆ ถ้าถูก require มาก็ให้ส่งออกแค่ค่าคงที่
if (require.main === module) {
  for (const [name, size, radius, scale] of files) {
    const buf = drawIcon(size, radius, scale);
    fs.writeFileSync(path.join(OUT, name), buf);
    console.log(`${name.padEnd(24)} ${size}x${size}  ${String(buf.length).padStart(6)} bytes`);
  }
}

// ให้ doc/make-og.js เรียกใช้พิกัดและสีชุดเดียวกันได้ ไม่ต้องก๊อปไปวางแล้วหลุดกันทีหลัง
module.exports = { MARK, BG, FG };
