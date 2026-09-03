/**
 * สร้างไอคอนทั้งชุดจากไฟล์โลโก้ (doc/Gemini_Generated_Image_.jpg)
 *
 * ขั้นตอน
 *   1. แปลง JPEG เป็น PNG ด้วย System.Drawing ของ Windows ก่อน (ดูคำสั่งท้ายไฟล์)
 *      เพราะการเขียนตัวถอด JPEG เองไม่คุ้ม ส่วน PNG ถอดเองได้ง่าย แค่ inflate แล้วย้อน filter
 *   2. ลบพื้นหลังขาวด้วย flood fill จากขอบภาพ วิธีเดียวกับ lib/cutout.js
 *      ใช้ flood fill ไม่ใช่เทียบสีทั้งภาพ เพราะส่วนสว่างในตัวโลโก้จะหายไปด้วย
 *   3. ครอบเฉพาะตัวโลโก้ แล้วขยายเป็นจตุรัสพร้อมเว้นขอบ
 *   4. ย่อแบบเฉลี่ยพื้นที่ (ไม่ใช่หยิบพิกเซลใกล้สุด) ขอบจึงเนียนตอนย่อลงหลายเท่า
 *   5. วางบนพื้นขาวแล้วมนมุม ให้เข้าชุดกับไอคอนแอปทั่วไป
 *
 * รัน: node doc/make-icons-from-logo.js <ไฟล์ png ต้นทาง> <โฟลเดอร์ปลายทาง>
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const SRC = process.argv[2];
const OUT = process.argv[3] || path.join(__dirname, '..', 'public');

const WHITE = [0xff, 0xff, 0xff];

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
  ihdr[8] = 8;
  ihdr[9] = 6;   // RGBA
  const raw = Buffer.alloc(h * (w * 4 + 1));
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0;
    rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/* ------------------------------- PNG decoder ------------------------------- */
/** รองรับเฉพาะ 8 บิตต่อช่อง แบบไม่ interlace ซึ่งเป็นสิ่งที่ System.Drawing เขียนออกมา */
function decodePng(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('ไม่ใช่ไฟล์ PNG');
  let pos = 8;
  let w = 0;
  let h = 0;
  let channels = 0;
  let palette = null;
  const idat = [];

  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString('ascii', pos + 4, pos + 8);
    const data = buf.slice(pos + 8, pos + 8 + len);
    if (type === 'IHDR') {
      w = data.readUInt32BE(0);
      h = data.readUInt32BE(4);
      if (data[8] !== 8) throw new Error('รองรับเฉพาะ 8 บิตต่อช่อง');
      if (data[12] !== 0) throw new Error('ไม่รองรับแบบ interlace');
      channels = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[data[9]];
      if (!channels) throw new Error(`ไม่รองรับ color type ${data[9]}`);
      if (data[9] === 3) palette = { indexed: true };
    } else if (type === 'PLTE') {
      palette = { indexed: true, table: data };
    } else if (type === 'IDAT') {
      idat.push(data);
    } else if (type === 'IEND') break;
    pos += 12 + len;
  }

  const raw = zlib.inflateSync(Buffer.concat(idat));
  const bpp = channels;                 // ไบต์ต่อพิกเซล เพราะ 8 บิตต่อช่อง
  const stride = w * bpp;
  const out = Buffer.alloc(h * stride);

  // ย้อน filter ทีละบรรทัด ตามสูตรในสเปก PNG
  for (let y = 0; y < h; y++) {
    const ft = raw[y * (stride + 1)];
    const line = raw.slice(y * (stride + 1) + 1, y * (stride + 1) + 1 + stride);
    const prev = y > 0 ? out.slice((y - 1) * stride, y * stride) : Buffer.alloc(stride);
    const cur = out.slice(y * stride, (y + 1) * stride);
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? cur[x - bpp] : 0;
      const b = prev[x];
      const c = x >= bpp ? prev[x - bpp] : 0;
      let v = line[x];
      if (ft === 1) v += a;
      else if (ft === 2) v += b;
      else if (ft === 3) v += (a + b) >> 1;
      else if (ft === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a);
        const pb = Math.abs(p - b);
        const pc = Math.abs(p - c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      cur[x] = v & 0xff;
    }
  }

  // แปลงทุกแบบให้เป็น RGBA เพื่อให้ขั้นตอนถัดไปจัดการแบบเดียว
  const rgba = Buffer.alloc(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    const s = i * bpp;
    const d = i * 4;
    if (palette?.table) {
      const p = out[s] * 3;
      rgba[d] = palette.table[p]; rgba[d + 1] = palette.table[p + 1]; rgba[d + 2] = palette.table[p + 2]; rgba[d + 3] = 255;
    } else if (channels === 1) {
      rgba[d] = rgba[d + 1] = rgba[d + 2] = out[s]; rgba[d + 3] = 255;
    } else if (channels === 2) {
      rgba[d] = rgba[d + 1] = rgba[d + 2] = out[s]; rgba[d + 3] = out[s + 1];
    } else if (channels === 3) {
      rgba[d] = out[s]; rgba[d + 1] = out[s + 1]; rgba[d + 2] = out[s + 2]; rgba[d + 3] = 255;
    } else {
      rgba[d] = out[s]; rgba[d + 1] = out[s + 1]; rgba[d + 2] = out[s + 2]; rgba[d + 3] = out[s + 3];
    }
  }
  return { w, h, data: rgba };
}

