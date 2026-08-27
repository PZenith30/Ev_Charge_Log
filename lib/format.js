/** ฟังก์ชันช่วยจัดรูปแบบตัวเลข วันที่ และตรวจชนิดข้อมูล */

export const isNum = (v) => v !== null && v !== undefined && v !== '' && Number.isFinite(Number(v));
export const n = (v) => (isNum(v) ? Number(v) : 0);
export const nOrNull = (v) => (isNum(v) ? Number(v) : null);

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

export function fmt(v, d = 2) {
  if (v === null || v === undefined || !Number.isFinite(v)) return '—';
  return v.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
}
export const fmt0 = (v) => fmt(v, 0);
export const fmt1 = (v) => fmt(v, 1);
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

export function thDate(iso, style) {
  if (!iso) return '—';
  const d = new Date(iso + 'T00:00:00');
  if (Number.isNaN(d.getTime())) return iso;
  if (style === 'long') return d.toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' });
  return d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' });
}
export function thMonth(ym) {
  const [y, m] = ym.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('th-TH', { month: 'short', year: '2-digit' });
}
export function thMonthLong(ym) {
  const [y, m] = ym.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('th-TH', { month: 'long', year: 'numeric' });
}
/** ปี พ.ศ. จากปี ค.ศ. (string หรือ number) */
export const thYear = (y) => String(Number(y) + 543);

export const daysBetween = (a, b) =>
  Math.round((new Date(b + 'T00:00:00') - new Date(a + 'T00:00:00')) / 86400000);
