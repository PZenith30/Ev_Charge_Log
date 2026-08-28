'use client';
/**
 * Supabase client ฝั่งเบราว์เซอร์
 * ใช้ anon key ซึ่งเปิดเผยได้ — ความปลอดภัยมาจาก Row Level Security ในฐานข้อมูล
 */
import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/** ตั้งค่า env ครบหรือยัง — ถ้ายัง แอปจะขึ้นหน้าบอกวิธีตั้งค่าแทนที่จะพังเงียบๆ */
export const isSupabaseConfigured = Boolean(url && anonKey);

export const supabase = isSupabaseConfigured
  ? createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;

export const IMAGE_BUCKET = 'charge-images';

/** แปลง error ของ Supabase เป็นข้อความไทยที่ผู้ใช้เข้าใจ */
export function authErrorText(error) {
  if (!error) return '';
  const msg = String(error.message || '').toLowerCase();
  if (msg.includes('invalid login credentials')) return 'อีเมลหรือรหัสผ่านไม่ถูกต้อง';
  if (msg.includes('email not confirmed')) return 'ยังไม่ได้ยืนยันอีเมล — กรุณาเปิดลิงก์ยืนยันในอีเมลก่อน';
  if (msg.includes('user already registered')) return 'อีเมลนี้สมัครไว้แล้ว ลองเข้าสู่ระบบแทน';
  if (msg.includes('password should be at least')) return 'รหัสผ่านสั้นเกินไป ต้องมีอย่างน้อย 6 ตัวอักษร';
  if (msg.includes('unable to validate email') || msg.includes('invalid email')) return 'รูปแบบอีเมลไม่ถูกต้อง';
  if (msg.includes('email rate limit') || msg.includes('too many requests')) {
    return 'ส่งคำขอถี่เกินไป กรุณารอสักครู่แล้วลองใหม่';
  }
  if (msg.includes('failed to fetch') || msg.includes('networkerror')) {
    return 'เชื่อมต่อ Supabase ไม่ได้ — ตรวจอินเทอร์เน็ตและค่า Project URL';
  }
  return error.message || 'เกิดข้อผิดพลาดที่ไม่รู้จัก';
}

/** แปลง error ของฐานข้อมูลเป็นข้อความไทย */
export function dbErrorText(error) {
  if (!error) return '';
  const msg = String(error.message || '').toLowerCase();
  if (msg.includes('row-level security')) {
    return 'ไม่มีสิทธิ์เขียนข้อมูลนี้ — ตรวจว่ารัน schema.sql ครบแล้วหรือยัง';
  }
  if (msg.includes('does not exist') || msg.includes('schema cache')) {
    return 'ยังไม่มีตารางในฐานข้อมูล — เปิด Supabase SQL Editor แล้วรัน supabase/schema.sql';
  }
  if (msg.includes('failed to fetch')) return 'เชื่อมต่อฐานข้อมูลไม่ได้ ตรวจอินเทอร์เน็ตอีกครั้ง';
  return error.message || 'บันทึกข้อมูลไม่สำเร็จ';
}
