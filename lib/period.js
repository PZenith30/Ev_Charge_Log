/**
 * ช่วงเวลาที่ใช้กรองข้อมูลทั้งแอป (แถบบน → แดชบอร์ด/สถิติ/รายงาน)
 * ทุกช่วงคืนเป็น {from, to} รูปแบบ YYYY-MM-DD แบบรวมปลายทั้งสองข้าง
 */
import { dateLocale, todayISO } from './format';

export const PERIOD_PRESETS = [
  { key: 'today', label: 'วันนี้' },
  { key: 'd7', label: '7 วันล่าสุด' },
  { key: 'd30', label: '30 วันล่าสุด' },
  { key: 'month', label: 'เดือนนี้' },
  { key: 'lastMonth', label: 'เดือนที่แล้ว' },
  { key: 'year', label: 'ปีนี้' },
  { key: 'all', label: 'ทั้งหมด' },
  { key: 'custom', label: 'กำหนดเอง' },
];

const iso = (d) => todayISO(d);
const shift = (d, days) => {
  const t = new Date(d);
  t.setDate(t.getDate() + days);
  return t;
};

/** คืนช่วงวันที่ของ preset — key 'all' คืน from/to เป็น null (ไม่กรอง) */
export function resolveRange(key, custom = {}) {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();

  switch (key) {
    case 'today':
      return { from: iso(now), to: iso(now) };
    case 'd7':
      return { from: iso(shift(now, -6)), to: iso(now) };
    case 'd30':
      return { from: iso(shift(now, -29)), to: iso(now) };
    case 'month':
      return { from: iso(new Date(y, m, 1)), to: iso(new Date(y, m + 1, 0)) };
    case 'lastMonth':
      return { from: iso(new Date(y, m - 1, 1)), to: iso(new Date(y, m, 0)) };
    case 'year':
      return { from: iso(new Date(y, 0, 1)), to: iso(new Date(y, 11, 31)) };
    case 'custom':
      return { from: custom.from || null, to: custom.to || null };
    case 'all':
    default:
      return { from: null, to: null };
  }
}

/**
 * ช่วงก่อนหน้าที่ยาวเท่ากัน ใช้คำนวณ "↑ 20% จากเดือนที่แล้ว"
 * คืน null เมื่อเทียบไม่ได้ (เช่นเลือก "ทั้งหมด")
 */
export function previousRange(range) {
  if (!range.from || !range.to) return null;
  const from = new Date(range.from + 'T00:00:00');
  const to = new Date(range.to + 'T00:00:00');
  const days = Math.round((to - from) / 86400000) + 1;
  return { from: iso(shift(from, -days)), to: iso(shift(from, -1)) };
}

/** คำอธิบายช่วงก่อนหน้าสำหรับข้อความแนวโน้ม */
export function comparisonLabel(key) {
  switch (key) {
    case 'today': return 'จากเมื่อวาน';
    case 'd7': return 'จาก 7 วันก่อนหน้า';
    case 'd30': return 'จาก 30 วันก่อนหน้า';
    case 'month': return 'จากเดือนที่แล้ว';
    case 'lastMonth': return 'จากเดือนก่อนหน้า';
    case 'year': return 'จากปีที่แล้ว';
    default: return 'จากช่วงก่อนหน้า';
  }
}

export const inRange = (dateStr, range) => {
  if (!dateStr) return false;
  if (range.from && dateStr < range.from) return false;
  if (range.to && dateStr > range.to) return false;
  return true;
};

export const filterByRange = (list, range) =>
  !range.from && !range.to ? list : list.filter((x) => inRange(x.date, range));

/** ข้อความบนปุ่มเลือกช่วงเวลา เช่น "1 – 31 ส.ค. 2569" */
export function rangeText(key, range) {
  if (key === 'all' || (!range.from && !range.to)) return 'ทั้งหมด';
  if (!range.from || !range.to) return 'กำหนดเอง';
  const opt = { day: 'numeric', month: 'short', year: '2-digit' };
  const a = new Date(range.from + 'T00:00:00');
  const b = new Date(range.to + 'T00:00:00');
  if (range.from === range.to) return a.toLocaleDateString(dateLocale(), opt);
  const sameYear = a.getFullYear() === b.getFullYear();
  const sameMonth = sameYear && a.getMonth() === b.getMonth();
  if (sameMonth) {
    return `${a.getDate()} – ${b.toLocaleDateString(dateLocale(), opt)}`;
  }
  return `${a.toLocaleDateString(dateLocale(), sameYear ? { day: 'numeric', month: 'short' } : opt)} – ${b.toLocaleDateString(dateLocale(), opt)}`;
}

/** เปอร์เซ็นต์เปลี่ยนแปลง — null เมื่อฐานเป็น 0 (เทียบไม่ได้) */
export function pctChange(current, previous) {
  if (!Number.isFinite(current) || !Number.isFinite(previous) || previous === 0) return null;
  return ((current - previous) / previous) * 100;
}
