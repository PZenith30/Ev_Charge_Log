/**
 * ระบบคำนวณอัตโนมัติทั้งหมดของแอป
 * ทุกฟังก์ชันคืนค่า null เมื่อข้อมูลไม่พอคำนวณ เพื่อให้ UI แสดง "—" ได้ตรงกัน
 */
import { isNum, n, daysBetween, todayISO } from './format';
import { DASH_UNITS, DEFAULT_DASH_UNIT } from './data';

/* ---------- ระดับรายการชาร์จ ---------- */

/** ระยะทางที่วิ่งได้ = เลขไมล์หลังชาร์จ − เลขไมล์ก่อนชาร์จ */
export function sDist(s) {
  if (!isNum(s.odoBefore) || !isNum(s.odoAfter)) return null;
  const d = Number(s.odoAfter) - Number(s.odoBefore);
  return d >= 0 ? d : null;
}
/** SOC ที่เพิ่มขึ้น = SOC หลังชาร์จ − SOC ก่อนชาร์จ */
export function sSoc(s) {
  if (!isNum(s.socBefore) || !isNum(s.socAfter)) return null;
  return Number(s.socAfter) - Number(s.socBefore);
}
/** ค่าใช้จ่ายรวมต่อครั้ง — ใช้ค่าที่ผู้ใช้กรอกทับถ้ามี ไม่งั้นคำนวณจาก kWh × ราคา + ค่าบริการ */
export const sTotal = (s) => (isNum(s.total) ? Number(s.total) : n(s.kwh) * n(s.price) + n(s.fee));

/** Efficiency — km/kWh */
export function sEff(s) {
  const d = sDist(s);
  return d !== null && d > 0 && n(s.kwh) > 0 ? d / n(s.kwh) : null;
}
/** Efficiency — km/100kWh */
export const sEff100 = (s) => {
  const e = sEff(s);
  return e === null ? null : e * 100;
};
/** อัตราสิ้นเปลืองมาตรฐาน — kWh/100km */
export const sKwh100 = (s) => {
  const e = sEff(s);
  return e === null || e === 0 ? null : 100 / e;
};
/** บาท/km */
export function sBahtKm(s) {
  const d = sDist(s);
  const t = sTotal(s);
  return d !== null && d > 0 && t > 0 ? t / d : null;
}
/** ราคาจริงต่อ kWh (รวมค่าบริการแล้ว) */
export function sPricePerKwh(s) {
  const k = n(s.kwh);
  return k > 0 ? sTotal(s) / k : null;
}

/**
 * อัตราสิ้นเปลืองที่อ่านจากหน้าปัด — `dashEff` เก็บเป็น km/kWh เสมอ
 * คืนค่าที่แปลงกลับเป็นหน่วยที่ผู้ใช้กรอกไว้ พร้อมชื่อหน่วย หรือ null ถ้าไม่ได้กรอก
 */
export function sDashReading(s) {
  if (!isNum(s.dashEff)) return null;
  const key = DASH_UNITS[s.dashEffUnit] ? s.dashEffUnit : DEFAULT_DASH_UNIT;
  return { value: DASH_UNITS[key].fromBase(Number(s.dashEff)), unit: key, base: Number(s.dashEff) };
}

export const sMonth = (s) => (s.date || '').slice(0, 7);
export const sYear = (s) => (s.date || '').slice(0, 4);

/* ---------- ระดับสรุปรวม ---------- */

/** สรุปรวมจากลิสต์การชาร์จ — ใช้ทั้งแดชบอร์ด ประวัติ และรายงาน */
export function summarize(list) {
  const o = {
    count: list.length, kwh: 0, cost: 0, dist: 0, fee: 0, seconds: 0,
    ac: 0, dc: 0, acKwh: 0, dcKwh: 0, acCost: 0, dcCost: 0,
  };
  for (const s of list) {
    const t = sTotal(s);
    const k = n(s.kwh);
    o.kwh += k;
    o.cost += t;
    o.dist += sDist(s) || 0;
    o.fee += n(s.fee);
    o.seconds += n(s.durationSec);
    if (s.type === 'DC') { o.dc++; o.dcKwh += k; o.dcCost += t; }
    else { o.ac++; o.acKwh += k; o.acCost += t; }
  }
  o.eff = o.kwh > 0 && o.dist > 0 ? o.dist / o.kwh : null;   // km/kWh
  o.eff100 = o.eff === null ? null : o.eff * 100;            // km/100kWh
  o.kwh100 = o.eff ? 100 / o.eff : null;                     // kWh/100km
  o.bahtKm = o.dist > 0 ? o.cost / o.dist : null;
  o.avgPrice = o.kwh > 0 ? o.cost / o.kwh : null;
  o.avgCost = o.count ? o.cost / o.count : null;
  o.acPrice = o.acKwh > 0 ? o.acCost / o.acKwh : null;
  o.dcPrice = o.dcKwh > 0 ? o.dcCost / o.dcKwh : null;
  return o;
}

/** รวมค่าใช้จ่ายรายเดือน (ค่าชาร์จ + ต้นทุนอื่น) เรียงจากเดือนเก่า → ใหม่ */
export function monthlyTotals(sessions, costs) {
  const map = new Map();
  const get = (k) => {
    if (!map.has(k)) map.set(k, { charge: 0, other: 0, kwh: 0, dist: 0, count: 0 });
    return map.get(k);
  };
  for (const s of sessions) {
    const m = get(sMonth(s));
    m.charge += sTotal(s);
    m.kwh += n(s.kwh);
    m.dist += sDist(s) || 0;
    m.count++;
  }
  for (const c of costs) get((c.date || '').slice(0, 7)).other += n(c.amount);
  map.delete('');
  return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
}

/** ค่าใช้จ่ายเฉลี่ยต่อเดือน — หารด้วยจำนวนเดือนที่มีข้อมูลจริง */
export function avgMonthlySpend(sessions, costs) {
  const m = monthlyTotals(sessions, costs);
  if (!m.length) return 0;
  return m.reduce((a, [, v]) => a + v.charge + v.other, 0) / m.length;
}

/* ---------- แจ้งเตือน ---------- */

/** เติมสถานะ (เหลืออีกกี่วัน / เลยกำหนด) ให้รายการเตือน แล้วเรียงตามความเร่งด่วน */
export function dueList(alerts, defaultAdvance = 30) {
  const today = todayISO();
  return alerts
    .filter((a) => !a.done)
    .map((a) => {
      const days = daysBetween(today, a.due);
      const win = isNum(a.advance) ? Number(a.advance) : defaultAdvance;
      return { ...a, days, level: days < 0 ? 'overdue' : days <= win ? 'soon' : 'ok' };
    })
    .sort((a, b) => a.days - b.days);
}

/** เลขไมล์ล่าสุดของรถ — จากการชาร์จครั้งล่าสุด หรือค่าตั้งต้นที่กรอกไว้ตอนเพิ่มรถ */
export function lastOdo(sessions, cars, carId) {
  const list = sessions
    .filter((s) => s.carId === carId && isNum(s.odoAfter))
    .sort((a, b) => (b.date + (b.time || '')).localeCompare(a.date + (a.time || '')));
  if (list.length) return Number(list[0].odoAfter);
  const car = cars.find((c) => c.id === carId);
  return car && isNum(car.odo) ? Number(car.odo) : null;
}

/** เรียงการชาร์จจากใหม่ → เก่า */
export const sortDesc = (list) =>
  list.slice().sort(
    (a, b) =>
      (b.date + (b.time || '')).localeCompare(a.date + (a.time || '')) || (b.created || 0) - (a.created || 0)
  );
