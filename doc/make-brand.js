/**
 * สร้างไฟล์แบรนด์ทั้งชุดจากภาพเดียว doc/Gemini_Generated_Image_oe17k3oe17k3oe17.jpg
 * ภาพนั้นแบ่งสองช่อง: ช่อง A คือไอคอนแอป · ช่อง B คือชื่อแบรนด์พร้อมสโลแกน
 *
 * ทำไมต้องแปลง JPEG เป็น PNG ก่อน (ดูคำสั่งท้ายไฟล์)
 *   เครื่องนี้ไม่มี Node จริงและไม่มีไลบรารีรูป การเขียนตัวถอด JPEG เอง
 *   (huffman + DCT + upsampling) ไม่คุ้มแรง ส่วน PNG ถอดเองได้ง่าย
 *   แค่ inflate แล้วย้อน row filter ตามสูตรในสเปก
 *
 * รัน: node doc/make-brand.js <ไฟล์ png ต้นทาง> <โฟลเดอร์ public>
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const SRC = process.argv[2];
const OUT = process.argv[3] || path.join(__dirname, '..', 'public');

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
/** รองรับเฉพาะ 8 บิตต่อช่อง ไม่ interlace ซึ่งเป็นสิ่งที่ System.Drawing เขียนออกมา */
function decodePng(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('ไม่ใช่ไฟล์ PNG');
  let pos = 8;
  let w = 0;
  let h = 0;
  let channels = 0;
  let plte = null;
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
    } else if (type === 'PLTE') plte = data;
    else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    pos += 12 + len;
  }

  const raw = zlib.inflateSync(Buffer.concat(idat));
  const bpp = channels;
  const stride = w * bpp;
  const out = Buffer.alloc(h * stride);

  // ย้อน filter ทีละบรรทัดตามสูตรในสเปก PNG
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

  const rgba = Buffer.alloc(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    const s = i * bpp;
    const d = i * 4;
    if (plte) {
      const p = out[s] * 3;
      rgba[d] = plte[p]; rgba[d + 1] = plte[p + 1]; rgba[d + 2] = plte[p + 2]; rgba[d + 3] = 255;
    } else if (channels === 1) { rgba[d] = rgba[d + 1] = rgba[d + 2] = out[s]; rgba[d + 3] = 255; }
    else if (channels === 2) { rgba[d] = rgba[d + 1] = rgba[d + 2] = out[s]; rgba[d + 3] = out[s + 1]; }
    else if (channels === 3) { rgba[d] = out[s]; rgba[d + 1] = out[s + 1]; rgba[d + 2] = out[s + 2]; rgba[d + 3] = 255; }
    else { rgba[d] = out[s]; rgba[d + 1] = out[s + 1]; rgba[d + 2] = out[s + 2]; rgba[d + 3] = out[s + 3]; }
  }
  return { w, h, data: rgba };
}

/* --------------------------------- เครื่องมือ -------------------------------- */
const px = (img, x, y) => {
  const i = (y * img.w + x) * 4;
  return [img.data[i], img.data[i + 1], img.data[i + 2], img.data[i + 3]];
};
const dist2 = (a, b) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;

/**
 * หากรอบของ "สิ่งที่ไม่ใช่พื้นหลัง" ในบริเวณที่กำหนด
 * tolerance ต้องแน่นพอที่จะไม่นับเงาจางๆ ใต้ไอคอนเป็นเนื้อภาพ
 */
function contentBox(img, region, bg, tolerance) {
  const tol2 = tolerance * tolerance;
  let x0 = region.x1; let y0 = region.y1; let x1 = -1; let y1 = -1;
  for (let y = region.y0; y < region.y1; y++) {
    for (let x = region.x0; x < region.x1; x++) {
      if (dist2(px(img, x, y), bg) <= tol2) continue;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  }
  if (x1 < 0) throw new Error('หาเนื้อภาพในบริเวณนี้ไม่เจอ');
  return { x0, y0, x1, y1 };
}

function crop(img, box) {
  const w = box.x1 - box.x0 + 1;
  const h = box.y1 - box.y0 + 1;
  const data = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y++) {
    img.data.copy(data, y * w * 4, ((box.y0 + y) * img.w + box.x0) * 4, ((box.y0 + y) * img.w + box.x0 + w) * 4);
  }
  return { w, h, data };
}

/**
 * ย่อ/ขยายแบบเฉลี่ยพื้นที่ ต้องคูณสีด้วย alpha ก่อนเฉลี่ย (premultiply)
 * ไม่งั้นสีของพิกเซลโปร่งใสจะซึมออกมาเป็นขอบคล้ำรอบภาพ
 */
