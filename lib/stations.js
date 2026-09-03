'use client';
/** ตัวช่วยฝั่งเบราว์เซอร์สำหรับหน้าสถานีชาร์จ */

/** เมืองตั้งต้น เผื่อผู้ใช้ไม่อนุญาตให้เข้าถึงตำแหน่ง */
export const CITY_PRESETS = [
  { name: 'กรุงเทพฯ', lat: 13.7563, lng: 100.5018 },
  { name: 'นนทบุรี', lat: 13.8591, lng: 100.5217 },
  { name: 'ชลบุรี / พัทยา', lat: 12.9236, lng: 100.8825 },
  { name: 'เชียงใหม่', lat: 18.7883, lng: 98.9853 },
  { name: 'ขอนแก่น', lat: 16.4419, lng: 102.8360 },
  { name: 'ภูเก็ต', lat: 7.8804, lng: 98.3923 },
  { name: 'หาดใหญ่', lat: 7.0086, lng: 100.4747 },
];

export const RADIUS_OPTIONS = [5, 10, 25, 50, 100];

/**
 * ขึ้น .v2 เพราะค่าที่เก็บด้วยรุ่นเก่าไม่มีฟิลด์ source จึงแยกไม่ออกว่า
 * ผู้ใช้เลือกเองหรือได้มาจาก GPS ที่อาจคลาดเคลื่อน ทิ้งของเก่าไปเลยปลอดภัยกว่า
 */
const LOC_KEY = 'evlog.lastLocation.v2';
const OLD_LOC_KEY = 'evlog.lastLocation';

/** ตำแหน่งที่เก็บได้ต้องบอกที่มาชัดเจน: user = ผู้ใช้เลือกเอง, gps = ได้จากเครื่อง */
const VALID_SOURCES = ['user', 'gps'];

export function readLastLocation() {
  try {
    localStorage.removeItem(OLD_LOC_KEY);   // ล้างของรุ่นเก่าที่เชื่อถือไม่ได้
    const raw = localStorage.getItem(LOC_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw);
    if (!Number.isFinite(v?.lat) || !Number.isFinite(v?.lng)) return null;
    return VALID_SOURCES.includes(v.source) ? v : null;
  } catch {
    return null;
  }
}
export function saveLastLocation(loc) {
  try {
    localStorage.setItem(LOC_KEY, JSON.stringify(loc));
  } catch { /* โหมดส่วนตัวเขียนไม่ได้ */ }
}

const geoError = (err) =>
  new Error(
    err.code === 1 ? 'ไม่ได้รับอนุญาตให้เข้าถึงตำแหน่ง — เลือกเมืองหรือพิมพ์ค้นหาสถานที่แทนได้'
    : err.code === 2 ? 'หาตำแหน่งไม่พบ ลองใหม่อีกครั้ง'
    : 'ขอตำแหน่งนานเกินไป ลองใหม่อีกครั้ง'
  );

/**
 * ขอตำแหน่งปัจจุบันจากเบราว์เซอร์
 * accuracyM คือรัศมีความคลาดเคลื่อนที่เบราว์เซอร์บอกมาเอง หน้าเว็ปเอาไปแสดงให้ผู้ใช้เห็น
 * จะได้รู้ตัวเมื่อได้ตำแหน่งหยาบ แทนที่จะงงว่าทำไมสถานีที่ขึ้นอยู่คนละย่าน
 */
export function getCurrentPosition({ highAccuracy = true, timeout = 15000 } = {}) {
  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      return reject(new Error('เบราว์เซอร์นี้ไม่รองรับการระบุตำแหน่ง'));
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        accuracyM: Number.isFinite(pos.coords.accuracy) ? pos.coords.accuracy : null,
        name: 'ตำแหน่งปัจจุบัน',
        source: 'gps',
      }),
      (err) => reject(geoError(err)),
      // maximumAge: 0 — ไม่เอาค่าที่แคชไว้ เพราะอาจเป็นตำแหน่งตอนอยู่ที่อื่น
      { enableHighAccuracy: highAccuracy, timeout, maximumAge: 0 }
    );
  });
}

/**
 * ขอตำแหน่งแบบละเอียดก่อน ถ้าไม่ทันค่อยถอยไปแบบหยาบ
 *
 * ขอละเอียดเป็นค่าเริ่มต้นเพราะแบบหยาบใช้ IP หรือ WiFi ซึ่งในกรุงเทพฯ
 * เพี้ยนได้หลายกิโลเมตร — พอเพี้ยนแล้วสถานีที่ขึ้นก็เป็นคนละย่านไปเลย
 * แต่ในอาคารหรือบนคอมตั้งโต๊ะอาจไม่มีสัญญาณ GPS จึงต้องมีทางถอย ไม่งั้นหน้าเว็ปใช้ไม่ได้เลย
 */