/* --------------------------- ลบพื้นหลัง + ครอบภาพ --------------------------- */
/**
 * ลบพื้นหลังด้วย flood fill จากขอบภาพ
 * ต้นฉบับพื้นหลังไม่ใช่ขาวสนิท มีไล่เฉดจางๆ อยู่ จึงต้องเผื่อ tolerance ไว้พอสมควร
 */
function removeBackground(img, tolerance = 46) {
  const { w, h, data } = img;
  const total = w * h;
  const tol2 = tolerance * tolerance;
  const seen = new Uint8Array(total);
  const stack = new Int32Array(total);
  let sp = 0;

  // อ้างอิงสีพื้นหลังจากมุมซ้ายบน ซึ่งเป็นพื้นเปล่าแน่นอน
  const bg = [data[0], data[1], data[2]];
  const visit = (x, y) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const p = y * w + x;
    if (seen[p]) return;
    const i = p * 4;
    const dr = data[i] - bg[0];
    const dg = data[i + 1] - bg[1];
    const db = data[i + 2] - bg[2];
    if (dr * dr + dg * dg + db * db > tol2) { seen[p] = 2; return; }
    seen[p] = 1;
    stack[sp++] = p;
  };
  for (let x = 0; x < w; x++) { visit(x, 0); visit(x, h - 1); }
  for (let y = 0; y < h; y++) { visit(0, y); visit(w - 1, y); }
  while (sp > 0) {
    const p = stack[--sp];
    const x = p % w;
    const y = (p - x) / w;
    visit(x - 1, y); visit(x + 1, y); visit(x, y - 1); visit(x, y + 1);
  }

  let x0 = w; let y0 = h; let x1 = -1; let y1 = -1;
  for (let p = 0; p < total; p++) {
    if (seen[p] === 1) { data[p * 4 + 3] = 0; continue; }
    const x = p % w;
    const y = (p - x) / w;
    if (x < x0) x0 = x;
    if (x > x1) x1 = x;
    if (y < y0) y0 = y;
    if (y > y1) y1 = y;
  }
  if (x1 < 0) throw new Error('ลบพื้นหลังแล้วไม่เหลืออะไรเลย');
  return { x0, y0, x1, y1 };
}

/** ตัดภาพเป็นจตุรัสรอบกรอบที่ให้มา พร้อมเว้นขอบเป็นสัดส่วนของด้านยาว */
function squareCrop(img, box, padRatio) {
  const cw = box.x1 - box.x0 + 1;
  const ch = box.y1 - box.y0 + 1;
  const side = Math.round(Math.max(cw, ch) * (1 + padRatio * 2));
  const cx = (box.x0 + box.x1) / 2;
  const cy = (box.y0 + box.y1) / 2;
  const sx = Math.round(cx - side / 2);
  const sy = Math.round(cy - side / 2);

  const out = Buffer.alloc(side * side * 4);   // นอกขอบภาพเดิมปล่อยโปร่งใส
  for (let y = 0; y < side; y++) {
    const srcY = sy + y;
    if (srcY < 0 || srcY >= img.h) continue;
    for (let x = 0; x < side; x++) {
      const srcX = sx + x;
      if (srcX < 0 || srcX >= img.w) continue;
      img.data.copy(out, (y * side + x) * 4, (srcY * img.w + srcX) * 4, (srcY * img.w + srcX) * 4 + 4);
    }
  }
  return { w: side, h: side, data: out };
}

/**
 * ย่อภาพแบบเฉลี่ยพื้นที่ — ต้องคูณสีด้วย alpha ก่อนเฉลี่ย (premultiply)
 * ไม่งั้นสีของพิกเซลโปร่งใสจะซึมออกมาเป็นขอบคล้ำรอบภาพ
 */
