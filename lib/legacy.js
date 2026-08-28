'use client';
/**
 * ย้ายข้อมูลรุ่นเดิม (localStorage + IndexedDB) ขึ้น Supabase
 *
 * แอปรุ่นก่อนเก็บทุกอย่างไว้ในเบราว์เซอร์ ไฟล์นี้อ่านข้อมูลนั้นออกมา
 * แปลง id ให้เป็น uuid สำหรับ Postgres แล้วอัปโหลดขึ้นบัญชีที่ล็อกอินอยู่
 * ใช้ครั้งเดียวแล้วลบทิ้ง — ถ้าไม่มีข้อมูลเดิมก็ไม่มีอะไรเกิดขึ้น
 */
import { LEGACY_KEY } from './defaults';
import { uuid } from './format';
import { bulkInsert, upsertSettings } from './db';
import { uploadDataUrl } from './storage';

const IDB_NAME = 'evlog-images';
const IDB_STORE = 'img';

/** อ่านข้อมูลเดิมจาก localStorage — คืน null ถ้าไม่มีหรืออ่านไม่ได้ */
export function readLegacy() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(LEGACY_KEY);
    if (!raw) return null;
    const d = JSON.parse(raw);
    const state = {
      cars: d.cars || [],
      sessions: d.sessions || [],
      costs: d.costs || [],
      alerts: d.alerts || [],
      settings: d.settings || {},
    };
    const total = state.cars.length + state.sessions.length + state.costs.length + state.alerts.length;
    return total > 0 ? state : null;
  } catch {
    return null;
  }
}

/** อ่านรูปเดิมทั้งหมดจาก IndexedDB เป็น Map<id, dataUrl> */
function readLegacyImages() {
  if (typeof window === 'undefined' || !window.indexedDB) return Promise.resolve(new Map());
  return new Promise((resolve) => {
    const req = indexedDB.open(IDB_NAME);
    req.onerror = () => resolve(new Map());
    req.onsuccess = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.close();
        return resolve(new Map());
      }
      const all = db.transaction(IDB_STORE, 'readonly').objectStore(IDB_STORE).getAll();
      all.onerror = () => { db.close(); resolve(new Map()); };
      all.onsuccess = () => {
        const map = new Map();
        for (const rec of all.result || []) if (rec.dataUrl) map.set(rec.id, rec.dataUrl);
        db.close();
        resolve(map);
      };
    };
    // ฐานข้อมูลยังไม่เคยถูกสร้าง — ไม่มีรูปให้ย้าย
    req.onupgradeneeded = () => { req.transaction.abort?.(); resolve(new Map()); };
  });
}

/** ลบข้อมูลเดิมทิ้งหลังย้ายสำเร็จ เพื่อไม่ให้ถามซ้ำ */
export function clearLegacy() {
  try {
    localStorage.removeItem(LEGACY_KEY);
  } catch { /* ไม่เป็นไร */ }
  try {
    indexedDB.deleteDatabase(IDB_NAME);
  } catch { /* ไม่เป็นไร */ }
}

/**
 * ย้ายข้อมูลเดิมขึ้นบัญชีที่ล็อกอินอยู่
 * @param onProgress รับข้อความบอกความคืบหน้าเป็นภาษาไทย
 * @returns จำนวนที่ย้ายได้ { cars, sessions, costs, alerts, images }
 */
export async function migrateLegacy(userId, onProgress = () => {}) {
  const legacy = readLegacy();
  if (!legacy) return null;

  onProgress('กำลังอ่านรูปแนบเดิม…');
  const legacyImages = await readLegacyImages();

  // id เดิมไม่ใช่ uuid จึงต้องออก id ใหม่ แล้วตามแก้ค่าที่อ้างถึงกันให้ครบ
  const carIdMap = new Map();
  const cars = legacy.cars.map((c) => {
    const id = uuid();
    carIdMap.set(c.id, id);
    return { ...c, id };
  });
  const mapCar = (oldId) => carIdMap.get(oldId) || null;

  // อัปโหลดรูปเดิมทีละใบแล้วจำ path ใหม่ไว้
  const imagePathMap = new Map();
  const usedImageIds = new Set();
  for (const s of legacy.sessions) (s.images || []).forEach((id) => usedImageIds.add(id));
  for (const c of legacy.costs) (c.images || []).forEach((id) => usedImageIds.add(id));

  let done = 0;
  const totalImages = Array.from(usedImageIds).filter((id) => legacyImages.has(id)).length;
  for (const oldId of usedImageIds) {
    const dataUrl = legacyImages.get(oldId);
    if (!dataUrl) continue;
    try {
      imagePathMap.set(oldId, await uploadDataUrl(dataUrl));
    } catch (e) {
      console.warn('ย้ายรูปไม่สำเร็จ ข้ามใบนี้', e);
    }
    done += 1;
    onProgress(`กำลังย้ายรูปแนบ ${done}/${totalImages}…`);
  }
  const mapImages = (ids = []) => ids.map((id) => imagePathMap.get(id)).filter(Boolean);

  const sessions = legacy.sessions.map((s) => {
    // ข้อมูลรุ่นแรกเก็บเวลาชาร์จเป็นนาทีในฟิลด์ duration
    const durationSec =
      s.durationSec ?? (s.duration === null || s.duration === undefined ? null : Number(s.duration) * 60);
    return { ...s, id: uuid(), carId: mapCar(s.carId), durationSec, images: mapImages(s.images) };
  });
  const costs = legacy.costs.map((c) => ({
    ...c, id: uuid(), carId: mapCar(c.carId), images: mapImages(c.images),
  }));
  const alerts = legacy.alerts.map((a) => ({ ...a, id: uuid(), carId: mapCar(a.carId) }));

  onProgress('กำลังอัปโหลดข้อมูลขึ้น Supabase…');
  await bulkInsert(userId, { cars, sessions, costs, alerts });

  const settings = { ...legacy.settings, activeCar: mapCar(legacy.settings.activeCar) };
  await upsertSettings(settings, userId);

  clearLegacy();
  return {
    cars: cars.length,
    sessions: sessions.length,
    costs: costs.length,
    alerts: alerts.length,
    images: imagePathMap.size,
  };
}
