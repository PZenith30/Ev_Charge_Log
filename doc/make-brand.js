/**
 * สร้างไฟล์แบรนด์ทั้งชุดจาก doc/Fav_Icon.jpg และ doc/Wordmark.jpg
 *
 * ผลลัพธ์
 *   ไอคอน  — favicon, ไอคอน PWA, maskable, apple-touch
 *   ชื่อแบรนด์ — สี่แบบ: มี/ไม่มีสโลแกน คูณ สำหรับพื้นสว่าง/พื้นเข้ม
 *   ที่ต้องมีรุ่นพื้นเข้มเพราะคำว่า "Kilo" เป็นกรมท่าเข้ม วางบนแถบข้างสีเข้มจะจมหายไป
 *
 * ทำไมต้องแปลง JPEG เป็น PNG ก่อน (ดูคำสั่งท้ายไฟล์)
 *   เครื่องนี้ไม่มี Node จริงและไม่มีไลบรารีรูป การเขียนตัวถอด JPEG เอง
 *   (huffman + DCT + upsampling) ไม่คุ้มแรง ส่วน PNG ถอดเองได้ง่าย
 *   แค่ inflate แล้วย้อน row filter ตามสูตรในสเปก
 *
 * รัน: node doc/make-brand.js <icon.png> <wordmark.png> <โฟลเดอร์ public>
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');


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
  const ICON_SRC = process.argv[2];
  const WORD_SRC = process.argv[3];
  const OUT_DIR = process.argv[4] || path.join(__dirname, '..', 'public');

  /* =============================== ไอคอนแอป =============================== */
  const iconSheet = decodePng(fs.readFileSync(ICON_SRC));
  const iconBg = px(iconSheet, 4, 4);
  // tolerance แน่น (60) ไม่งั้นเงาจางใต้ไอคอนจะถูกนับเป็นเนื้อภาพ กรอบจะเบี้ยว
  const boxA = contentBox(iconSheet, { x0: 0, y0: 0, x1: iconSheet.w, y1: iconSheet.h }, iconBg, 60);
  console.log(`ไอคอน  x ${boxA.x0}..${boxA.x1} · y ${boxA.y0}..${boxA.y1}`);

  // ตัดเข้ามาอีก เพราะขอบที่ anti-alias กับพื้นสว่างติดมาเป็นเส้นขอบสว่างรอบไอคอน
  // และเงายังตกไปทางขวาล่างด้วย เห็นชัดมากตอนย่อ
  const inset = Math.round(Math.min(boxA.x1 - boxA.x0, boxA.y1 - boxA.y0) * 0.05);
  let icon = crop(iconSheet, {
    x0: boxA.x0 + inset, y0: boxA.y0 + inset, x1: boxA.x1 - inset, y1: boxA.y1 - inset,
  });
  const side = Math.min(icon.w, icon.h);
  icon = resize(icon, side, side);

  const NAVY = px(icon, Math.round(side * 0.12), Math.round(side * 0.1)).slice(0, 3);
  console.log(`สีพื้นไอคอน #${NAVY.map((v) => v.toString(16).padStart(2, '0')).join('')}`);
  // รัศมีกว้างกว่าของต้นฉบับเล็กน้อย จะได้กินเข้าไปในเนื้อ ไม่เหลือมุมสว่างค้าง
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
    fs.writeFileSync(path.join(OUT_DIR, name), buf);
    console.log(`${name.padEnd(26)} ${size}x${size}  ${String(buf.length).padStart(6)} bytes`);
  }
  const fav = compose(icon, 128, 0.25, 1, NAVY);
  fs.writeFileSync(path.join(__dirname, '..', 'app', 'icon.png'), fav.buf);
  console.log(`app/icon.png               128x128  ${String(fav.buf.length).padStart(6)} bytes`);

  /* ============================== ชื่อแบรนด์ ============================== */
  const wordSheet = decodePng(fs.readFileSync(WORD_SRC));
  const wordBg = px(wordSheet, 4, 4);
  // 70 จับตัวอักษรสโลแกนสีเทาอ่อนได้ (ห่างจากพื้นราว 165) แต่ไม่ไปจับพื้นที่ไล่เฉดจางๆ
  const boxB = contentBox(wordSheet, { x0: 0, y0: 0, x1: wordSheet.w, y1: wordSheet.h }, wordBg, 70);
  console.log(`ชื่อแบรนด์  x ${boxB.x0}..${boxB.x1} · y ${boxB.y0}..${boxB.y1}`);

  /**
   * แยกเนื้อภาพเป็น "แถบข้อความ" ตามแนวนอน
   *
   * ใช้วิธีนี้แทนการมองหาช่องว่างที่กว้างที่สุด เพราะในไฟล์ต้นฉบับมีเงาจางอยู่ใต้โลโก้
   * ช่องว่างที่กว้างที่สุดจึงกลายเป็นช่องระหว่างสโลแกนกับเงา ไม่ใช่ระหว่างชื่อกับสโลแกน
   * พอแยกเป็นแถบแล้ว แถบแรกคือชื่อ แถบที่สองคือสโลแกน ที่เหลือเป็นเงา ทิ้งไปได้
   */
  function textBands(img, box, bg, tol, minGap = 6, minHeight = 10) {
    const tol2 = tol * tol;
    const ink = [];
    for (let y = box.y0; y <= box.y1; y++) {
      let has = false;
      for (let x = box.x0; x <= box.x1 && !has; x++) if (dist2(px(img, x, y), bg) > tol2) has = true;
      ink.push(has);
    }
    const bands = [];
    let start = -1;
    let gap = 0;
    for (let i = 0; i <= ink.length; i++) {
      if (i < ink.length && ink[i]) {
        if (start < 0) start = i;
        gap = 0;
      } else if (start >= 0) {
        gap++;
        if (gap >= minGap || i === ink.length) {
          const end = i - gap;
          if (end - start + 1 >= minHeight) bands.push({ y0: box.y0 + start, y1: box.y0 + end });
          start = -1;
          gap = 0;
        }
      }
    }
    return bands;
  }

  /** ขอบซ้าย-ขวาที่แคบที่สุดที่ยังครอบแถบที่เลือกไว้ครบ (ไม่เอาความกว้างของเงามาด้วย) */
  function xBoundsOf(img, box, bandList, bg, tol) {
    const tol2 = tol * tol;
    let x0 = box.x1;
    let x1 = -1;
    for (const b of bandList) {
      for (let y = b.y0; y <= b.y1; y++) {
        for (let x = box.x0; x <= box.x1; x++) {
          if (dist2(px(img, x, y), bg) <= tol2) continue;
          if (x < x0) x0 = x;
          if (x > x1) x1 = x;
        }
      }
    }
    return { x0, x1 };
  }

  const bands = textBands(wordSheet, boxB, wordBg, 70);
  console.log(`แถบข้อความ ${bands.length} แถบ: ${bands.map((b) => `${b.y0}-${b.y1}`).join(' · ')}`);
  if (bands.length < 2) throw new Error('แยกชื่อกับสโลแกนออกจากกันไม่ได้');
  const [bandWord, bandTag] = bands;
  const xw = xBoundsOf(wordSheet, boxB, [bandWord], wordBg, 70);
  const xf = xBoundsOf(wordSheet, boxB, [bandWord, bandTag], wordBg, 70);

  /** ทำพื้นให้โปร่งใสตามความสว่าง — ใช้แทน flood fill เพราะตัวอักษรมีช่องปิดข้างใน (o, e) */
  function keyOutBackground(img, bg, near = 30, far = 75) {
    for (let i = 0; i < img.w * img.h; i++) {
      const d = i * 4;
      const dist = Math.hypot(img.data[d] - bg[0], img.data[d + 1] - bg[1], img.data[d + 2] - bg[2]);
      /**
       * วัดจาก "ระยะห่างของสี" จากพื้นหลัง ไม่ใช่ความสว่าง
       *
       * เกณฑ์ความสว่างใช้ไม่ได้เพราะมันแปลว่า "อะไรที่สว่างคือพื้นหลัง"
       * ตัว EV ไล่เฉดฟ้าไปเขียว ปลายเขียวสว่างเกือบเท่าพื้น จึงโดนทำให้โปร่งไปด้วย
       * ระยะห่างของสีแยกได้ถูก เพราะเขียวสดห่างจากพื้นขาวมากแม้จะสว่างพอกัน
       *
       * near = ระยะที่ยังถือว่าเป็นพื้นหลัง เผื่อไว้กลบไล่เฉดจางๆ ในไฟล์ต้นฉบับ
       *        ถ้าไม่เผื่อ พื้นเปล่าจะเหลือ alpha นิดหน่อยทั่วทั้งภาพ
       *        วางบนพื้นเข้มแล้วเห็นเป็นแผ่นสี่เหลี่ยมจางๆ ไม่กลืนกับพื้นหลัง
       * far  = ระยะที่ถือว่าเป็นเนื้อภาพเต็มตัว ระหว่างสองค่านี้คือขอบที่ anti-alias ไว้
       */
      const a = (dist - near) / (far - near);
      img.data[d + 3] = Math.round(255 * Math.min(1, Math.max(0, a)));
    }
    return img;
  }

  /**
   * ทำรุ่นสำหรับพื้นหลังสีเข้ม — คำว่า "Kilo" เป็นกรมท่าเข้ม วางบนพื้นเข้มจะจมหายไป
   * แยกด้วย "ค่าความสด" (ช่องสีที่แรงที่สุด) ไม่ใช่ความสว่างรวม
   * เพราะน้ำเงินสดของ EV มีความสว่างรวมต่ำพอๆ กับกรมท่า (ราว 103 กับ 33)
   * ถ้าใช้ความสว่างจะไปทำให้ EV ซีดตามไปด้วย
   * แต่ค่าความสดต่างกันชัด: กรมท่า 64 · น้ำเงิน EV 240 · เขียว EV 210 · เทาสโลแกน 140
   */
  function forDarkBackground(img, light = [0xf1, 0xf5, 0xf9]) {
    const out = { w: img.w, h: img.h, data: Buffer.from(img.data) };
    for (let i = 0; i < img.w * img.h; i++) {
      const d = i * 4;
      if (out.data[d + 3] === 0) continue;
      const v = Math.max(out.data[d], out.data[d + 1], out.data[d + 2]);
      const t = Math.min(1, Math.max(0, (165 - v) / 60));   // ไล่ระดับ กันขอบแข็ง
      if (t <= 0) continue;
      for (let c = 0; c < 3; c++) out.data[d + c] = Math.round(out.data[d + c] * (1 - t) + light[c] * t);
    }
    return out;
  }

  const wordOnly = keyOutBackground(
    crop(wordSheet, { x0: xw.x0, x1: xw.x1, y0: bandWord.y0, y1: bandWord.y1 }), wordBg
  );
  const wordFull = keyOutBackground(
    crop(wordSheet, { x0: xf.x0, x1: xf.x1, y0: bandWord.y0, y1: bandTag.y1 }), wordBg
  );
  const outs = [
    ['wordmark.png', wordOnly],
    ['wordmark-on-dark.png', forDarkBackground(wordOnly)],
    ['wordmark-tagline.png', wordFull],
    ['wordmark-tagline-on-dark.png', forDarkBackground(wordFull)],
  ];
  for (const [name, img] of outs) {
    fs.writeFileSync(path.join(OUT_DIR, name), encodePng(img.w, img.h, img.data));
    console.log(`${name.padEnd(26)} ${img.w}x${img.h}`);
  }
  // เก็บไว้ให้ make-og.js ใช้ด้วย
  fs.writeFileSync(path.join(__dirname, 'brand-wordmark.png'), encodePng(wordFull.w, wordFull.h, wordFull.data));
}
