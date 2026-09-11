-- เพิ่มช่อง "ระยะทางที่วิ่งได้" ก่อน/หลังชาร์จ ตามที่รถหรือแอปแสดงบนหน้าจอ
--
-- รันไฟล์นี้ใน Supabase SQL Editor ถ้าเคยรัน schema.sql ไปแล้วก่อนหน้านี้
-- (ถ้ายังไม่เคยรัน ให้รัน supabase/schema.sql อย่างเดียวก็พอ มีคอลัมน์นี้อยู่แล้ว)
--
-- รันซ้ำได้ไม่พัง เพราะใช้ if not exists
--
-- ต่างจาก odo_before/odo_after ตรงที่
--   odo_*   = เลขไมล์สะสมบนหน้าปัด ใช้คำนวณว่าขับมากี่กิโลเมตร
--   range_* = ตัวเลขที่รถบอกว่า "วิ่งได้อีกกี่กิโลเมตร" ที่ SOC นั้น (guess-o-meter)
-- สองอย่างนี้คนละเรื่องกัน จึงเก็บแยกคอลัมน์

alter table public.charge_sessions
  add column if not exists range_before numeric,
  add column if not exists range_after  numeric;
