/**
 * ที่เก็บข้อมูลฝั่งเบราว์เซอร์
 *  - localStorage : ข้อมูลตัวเลข/ข้อความทั้งหมด (เล็ก อ่านเขียนเร็ว)
 *  - IndexedDB    : รูปแนบ (สลิป / สกรีนช็อต) ซึ่งใหญ่เกินโควตาของ localStorage
 * แอปนี้ไม่มี backend ข้อมูลจึงอยู่เฉพาะในเบราว์เซอร์เครื่องที่ใช้งาน
 */
import { uid } from './format';

export const LS_KEY = 'evlog.v1';
export const AUTH_KEY = 'evlog.auth';

export const DEFAULT_SETTINGS = {
  theme: 'auto',          // auto | light | dark
  priceAC: 4.5,
  priceDC: 7.5,
  budget: 0,              // งบต่อเดือน (0 = ไม่ตั้ง)
  advanceDays: 30,        // เตือนล่วงหน้ากี่วัน
  activeCar: null,        // id ของรถที่เลือกอยู่ หรือ '__all__'
  dashEffUnit: 'km/kWh',  // หน่วยอัตราสิ้นเปลืองหน้าปัดที่เลือกไว้ครั้งล่าสุด
};

/**
 * ปรับข้อมูลเก่าให้เข้ากับโครงสร้างปัจจุบัน
 * v1 เก็บ `duration` เป็นนาที — ตอนนี้เก็บ `durationSec` เป็นวินาที เพื่อกรอก ชม./นาที/วินาที ได้
 */
export function migrateSession(s) {
  if (s.durationSec !== undefined || s.duration === undefined || s.duration === null) return s;
  const { duration, ...rest } = s;
  return { ...rest, durationSec: Number(duration) * 60 };
}

export const emptyState = () => ({
  cars: [],
  sessions: [],
  costs: [],
  alerts: [],
  settings: { ...DEFAULT_SETTINGS },
});

export function loadState() {
  if (typeof window === 'undefined') return emptyState();
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return emptyState();
    const d = JSON.parse(raw);
    return {
      cars: d.cars || [],
      sessions: (d.sessions || []).map(migrateSession),
      costs: d.costs || [],
      alerts: d.alerts || [],
      settings: { ...DEFAULT_SETTINGS, ...(d.settings || {}) },
    };
  } catch (e) {
    console.warn('อ่านข้อมูลเดิมไม่สำเร็จ', e);
    return emptyState();
  }
}

/** คืน true เมื่อบันทึกสำเร็จ, false เมื่อพื้นที่เต็ม */
export function saveState(state) {
  if (typeof window === 'undefined') return true;
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(state));
    return true;
  } catch (e) {
    console.error('บันทึกไม่สำเร็จ', e);
    return false;
  }
}

/* ------------------------------ IndexedDB ------------------------------ */
const IDB_NAME = 'evlog-images';
const IDB_STORE = 'img';
let dbPromise = null;

function db() {
  if (typeof window === 'undefined' || !window.indexedDB) return Promise.resolve(null);
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(IDB_NAME, 1);
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains(IDB_STORE)) {
          req.result.createObjectStore(IDB_STORE, { keyPath: 'id' });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    }).catch((e) => {
      console.warn('ใช้ IndexedDB ไม่ได้ รูปแนบจะไม่ถูกบันทึก', e);
      return null;
    });
  }
  return dbPromise;
}

function tx(mode, fn) {
  return db().then((d) => {
    if (!d) return null;
    return new Promise((resolve, reject) => {
      const t = d.transaction(IDB_STORE, mode);
      const req = fn(t.objectStore(IDB_STORE));
      t.oncomplete = () => resolve(req ? req.result : null);
      t.onerror = () => reject(t.error);
    });
  });
}

export const imgPut = (rec) => tx('readwrite', (st) => st.put(rec));
export const imgGet = (id) => tx('readonly', (st) => st.get(id));
export const imgDel = (id) => tx('readwrite', (st) => st.delete(id));
export const imgAll = () => tx('readonly', (st) => st.getAll()).then((r) => r || []);

/** ดึงรูปหลายใบพร้อมกัน ข้ามใบที่หาไม่เจอ */
export async function imgMany(ids = []) {
  const out = [];
  for (const id of ids) {
    const rec = await imgGet(id);
    if (rec) out.push(rec);
  }
  return out;
}

/** ลบรูปที่ไม่มีรายการไหนอ้างถึงแล้ว (เกิดจากแนบรูปแล้วปิดฟอร์มโดยไม่บันทึก) */
export async function gcImages(state) {
  const used = new Set();
  for (const s of state.sessions) (s.images || []).forEach((id) => used.add(id));
  for (const c of state.costs) (c.images || []).forEach((id) => used.add(id));
  const all = await imgAll();
  for (const rec of all) if (!used.has(rec.id)) await imgDel(rec.id);
}

/* --------------------------- แปลงไฟล์เป็นรูปย่อ --------------------------- */
const MAX_EDGE = 1600;
const JPEG_QUALITY = 0.82;

/** อ่านไฟล์รูป ย่อขนาด บีบอัด แล้วคืน record พร้อมเก็บลง IndexedDB */
export function fileToImageRecord(file) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onerror = () => reject(fr.error);
    fr.onload = () => {
      const im = new Image();
      im.onerror = () => reject(new Error('ไฟล์รูปไม่ถูกต้อง'));
      im.onload = () => {
        let { width: w, height: h } = im;
        const scale = Math.min(1, MAX_EDGE / Math.max(w, h));
        w = Math.round(w * scale);
        h = Math.round(h * scale);
        const cv = document.createElement('canvas');
        cv.width = w;
        cv.height = h;
        const cx = cv.getContext('2d');
        cx.fillStyle = '#ffffff';
        cx.fillRect(0, 0, w, h);
        cx.drawImage(im, 0, 0, w, h);
        let dataUrl;
        try {
          dataUrl = cv.toDataURL('image/jpeg', JPEG_QUALITY);
        } catch {
          dataUrl = fr.result;
        }
        // ถ้าบีบแล้วใหญ่กว่าเดิม (รูปเล็กมาก) ใช้ต้นฉบับ
        if (dataUrl.length > fr.result.length) dataUrl = fr.result;
        resolve({ id: uid(), dataUrl, name: file.name || 'image', ts: Date.now() });
      };
      im.src = fr.result;
    };
    fr.readAsDataURL(file);
  });
}

export async function addImageFiles(files) {
  const out = [];
  for (const f of Array.from(files)) {
    if (!f.type || !f.type.startsWith('image/')) continue;
    try {
      const rec = await fileToImageRecord(f);
      await imgPut(rec);
      out.push(rec);
    } catch (e) {
      console.warn('แนบรูปไม่สำเร็จ', e);
    }
  }
  return out;
}
