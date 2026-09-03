/** ฟังก์ชันช่วยจัดรูปแบบตัวเลข วันที่ และตรวจชนิดข้อมูล */

import { getLang, translate } from './i18n';
export const isNum = (v) => v !== null && v !== undefined && v !== '' && Number.isFinite(Number(v));
export const n = (v) => (isNum(v) ? Number(v) : 0);
export const nOrNull = (v) => (isNum(v) ? Number(v) : null);

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

/**
 * UUID v4 สำหรับใช้เป็น primary key — สร้างฝั่งเบราว์เซอร์เพื่อให้อัปเดตหน้าจอได้ทันที
 * โดยไม่ต้องรอ id ที่ฐานข้อมูลสร้างให้
 */
export function uuid() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  // สำรองไว้สำหรับเบราว์เซอร์เก่าหรือหน้าที่ไม่ได้เสิร์ฟผ่าน HTTPS
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export function fmt(v, d = 2) {
  if (v === null || v === undefined || !Number.isFinite(v)) return '—';
  return v.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
}
export const fmt0 = (v) => fmt(v, 0);
export const fmt1 = (v) => fmt(v, 1);

/**
 * แสดงทศนิยมเท่าที่มีจริง ไม่เติม 0 ต่อท้าย — 300 -> "300", 300.5 -> "300.5"
 * ตัดเศษที่เกิดจาก floating point ทิ้ง (300.29999999999995 -> "300.3")
 */
export function fmtAuto(v, d = 2) {
  if (v === null || v === undefined || !Number.isFinite(v)) return '—';
  return v.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: d });
}
/** ระยะทางเป็น km — เก็บทศนิยมไว้ตามที่กรอกจริง */
export const fmtDist = (v) => fmtAuto(v, 2);

/** วินาที -> "1 ชม. 25 นาที 30 วิ" (ข้ามหน่วยที่เป็น 0) */
export function fmtDuration(sec) {
  if (!Number.isFinite(sec) || sec <= 0) return '—';
  const total = Math.round(sec);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  // แปลหน่วยตามภาษาที่เลือก เรียก translate ตรงๆ เพราะไฟล์นี้ไม่ใช่คอมโพเนนต์ จึงใช้ hook ไม่ได้
  const parts = [];
  if (h) parts.push(`${h} ${translate('ชม.')}`);
  if (m) parts.push(`${m} ${translate('นาที')}`);
  if (s) parts.push(`${s} ${translate('วิ')}`);
  return parts.join(' ');
}
/** วินาที -> "01:25:30" สำหรับใส่ในไฟล์ CSV */
export function hms(sec) {
  if (!Number.isFinite(sec) || sec <= 0) return '';
  const total = Math.round(sec);
  const p = (x) => String(x).padStart(2, '0');
  return `${p(Math.floor(total / 3600))}:${p(Math.floor((total % 3600) / 60))}:${p(total % 60)}`;
}
/**
 * จำกัดทศนิยมของข้อความที่กำลังพิมพ์ให้ไม่เกิน d ตำแหน่ง — ตัดทิ้ง ไม่ปัดขึ้น
 * เพื่อไม่ให้ตัวเลขเด้งไปมาระหว่างพิมพ์ และคงสถานะกลางอย่าง "5." ไว้ได้
 */
export function limitDecimals(v, d = 2) {
  const str = String(v ?? '');
  const m = str.match(/^(-?\d*)(?:\.(\d*))?$/);
  if (!m || m[2] === undefined) return str;
  return m[2].length > d ? `${m[1]}.${m[2].slice(0, d)}` : str;
}

/** แยกวินาทีเป็น {h, m, s} สำหรับช่องกรอกสามช่อง */
export function splitDuration(sec) {
  if (!Number.isFinite(sec) || sec <= 0) return { h: '', m: '', s: '' };
  const total = Math.round(sec);
  return {
    h: String(Math.floor(total / 3600)),
    m: String(Math.floor((total % 3600) / 60)),
    s: String(total % 60),
  };
}
export const money = (v) => (v === null || v === undefined || !Number.isFinite(v) ? '—' : '฿' + fmt(v, 2));
export const money0 = (v) => (v === null || v === undefined || !Number.isFinite(v) ? '—' : '฿' + fmt(v, 0));

const trimZero = (s) => s.replace(/\.0$/, '');

/** ย่อตัวเลขให้สั้นสำหรับแกนกราฟและตัวเลขกลางโดนัท เช่น 12500 -> 12.5k, 125000 -> 125k */
export function shortNum(v) {
  const a = Math.abs(v);
  if (a >= 1e6) return trimZero((v / 1e6).toFixed(a >= 1e7 ? 0 : 1)) + 'M';
  if (a >= 1e3) return trimZero((v / 1e3).toFixed(a >= 1e5 ? 0 : 1)) + 'k';
  if (a >= 100) return v.toFixed(0);
  if (a >= 10) return trimZero(v.toFixed(a % 1 ? 1 : 0));
  return v.toFixed(a % 1 ? (a < 1 ? 2 : 1) : 0);
}

/** วันที่วันนี้ในรูปแบบ YYYY-MM-DD ตามเวลาท้องถิ่น (ไม่ใช่ UTC) */
export function todayISO(d = new Date()) {
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}
export const nowHM = () => new Date().toTimeString().slice(0, 5);

/** เลื่อนวันจากวันนี้ไป n วัน แล้วคืนเป็น YYYY-MM-DD */
export function shiftDays(days) {
  const t = new Date();
  t.setDate(t.getDate() + days);
  return todayISO(t);
}

/**
 * โลแคลสำหรับจัดรูปแบบวันที่ — ตามภาษาที่ผู้ใช้เลือก
 * โหมดไทยใช้ th-TH ซึ่งให้ปี พ.ศ. โหมดอังกฤษใช้ en-GB ซึ่งให้ปี ค.ศ. เรียงวัน-เดือน-ปี
 * อ่านค่าตอนเรียกทุกครั้ง ไม่เก็บไว้ เพราะสลับภาษาแล้วต้องเปลี่ยนตามทันที
 */
const dateLocale = () => (getLang() === 'en' ? 'en-GB' : 'th-TH');

export function thDate(iso, style) {
  if (!iso) return '—';
  const d = new Date(iso + 'T00:00:00');
  if (Number.isNaN(d.getTime())) return iso;
  if (style === 'long') return d.toLocaleDateString(dateLocale(), { day: 'numeric', month: 'long', year: 'numeric' });
  return d.toLocaleDateString(dateLocale(), { day: 'numeric', month: 'short', year: '2-digit' });
}
export function thMonth(ym) {
  const [y, m] = ym.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString(dateLocale(), { month: 'short', year: '2-digit' });
}
export function thMonthLong(ym) {
  const [y, m] = ym.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString(dateLocale(), { month: 'long', year: 'numeric' });
}
/** ปี พ.ศ. เมื่อใช้ภาษาไทย · ปี ค.ศ. เมื่อใช้ภาษาอังกฤษ */
export const thYear = (y) => String(getLang() === 'en' ? Number(y) : Number(y) + 543);

export const daysBetween = (a, b) =>
  Math.round((new Date(b + 'T00:00:00') - new Date(a + 'T00:00:00')) / 86400000);
