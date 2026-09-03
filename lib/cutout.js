'use client';
/**
 * ตัดพื้นหลังสีพื้นออกจากรูปรถ ให้เหลือแต่ตัวรถวางบนสีพื้นของธีม
 *
 * ทำในเบราว์เซอร์ด้วย canvas ล้วน ไม่เพิ่ม dependency และไม่ส่งรูปออกไปไหน
 * วิธี: หาสีพื้นหลังจากสี่มุมของภาพ แล้ว flood fill จากขอบเข้ามา
 *
 * ใช้ flood fill แทนการไล่ลบทุกพิกเซลที่สีใกล้เคียง เพราะรถสีขาวบนพื้นขาว
 * จะโดนลบทั้งคันถ้าเทียบสีอย่างเดียว — flood fill ลบเฉพาะส่วนที่ต่อถึงขอบภาพ
 *
 * ทำงานได้ดีกับรูปสตูดิโอ/รูปโปรโมตที่พื้นหลังเรียบ ซึ่งเป็นรูปรถส่วนใหญ่
 * รูปถ่ายจริงที่มีถนนกับต้นไม้จะถูกปฏิเสธตั้งแต่ขั้นตรวจมุม แล้วคืน null
 * ให้ผู้เรียกใช้รูปเดิมต่อ — ยอมไม่ตัดดีกว่าตัดจนรูปพัง
 */

const PATCH = 8;          // ขนาดจตุรัสที่ใช้สุ่มสีมุมภาพ
const MAX_SIDE = 900;     // ย่อก่อนประมวลผล กันภาพใหญ่มากทำให้หน่วง

/** ระยะห่างของสีแบบยกกำลังสอง — ไม่ถอดรากเพื่อประหยัดแรง */
function dist2(d, i, r, g, b) {
  const dr = d[i] - r;
  const dg = d[i + 1] - g;
  const db = d[i + 2] - b;
  return dr * dr + dg * dg + db * db;
}

/** สีเฉลี่ยของจตุรัสหนึ่งมุม พร้อมบอกว่าในมุมนั้นสีกระจายแค่ไหน */
function samplePatch(d, w, h, sx, sy) {
  let r = 0;
  let g = 0;
  let b = 0;
  let n = 0;
  for (let y = sy; y < sy + PATCH && y < h; y++) {
    for (let x = sx; x < sx + PATCH && x < w; x++) {
      const i = (y * w + x) * 4;
      r += d[i];
      g += d[i + 1];
      b += d[i + 2];
      n++;
    }
  }
  if (!n) return null;
  r /= n; g /= n; b /= n;

  let worst = 0;
  for (let y = sy; y < sy + PATCH && y < h; y++) {
    for (let x = sx; x < sx + PATCH && x < w; x++) {
      worst = Math.max(worst, dist2(d, (y * w + x) * 4, r, g, b));
    }
  }
  return { r, g, b, spread: Math.sqrt(worst) };
}

/**
 * หาสีพื้นหลังจากสี่มุม — คืน null ถ้าเชื่อไม่ได้ว่าพื้นหลังเป็นสีเรียบ
 * maxSpread คุมว่าในมุมเดียวกันสีต้องนิ่ง (กันมุมที่มีใบไม้หรือลายพื้น)
 * maxCornerGap คุมว่าสี่มุมต้องใกล้เคียงกัน (ยอมให้ไล่เฉดอ่อนๆ แบบฉากสตูดิโอได้)
 */
export function findBackgroundColor(d, w, h, { maxSpread = 26, maxCornerGap = 40 } = {}) {
  const corners = [
    samplePatch(d, w, h, 0, 0),
    samplePatch(d, w, h, Math.max(0, w - PATCH), 0),
    samplePatch(d, w, h, 0, Math.max(0, h - PATCH)),
    samplePatch(d, w, h, Math.max(0, w - PATCH), Math.max(0, h - PATCH)),
  ];
  if (corners.some((c) => !c || c.spread > maxSpread)) return null;

  const r = corners.reduce((a, c) => a + c.r, 0) / 4;
  const g = corners.reduce((a, c) => a + c.g, 0) / 4;
  const b = corners.reduce((a, c) => a + c.b, 0) / 4;

  const gap = Math.max(
    ...corners.map((c) => Math.hypot(c.r - r, c.g - g, c.b - b))
  );
  return gap > maxCornerGap ? null : { r, g, b };
}

/**
 * ลบพื้นหลังโดยแก้ค่า alpha ใน d โดยตรง
 * คืน { ok:false } เมื่อไม่ควรตัด ซึ่งกรณีนั้นจะไม่แตะ d เลย
 */