export async function locateBest() {
  try {
    return await getCurrentPosition({ highAccuracy: true, timeout: 15000 });
  } catch (e) {
    if (/ไม่ได้รับอนุญาต/.test(e.message)) throw e;   // ปฏิเสธสิทธิ์ ลองซ้ำไปก็ไม่ได้
    return getCurrentPosition({ highAccuracy: false, timeout: 10000 });
  }
}

/** ระยะคลาดเคลื่อนของตำแหน่ง แปลงเป็นข้อความสั้นๆ เช่น "±25 ม." หรือ "±3.4 กม." */
export function accuracyText(m) {
  if (!Number.isFinite(m) || m <= 0) return '';
  return m < 1000 ? `±${Math.round(m)} ม.` : `±${(m / 1000).toFixed(1)} กม.`;
}

/** ตำแหน่งหยาบเกินกว่าจะเชื่อได้ไหม — เกิน 1 กม. ในเมืองถือว่าคนละย่านแล้ว */
export const isCoarse = (m) => Number.isFinite(m) && m > 1000;

/** เรียก Route Handler ของเราเอง (คีย์ OCM อยู่ฝั่ง server) */
export async function fetchStations({ lat, lng, distance = 15, max = 60 }) {
  const qs = new URLSearchParams({
    lat: String(lat), lng: String(lng), distance: String(distance), max: String(max),
  });
  const res = await fetch(`/api/stations?${qs}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || `ค้นสถานีไม่สำเร็จ (HTTP ${res.status})`);
    err.code = data.code || null; // NO_KEY / BAD_KEY ใช้แยกหน้าจอตั้งค่าออกจาก error ทั่วไป
    throw err;
  }
  return data;
}

/** ลิงก์เปิดใน Google Maps — ใช้พิกัดจึงแม่นกว่าค้นด้วยชื่อ */
export const mapsLink = (s) =>
  `https://www.google.com/maps/search/?api=1&query=${s.lat},${s.lng}`;

/** สรุปหัวชาร์จให้อ่านง่าย เช่น "CCS2 150 kW · Type 2 22 kW" */
export function connectorSummary(connections = []) {
  const seen = new Map();
  for (const c of connections) {
    const label = [c.type, c.powerKW ? `${c.powerKW} kW` : null].filter(Boolean).join(' ');
    if (!label) continue;
    seen.set(label, (seen.get(label) || 0) + (c.quantity || 1));
  }
  return Array.from(seen.entries())
    .map(([label, qty]) => (qty > 1 ? `${label} ×${qty}` : label))
    .join(' · ');
}

/** ค้นชื่อสถานที่ให้เป็นพิกัด ผ่าน Route Handler ของเราเอง */
export async function geocode(query) {
  const q = String(query || '').trim();
  if (q.length < 2) return [];
  const res = await fetch(`/api/geocode?q=${encodeURIComponent(q)}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'ค้นสถานที่ไม่สำเร็จ');
  return data.places || [];
}

/** ข้อความค้นหาตรงกับสถานีนี้ไหม — ดูทั้งชื่อ ผู้ให้บริการ ที่อยู่ และชนิดหัวชาร์จ */
export function matchStation(station, query) {
  const q = String(query || '').trim().toLowerCase();
  if (!q) return true;
  const hay = [
    station.name,
    station.operator,
    station.address,
    station.town,
    ...(station.connections || []).map((c) => c.type),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  // ทุกคำที่พิมพ์ต้องเจอ จะได้ค้นแบบ "ptt ชลบุรี" ได้
  return q.split(/\s+/).every((word) => hay.includes(word));
}

/**
 * ขยับไปไกลพอที่จะต้องค้นสถานีใหม่ไหม (เกิน ~550 ม.)
 * GPS คืนค่าแกว่งเล็กน้อยทุกครั้งที่ขอ ถ้ายึดตามนั้นหมดจะยิง API ซ้ำโดยไม่ได้อะไรเพิ่ม
 */
export function movedFar(a, b) {
  if (!a || !b) return true;
  return Math.abs(a.lat - b.lat) > 0.005 || Math.abs(a.lng - b.lng) > 0.005;
}
