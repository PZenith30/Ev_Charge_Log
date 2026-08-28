'use client';
/**
 * ชั้นคุยกับฐานข้อมูล Supabase — ที่เดียวที่มี query อยู่
 * ทุกฟังก์ชันโยน Error พร้อมข้อความไทยเมื่อผิดพลาด ให้ชั้นบนจับไปแสดง toast
 *
 * ไม่ต้องส่ง user_id ตอน select เพราะ RLS กรองให้แล้ว
 * แต่ตอน insert/update ต้องใส่ เพราะ policy ตรวจ with check (auth.uid() = user_id)
 */
import { supabase, dbErrorText } from './supabase';
import {
  alertFromDb, alertToDb, carFromDb, carToDb, costFromDb, costToDb,
  sessionFromDb, sessionToDb, settingsFromDb, settingsToDb,
} from './mappers';
import { DEFAULT_SETTINGS } from './defaults';

function check(error) {
  if (error) throw new Error(dbErrorText(error));
}

/** ดึงข้อมูลทั้งหมดของผู้ใช้ในครั้งเดียว (ยิงขนานกัน) */
export async function fetchAll(userId) {
  const [cars, sessions, costs, reminders, settings] = await Promise.all([
    supabase.from('cars').select('*').order('created_at', { ascending: true }),
    supabase.from('charge_sessions').select('*').order('date', { ascending: false }),
    supabase.from('costs').select('*').order('date', { ascending: false }),
    supabase.from('reminders').select('*').order('due', { ascending: true }),
    supabase.from('settings').select('*').eq('user_id', userId).maybeSingle(),
  ]);

  check(cars.error);
  check(sessions.error);
  check(costs.error);
  check(reminders.error);
  check(settings.error);

  // ผู้ใช้ที่สมัครก่อนติดตั้ง trigger อาจยังไม่มีแถว settings — สร้างให้ตรงนี้
  let settingsRow = settings.data;
  if (!settingsRow) {
    const created = await supabase
      .from('settings')
      .insert(settingsToDb(DEFAULT_SETTINGS, userId))
      .select()
      .maybeSingle();
    if (!created.error) settingsRow = created.data;
  }

  return {
    cars: (cars.data || []).map(carFromDb),
    sessions: (sessions.data || []).map(sessionFromDb),
    costs: (costs.data || []).map(costFromDb),
    alerts: (reminders.data || []).map(alertFromDb),
    settings: settingsFromDb(settingsRow),
  };
}

/* ------------------------------- เขียนข้อมูล ------------------------------- */
export async function upsertCar(car, userId) {
  const { error } = await supabase.from('cars').upsert(carToDb(car, userId));
  check(error);
}
export async function upsertSession(s, userId) {
  const { error } = await supabase.from('charge_sessions').upsert(sessionToDb(s, userId));
  check(error);
}
export async function upsertCost(c, userId) {
  const { error } = await supabase.from('costs').upsert(costToDb(c, userId));
  check(error);
}
export async function upsertAlert(a, userId) {
  const { error } = await supabase.from('reminders').upsert(alertToDb(a, userId));
  check(error);
}
export async function upsertSettings(s, userId) {
  const { error } = await supabase.from('settings').upsert(settingsToDb(s, userId));
  check(error);
}

const remove = (table) => async (id) => {
  const { error } = await supabase.from(table).delete().eq('id', id);
  check(error);
};
export const deleteCarRow = remove('cars');
export const deleteSessionRow = remove('charge_sessions');
export const deleteCostRow = remove('costs');
export const deleteAlertRow = remove('reminders');

/* ------------------------- เขียนหลายแถว (ใช้ตอนย้ายข้อมูล) ------------------------- */
export async function bulkInsert(userId, { cars = [], sessions = [], costs = [], alerts = [] }) {
  // ต้องใส่รถก่อน เพราะตารางอื่นอ้าง car_id เป็น foreign key
  if (cars.length) {
    const { error } = await supabase.from('cars').insert(cars.map((c) => carToDb(c, userId)));
    check(error);
  }
  const rest = [
    sessions.length && supabase.from('charge_sessions').insert(sessions.map((s) => sessionToDb(s, userId))),
    costs.length && supabase.from('costs').insert(costs.map((c) => costToDb(c, userId))),
    alerts.length && supabase.from('reminders').insert(alerts.map((a) => alertToDb(a, userId))),
  ].filter(Boolean);
  const results = await Promise.all(rest);
  results.forEach((r) => check(r.error));
}

/** ลบข้อมูลทั้งหมดของผู้ใช้ (รถถูกลบท้ายสุดเพราะตารางอื่นอ้างถึง) */
export async function deleteEverything(userId) {
  for (const table of ['charge_sessions', 'costs', 'reminders']) {
    const { error } = await supabase.from(table).delete().eq('user_id', userId);
    check(error);
  }
  const { error } = await supabase.from('cars').delete().eq('user_id', userId);
  check(error);
}
