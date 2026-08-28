/**
 * แปลงระหว่างชื่อคอลัมน์ในฐานข้อมูล (snake_case) กับชื่อฟิลด์ในแอป (camelCase)
 *
 * การมีชั้นนี้ทำให้โค้ดส่วนคำนวณและหน้าจอทั้งหมดไม่ต้องแก้เลยตอนย้ายมาใช้ Supabase
 * ทุกฟังก์ชันใน lib/calc.js และทุกหน้ายังทำงานกับชื่อฟิลด์เดิม
 */
import { DEFAULT_SETTINGS } from './defaults';

const num = (v) => (v === null || v === undefined || v === '' ? null : Number(v));

/* --------------------------------- รถ --------------------------------- */
export const carFromDb = (r) => ({
  id: r.id,
  name: r.name || '',
  brand: r.brand || '',
  model: r.model || '',
  batt: num(r.batt),
  range: num(r.range),
  odo: num(r.odo),
  plate: r.plate || '',
  photo: r.photo || null,
});
export const carToDb = (c, userId) => ({
  id: c.id,
  user_id: userId,
  name: c.name,
  brand: c.brand || null,
  model: c.model || null,
  batt: num(c.batt),
  range: num(c.range),
  odo: num(c.odo),
  plate: c.plate || null,
  photo: c.photo || null,
});

/* ---------------------------- การชาร์จแต่ละครั้ง ---------------------------- */
export const sessionFromDb = (r) => ({
  id: r.id,
  carId: r.car_id,
  date: r.date,
  time: r.time || '',
  type: r.type || 'AC',
  durationSec: num(r.duration_sec),
  station: r.station || '',
  odoBefore: num(r.odo_before),
  odoAfter: num(r.odo_after),
  socBefore: num(r.soc_before),
  socAfter: num(r.soc_after),
  kwh: num(r.kwh) ?? 0,
  price: num(r.price),
  fee: num(r.fee),
  total: num(r.total),
  dashEff: num(r.dash_eff),
  dashEffUnit: r.dash_eff_unit || 'km/kWh',
  note: r.note || '',
  images: r.images || [],
  created: r.created_at ? new Date(r.created_at).getTime() : 0,
});
export const sessionToDb = (s, userId) => ({
  id: s.id,
  user_id: userId,
  car_id: s.carId || null,
  date: s.date,
  time: s.time || null,
  type: s.type === 'DC' ? 'DC' : 'AC',
  duration_sec: s.durationSec === null || s.durationSec === undefined ? null : Math.round(Number(s.durationSec)),
  station: s.station || null,
  odo_before: num(s.odoBefore),
  odo_after: num(s.odoAfter),
  soc_before: num(s.socBefore),
  soc_after: num(s.socAfter),
  kwh: num(s.kwh) ?? 0,
  price: num(s.price),
  fee: num(s.fee),
  total: num(s.total),
  dash_eff: num(s.dashEff),
  dash_eff_unit: s.dashEffUnit || 'km/kWh',
  note: s.note || null,
  images: s.images || [],
});

/* ------------------------------- ต้นทุนรถ ------------------------------- */
export const costFromDb = (r) => ({
  id: r.id,
  carId: r.car_id,
  cat: r.cat || 'other',
  date: r.date,
  amount: num(r.amount) ?? 0,
  note: r.note || '',
  images: r.images || [],
});
export const costToDb = (c, userId) => ({
  id: c.id,
  user_id: userId,
  car_id: c.carId || null,
  cat: c.cat || 'other',
  date: c.date,
  amount: num(c.amount) ?? 0,
  note: c.note || null,
  images: c.images || [],
});

/* ------------------------------ การแจ้งเตือน ------------------------------ */
export const alertFromDb = (r) => ({
  id: r.id,
  carId: r.car_id,
  type: r.type || 'other',
  title: r.title || '',
  due: r.due,
  advance: num(r.advance),
  done: Boolean(r.done),
});
export const alertToDb = (a, userId) => ({
  id: a.id,
  user_id: userId,
  car_id: a.carId || null,
  type: a.type || 'other',
  title: a.title || null,
  due: a.due,
  advance: num(a.advance),
  done: Boolean(a.done),
});

/* ------------------------------- การตั้งค่า ------------------------------- */
export const settingsFromDb = (r) => {
  if (!r) return { ...DEFAULT_SETTINGS };
  return {
    theme: r.theme || 'auto',
    priceAC: num(r.price_ac),
    priceDC: num(r.price_dc),
    budget: num(r.budget) ?? 0,
    advanceDays: num(r.advance_days) ?? 30,
    activeCar: r.active_car || null,
    dashEffUnit: r.dash_eff_unit || 'km/kWh',
  };
};
export const settingsToDb = (s, userId) => ({
  user_id: userId,
  theme: s.theme || 'auto',
  price_ac: num(s.priceAC),
  price_dc: num(s.priceDC),
  budget: num(s.budget) ?? 0,
  advance_days: num(s.advanceDays) ?? 30,
  // '__all__' เป็นค่าที่ใช้ในหน้าจอเท่านั้น ไม่ใช่ id รถจริง จึงไม่เก็บลงฐานข้อมูล
  active_car: s.activeCar && s.activeCar !== '__all__' ? s.activeCar : null,
  dash_eff_unit: s.dashEffUnit || 'km/kWh',
  updated_at: new Date().toISOString(),
});