function resize(img, size) {
  const out = Buffer.alloc(size * size * 4);
  const scale = img.w / size;
  for (let y = 0; y < size; y++) {
    const sy0 = Math.floor(y * scale);
    const sy1 = Math.min(img.h, Math.max(sy0 + 1, Math.floor((y + 1) * scale)));
    for (let x = 0; x < size; x++) {
      const sx0 = Math.floor(x * scale);
      const sx1 = Math.min(img.w, Math.max(sx0 + 1, Math.floor((x + 1) * scale)));
      let r = 0; let g = 0; let b = 0; let a = 0; let n = 0;
      for (let yy = sy0; yy < sy1; yy++) {
        for (let xx = sx0; xx < sx1; xx++) {
          const i = (yy * img.w + xx) * 4;
          const al = img.data[i + 3] / 255;
          r += img.data[i] * al; g += img.data[i + 1] * al; b += img.data[i + 2] * al;
          a += img.data[i + 3];
          n++;
        }
      }
      const d = (y * size + x) * 4;
      const av = a / n;
      if (av < 0.5) { out[d + 3] = 0; continue; }
      const inv = 255 / av;                       // ถอด premultiply กลับ
      out[d] = Math.min(255, Math.round((r / n) * inv));
      out[d + 1] = Math.min(255, Math.round((g / n) * inv));
      out[d + 2] = Math.min(255, Math.round((b / n) * inv));
      out[d + 3] = Math.round(av);
    }
  }
  return { w: size, h: size, data: out };
}

const inRounded = (x, y, size, r) => {
  if (r <= 0) return true;
  const cx = Math.min(Math.max(x, r), size - r);
  const cy = Math.min(Math.max(y, r), size - r);
  return (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
};

/**
 * วางโลโก้ลงบนพื้นทึบขนาด size พร้อมมนมุม
 * @param logoRatio สัดส่วนที่โลโก้กินพื้นที่ — maskable ต้องเล็กลงให้อยู่ในเขตปลอดภัย
 */
function compose(logo, size, radiusRatio, logoRatio, bg) {
  const inner = Math.round(size * logoRatio);
  const small = resize(logo, inner);
  const off = Math.round((size - inner) / 2);
  const radius = size * radiusRatio;
  const out = Buffer.alloc(size * size * 4);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const d = (y * size + x) * 4;
      if (!inRounded(x + 0.5, y + 0.5, size, radius)) { out[d + 3] = 0; continue; }
      let r = bg[0]; let g = bg[1]; let b = bg[2];
      const lx = x - off;
      const ly = y - off;
      if (lx >= 0 && ly >= 0 && lx < inner && ly < inner) {
        const s = (ly * inner + lx) * 4;
        const a = small.data[s + 3] / 255;
        r = r * (1 - a) + small.data[s] * a;
        g = g * (1 - a) + small.data[s + 1] * a;
        b = b * (1 - a) + small.data[s + 2] * a;
      }
      out[d] = Math.round(r); out[d + 1] = Math.round(g); out[d + 2] = Math.round(b); out[d + 3] = 255;
    }
  }
  return encodePng(size, size, out);
}

module.exports = { decodePng, encodePng, resize, compose };

/* --------------- ลงมือทำ (เฉพาะตอนถูกเรียกรันตรงๆ) --------------- */
if (require.main === module) {
const src = decodePng(fs.readFileSync(SRC));
console.log(`ต้นฉบับ ${src.w}x${src.h}`);

const box = removeBackground(src);
console.log(`กรอบโลโก้ x ${box.x0}..${box.x1} · y ${box.y0}..${box.y1}`);

const logo = squareCrop(src, box, 0.06);
console.log(`ตัดเป็นจตุรัส ${logo.w}x${logo.w}`);

// เก็บไฟล์โปร่งใสไว้ให้ doc/make-og.js เอาไปวางบนพื้นสีเข้มได้
fs.writeFileSync(path.join(__dirname, 'logo-cutout.png'), encodePng(logo.w, logo.h, logo.data));

const files = [
  ['icon-192.png', 192, 0.22, 0.86],
  ['icon-512.png', 512, 0.22, 0.86],
  // maskable: พื้นเต็มขอบ โลโก้เล็กลงให้อยู่ในวงปลอดภัย 80% ที่ OS จะไม่ตัด
  ['icon-maskable-512.png', 512, 0, 0.62],
  // iOS ตัดมุมให้เอง จึงส่งพื้นเต็มขอบไป
  ['apple-touch-icon.png', 180, 0, 0.86],
];
for (const [name, size, radius, ratio] of files) {
  const buf = compose(logo, size, radius, ratio, WHITE);
  fs.writeFileSync(path.join(OUT, name), buf);
  console.log(`${name.padEnd(24)} ${size}x${size}  ${String(buf.length).padStart(6)} bytes`);
}

// favicon — Next รับ app/icon.png ตรงๆ ไม่ต้องใช้ .ico
const fav = compose(logo, 128, 0.2, 0.98, WHITE);   // favicon ให้โลโก้เต็มกรอบที่สุด ยิ่งย่อยิ่งต้องการทุกพิกเซล
fs.writeFileSync(path.join(__dirname, '..', 'app', 'icon.png'), fav);
console.log(`app/icon.png             128x128  ${String(fav.length).padStart(6)} bytes`);
}