function resize(img, w2, h2) {
  const out = Buffer.alloc(w2 * h2 * 4);
  const sx = img.w / w2;
  const sy = img.h / h2;
  for (let y = 0; y < h2; y++) {
    const ya = Math.floor(y * sy);
    const yb = Math.min(img.h, Math.max(ya + 1, Math.floor((y + 1) * sy)));
    for (let x = 0; x < w2; x++) {
      const xa = Math.floor(x * sx);
      const xb = Math.min(img.w, Math.max(xa + 1, Math.floor((x + 1) * sx)));
      let r = 0; let g = 0; let b = 0; let a = 0; let n = 0;
      for (let yy = ya; yy < yb; yy++) {
        for (let xx = xa; xx < xb; xx++) {
          const i = (yy * img.w + xx) * 4;
          const al = img.data[i + 3] / 255;
          r += img.data[i] * al; g += img.data[i + 1] * al; b += img.data[i + 2] * al;
          a += img.data[i + 3];
          n++;
        }
      }
      const d = (y * w2 + x) * 4;
      const av = a / n;
      if (av < 0.5) { out[d + 3] = 0; continue; }
      const inv = 255 / av;
      out[d] = Math.min(255, Math.round((r / n) * inv));
      out[d + 1] = Math.min(255, Math.round((g / n) * inv));
      out[d + 2] = Math.min(255, Math.round((b / n) * inv));
      out[d + 3] = Math.round(av);
    }
  }
  return { w: w2, h: h2, data: out };
}

/** ระยะจากจุดถึงขอบของสี่เหลี่ยมมุมมน — ติดลบแปลว่าอยู่ข้างใน */
function roundedDist(x, y, size, r) {
  const cx = Math.min(Math.max(x, r), size - r);
  const cy = Math.min(Math.max(y, r), size - r);
  return Math.hypot(x - cx, y - cy) - r;
}

/**
 * ทาสีทับทุกจุดนอกกรอบมุมมน
 * จำเป็นเพราะไอคอนต้นฉบับเป็นสี่เหลี่ยมมุมมนวางบนพื้นสว่าง พอครอบตามกรอบสี่เหลี่ยม
 * มุมทั้งสี่จะติดพื้นสว่างมาด้วย ต้องแทนที่ด้วยสีเดียวกับพื้นของไอคอน
 */
function fillOutsideRounded(img, radiusRatio, color) {
  const r = img.w * radiusRatio;
  for (let y = 0; y < img.h; y++) {
    for (let x = 0; x < img.w; x++) {
      const d = roundedDist(x + 0.5, y + 0.5, img.w, r);
      if (d <= 0) continue;
      const i = (y * img.w + x) * 4;
      const t = Math.min(1, d);                       // ไล่ระดับ 1 พิกเซล ขอบจะได้ไม่หยัก
      for (let c = 0; c < 3; c++) img.data[i + c] = Math.round(img.data[i + c] * (1 - t) + color[c] * t);
    }
  }
  return img;
}

/** วางภาพลงบนพื้นทึบขนาด size แล้วมนมุมตามที่ต้องการ */
function compose(art, size, radiusRatio, artRatio, bg) {
  const inner = Math.round(size * artRatio);
  const small = resize(art, inner, inner);
  const off = Math.round((size - inner) / 2);
  const r = size * radiusRatio;
  const out = Buffer.alloc(size * size * 4);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const d = (y * size + x) * 4;
      // ขอบนอกให้โปร่งใสแบบไล่ระดับ 1 พิกเซล กันขอบหยัก
      const edge = radiusRatio > 0 ? roundedDist(x + 0.5, y + 0.5, size, r) : -1;
      const alpha = Math.round(255 * Math.min(1, Math.max(0, 1 - edge)));
      if (alpha === 0) { out[d + 3] = 0; continue; }

      let r0 = bg[0]; let g0 = bg[1]; let b0 = bg[2];
      const lx = x - off;
      const ly = y - off;
      if (lx >= 0 && ly >= 0 && lx < inner && ly < inner) {
        const s = (ly * inner + lx) * 4;
        const a = small.data[s + 3] / 255;
        r0 = r0 * (1 - a) + small.data[s] * a;
        g0 = g0 * (1 - a) + small.data[s + 1] * a;
        b0 = b0 * (1 - a) + small.data[s + 2] * a;
      }
      out[d] = Math.round(r0); out[d + 1] = Math.round(g0); out[d + 2] = Math.round(b0); out[d + 3] = alpha;
    }
  }
  return { buf: encodePng(size, size, out), size };
}

module.exports = { decodePng, encodePng, resize, crop, contentBox, compose };