export function removeBackground(d, w, h, opts = {}) {
  const tol = opts.tolerance ?? 30;
  const minRemoved = opts.minRemoved ?? 0.08;   // ตัดได้น้อยเกินไป = พื้นหลังไม่ได้เรียบจริง
  const maxRemoved = opts.maxRemoved ?? 0.94;   // ตัดเกือบหมด = กินตัวรถไปด้วย

  const bg = findBackgroundColor(d, w, h, opts);
  if (!bg) return { ok: false, reason: 'พื้นหลังไม่ใช่สีเรียบ' };

  const total = w * h;
  const tol2 = tol * tol;
  const BG = 1;
  const KEEP = 2;
  const seen = new Uint8Array(total);
  const stack = new Int32Array(total);
  let sp = 0;

  const visit = (x, y) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const p = y * w + x;
    if (seen[p]) return;
    if (dist2(d, p * 4, bg.r, bg.g, bg.b) > tol2) {
      seen[p] = KEEP;
      return;
    }
    seen[p] = BG;
    stack[sp++] = p;
  };

  // เริ่มจากขอบภาพทั้งสี่ด้าน พื้นหลังที่ไม่ต่อถึงขอบจะไม่ถูกลบ
  for (let x = 0; x < w; x++) { visit(x, 0); visit(x, h - 1); }
  for (let y = 0; y < h; y++) { visit(0, y); visit(w - 1, y); }

  let removed = 0;
  while (sp > 0) {
    const p = stack[--sp];
    removed++;
    const x = p % w;
    const y = (p - x) / w;
    visit(x - 1, y);
    visit(x + 1, y);
    visit(x, y - 1);
    visit(x, y + 1);
  }

  // ตรวจก่อนแตะรูป ถ้าไม่ผ่านจะได้คืนรูปเดิมโดยไม่โดนแก้
  if (removed < total * minRemoved) return { ok: false, reason: 'ไม่มีพื้นหลังให้ตัด' };
  if (removed > total * maxRemoved) return { ok: false, reason: 'ตัดแล้วไม่เหลือตัวรถ' };

  let x0 = w;
  let y0 = h;
  let x1 = -1;
  let y1 = -1;
  const soft = tol * 0.9;

  for (let p = 0; p < total; p++) {
    const i = p * 4;
    if (seen[p] === BG) {
      d[i + 3] = 0;
      continue;
    }
    const x = p % w;
    const y = (p - x) / w;
    if (x < x0) x0 = x;
    if (x > x1) x1 = x;
    if (y < y0) y0 = y;
    if (y > y1) y1 = y;

    // ขอบนุ่ม: พิกเซลที่ติดพื้นหลัง ไล่ความทึบตามความต่างของสี ไม่ให้ขอบเป็นฟันเลื่อย
    const touchesBg =
      (x > 0 && seen[p - 1] === BG) ||
      (x < w - 1 && seen[p + 1] === BG) ||
      (y > 0 && seen[p - w] === BG) ||
      (y < h - 1 && seen[p + w] === BG);
    if (touchesBg) {
      const dd = Math.sqrt(dist2(d, i, bg.r, bg.g, bg.b));
      const a = Math.round(((dd - tol) / soft) * 255);
      d[i + 3] = Math.min(255, Math.max(60, a));
    }
  }

  return { ok: true, box: { x0, y0, x1, y1 }, removed, bg };
}

/* ------------------------- ส่วนที่ต้องใช้เบราว์เซอร์ ------------------------- */

// แคชผลไว้ต่อ src เพราะแถบข้างกับแดชบอร์ดแสดงรถคันเดียวกัน จะได้คำนวณครั้งเดียว
// เก็บ null ไว้ด้วย เพื่อจำว่ารูปนี้ตัดไม่ได้ ไม่ต้องลองซ้ำทุกครั้งที่เปลี่ยนหน้า
const CACHE = new Map();

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    // ต้องขอแบบ CORS ไม่งั้น canvas จะถูก taint แล้วอ่านพิกเซลไม่ได้
    // ถ้าปลายทางไม่ส่ง header ให้ การโหลดจะล้มที่นี่ แล้วเราคืนรูปเดิมไปใช้
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('โหลดรูปเพื่อตัดพื้นหลังไม่ได้'));
    img.src = src;
  });
}

/**
 * คืน data URL ของรูปที่ตัดพื้นหลังแล้ว (ครอบเฉพาะตัวรถ)
 * คืน null เมื่อทำไม่ได้ — ผู้เรียกต้องใช้รูปเดิมแทน
 */
export async function cutoutCar(src, opts = {}) {
  if (!src) return null;
  if (CACHE.has(src)) return CACHE.get(src);

  let result = null;
  try {
    const img = await loadImage(src);
    const iw = img.naturalWidth || img.width;
    const ih = img.naturalHeight || img.height;
    if (!iw || !ih) throw new Error('รูปไม่มีขนาด');

    const scale = Math.min(1, MAX_SIDE / Math.max(iw, ih));
    const w = Math.max(1, Math.round(iw * scale));
    const h = Math.max(1, Math.round(ih * scale));

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0, w, h);

    const imageData = ctx.getImageData(0, 0, w, h);  // โยน SecurityError ถ้า canvas ถูก taint
    const res = removeBackground(imageData.data, w, h, opts);

    if (res.ok) {
      ctx.putImageData(imageData, 0, 0);

      // เว้นขอบรอบตัวรถเล็กน้อย ไม่ให้ดูอึดอัดจนชนขอบกล่อง
      const pad = Math.round(Math.max(w, h) * 0.03);
      const x0 = Math.max(0, res.box.x0 - pad);
      const y0 = Math.max(0, res.box.y0 - pad);
      const x1 = Math.min(w - 1, res.box.x1 + pad);
      const y1 = Math.min(h - 1, res.box.y1 + pad);

      const out = document.createElement('canvas');
      out.width = x1 - x0 + 1;
      out.height = y1 - y0 + 1;
      out.getContext('2d').drawImage(canvas, x0, y0, out.width, out.height, 0, 0, out.width, out.height);
      result = out.toDataURL('image/png');
    }
  } catch {
    result = null;   // ตัดไม่ได้ด้วยเหตุใดก็ตาม ให้ใช้รูปเดิม
  }

  CACHE.set(src, result);
  return result;
}
