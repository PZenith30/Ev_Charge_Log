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

const LOC_KEY = 'evlog.lastLocation';

export function readLastLocation() {
  try {
    const raw = localStorage.getItem(LOC_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw);
    return Number.isFinite(v?.lat) && Number.isFinite(v?.lng) ? v : null;
  } catch {
    return null;
  }
}
export function saveLastLocation(loc) {
  try {
    localStorage.setItem(LOC_KEY, JSON.stringify(loc));
  } catch { /* โหมดส่วนตัวเขียนไม่ได้ */ }
}

/** ขอตำแหน่งปัจจุบันจากเบราว์เซอร์ — โยน Error พร้อมข้อความไทยเมื่อไม่สำเร็จ */
export function getCurrentPosition() {
  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      return reject(new Error('เบราว์เซอร์นี้ไม่รองรับการระบุตำแหน่ง'));
    }
    navigator.geolocation.getCurrentPosition(
      // gps:true บอกให้หน้าเว็ปรู้ว่าค่านี้มาจากเครื่อง จึงรีเฟรชเองได้เมื่อเปิดหน้าใหม่
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude, name: 'ตำแหน่งปัจจุบัน', gps: true }),
      (err) => {
        const msg =
          err.code === 1 ? 'ไม่ได้รับอนุญาตให้เข้าถึงตำแหน่ง — เลือกเมืองจากรายการแทนได้'
          : err.code === 2 ? 'หาตำแหน่งไม่พบ ลองใหม่อีกครั้ง'
          : 'ขอตำแหน่งนานเกินไป ลองใหม่อีกครั้ง';
        reject(new Error(msg));
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 5 * 60 * 1000 }
    );
  });
}

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