/* ------------------------- ลงมือทำ (เฉพาะตอนรันตรงๆ) ------------------------- */
if (require.main === module) {
  const sheet = decodePng(fs.readFileSync(SRC));
  console.log(`ภาพต้นฉบับ ${sheet.w}x${sheet.h}`);

  const mid = Math.round(sheet.w / 2);
  const bg = px(sheet, 4, 4);                  // มุมซ้ายบนเป็นพื้นเปล่าแน่นอน
  // เริ่มหาจาก y=150 ลงมา เพื่อข้ามตัวอักษร A กับ B ที่กำกับช่องไว้
  const TOP = 150;

  /* ---------- ช่อง A: ไอคอนแอป ---------- */
  // ใช้ tolerance แน่น (60) เพื่อไม่ให้เงาจางใต้ไอคอนถูกนับเป็นเนื้อภาพ
  const boxA = contentBox(sheet, { x0: 0, y0: TOP, x1: mid, y1: sheet.h }, bg, 60);
  console.log(`ช่อง A  x ${boxA.x0}..${boxA.x1} · y ${boxA.y0}..${boxA.y1}`);

  // ตัดเข้ามาอีกเล็กน้อย ทิ้งขอบสว่างที่เกิดจากการ anti-alias ระหว่างไอคอนกับพื้นในภาพต้นฉบับ
  const inset = Math.round(Math.min(boxA.x1 - boxA.x0, boxA.y1 - boxA.y0) * 0.035);   // เงาใต้ไอคอนตกไปทางขวาล่าง ต้องตัดเผื่อ
  let icon = crop(sheet, {
    x0: boxA.x0 + inset, y0: boxA.y0 + inset, x1: boxA.x1 - inset, y1: boxA.y1 - inset,
  });
  // ทำให้เป็นจตุรัสเป๊ะ เพราะกรอบที่ตรวจได้อาจคลาดกัน 1-2 พิกเซล
  const side = Math.min(icon.w, icon.h);
  icon = resize(icon, side, side);

  // สีพื้นของไอคอน สุ่มจากมุมซ้ายบนด้านในซึ่งเป็นพื้นล้วน
  const NAVY = px(icon, Math.round(side * 0.12), Math.round(side * 0.1)).slice(0, 3);
  console.log(`สีพื้นไอคอน #${NAVY.map((v) => v.toString(16).padStart(2, '0')).join('')}`);
  fillOutsideRounded(icon, 0.25, NAVY);
  fs.writeFileSync(path.join(__dirname, 'brand-icon.png'), encodePng(icon.w, icon.h, icon.data));

  const files = [
    ['icon-192.png', 192, 0.25, 1],
    ['icon-512.png', 512, 0.25, 1],
    // maskable: พื้นเต็มขอบ ย่อไอคอนลงให้ลายอยู่ในวงปลอดภัย 80% ที่ OS จะไม่ตัด
    ['icon-maskable-512.png', 512, 0, 0.82],
    // iOS ตัดมุมให้เอง จึงส่งพื้นเต็มขอบไป
    ['apple-touch-icon.png', 180, 0, 1],
  ];
  for (const [name, size, radius, ratio] of files) {
    const { buf } = compose(icon, size, radius, ratio, NAVY);
    fs.writeFileSync(path.join(OUT, name), buf);
    console.log(`${name.padEnd(24)} ${size}x${size}  ${String(buf.length).padStart(6)} bytes`);
  }

  // favicon — Next รับ app/icon.png ตรงๆ ไม่ต้องใช้ .ico
  const fav = compose(icon, 128, 0.25, 1, NAVY);
  fs.writeFileSync(path.join(__dirname, '..', 'app', 'icon.png'), fav.buf);
  console.log(`app/icon.png             128x128  ${String(fav.buf.length).padStart(6)} bytes`);

  /* ---------- ช่อง B: ชื่อแบรนด์ + สโลแกน ---------- */
  // 70 คือจุดที่จับตัวอักษรสโลแกนสีเทาอ่อนได้ (ห่างจากพื้นราว 165) แต่ไม่ไปจับพื้นที่ไล่เฉดจางๆ
  const boxB = contentBox(sheet, { x0: mid, y0: TOP, x1: sheet.w, y1: sheet.h }, bg, 70);
  console.log(`ช่อง B  x ${boxB.x0}..${boxB.x1} · y ${boxB.y0}..${boxB.y1}`);

  const word = crop(sheet, boxB);
  // ทำพื้นให้โปร่งใสตามความสว่าง ตัวอักษรเข้มจึงทึบ พื้นสว่างจึงหายไป
  // ใช้วิธีนี้แทน flood fill เพราะตัวอักษรมีช่องปิดข้างใน (o, e) ที่ flood fill เข้าไม่ถึง
  for (let i = 0; i < word.w * word.h; i++) {
    const d = i * 4;
    const lum = (word.data[d] * 0.299 + word.data[d + 1] * 0.587 + word.data[d + 2] * 0.114);
    const bgLum = (bg[0] * 0.299 + bg[1] * 0.587 + bg[2] * 0.114);
    const a = Math.min(1, Math.max(0, (bgLum - lum) / (bgLum * 0.55)));
    word.data[d + 3] = Math.round(a * 255);
  }
  fs.writeFileSync(path.join(__dirname, 'brand-wordmark.png'), encodePng(word.w, word.h, word.data));
  console.log(`brand-wordmark.png       ${word.w}x${word.h}`);
}
