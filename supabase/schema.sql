-- =====================================================================
-- KiloEV — โครงสร้างฐานข้อมูล Supabase
--
-- วิธีใช้: เปิด Supabase Dashboard > SQL Editor > New query
--          วางไฟล์นี้ทั้งไฟล์แล้วกด Run (รันซ้ำได้ ไม่พัง)
--
-- ทุกตารางเปิด Row Level Security และผูกกับ auth.uid()
-- ผู้ใช้แต่ละคนจึงเห็นและแก้ได้เฉพาะข้อมูลของตัวเองเท่านั้น
-- =====================================================================

-- ---------------------------------------------------------------- รถ
create table if not exists public.cars (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  name        text not null,
  brand       text,
  model       text,
  batt        numeric,          -- ความจุแบตเตอรี่ (kWh)
  range       numeric,          -- ระยะทางที่วิ่งได้ (km)
  odo         numeric,          -- เลขไมล์ตั้งต้น
  plate       text,
  photo       text,             -- path รูปรถในบัคเก็ต charge-images (ว่าง = ใช้ภาพวาดแทน)
  created_at  timestamptz not null default now()
);
-- เผื่อโปรเจกต์ที่สร้างตารางไว้ก่อนมีคอลัมน์นี้
alter table public.cars add column if not exists photo text;

-- ------------------------------------------------------ การชาร์จแต่ละครั้ง
create table if not exists public.charge_sessions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  car_id        uuid references public.cars (id) on delete cascade,
  date          date not null,
  time          text,                       -- เวลานาฬิกา (ข้อมูลเก่าเท่านั้น)
  type          text not null default 'AC', -- AC | DC
  duration_sec  integer,                    -- เวลาที่ใช้ชาร์จ (วินาที)
  station       text,
  odo_before    numeric,
  odo_after     numeric,
  soc_before    numeric,
  soc_after     numeric,
  kwh           numeric not null default 0,
  price         numeric,                    -- ราคา/kWh ที่กรอก
  fee           numeric,                    -- ค่าปรับ (ชื่อคอลัมน์คงเดิมจากรุ่นก่อนที่เรียกว่าค่าบริการเพิ่มเติม)
  discount      numeric,                    -- ส่วนลด
  total         numeric,                    -- ค่าใช้จ่ายรวม
  dash_eff      numeric,                    -- อัตราสิ้นเปลืองหน้าปัด เก็บเป็น km/kWh เสมอ
  dash_eff_unit text default 'km/kWh',      -- หน่วยที่ผู้ใช้กรอก ใช้แสดงกลับ
  note          text,
  images        text[] not null default '{}',  -- path ในบัคเก็ต charge-images
  created_at    timestamptz not null default now()
);

-- ------------------------------------------------------------ ต้นทุนรถ
create table if not exists public.costs (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  car_id      uuid references public.cars (id) on delete cascade,
  cat         text not null default 'other', -- electric | maintenance | insurance | tax | other
  date        date not null,
  amount      numeric not null default 0,
  note        text,
  images      text[] not null default '{}',
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------- การแจ้งเตือน
create table if not exists public.reminders (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  car_id      uuid references public.cars (id) on delete cascade,
  type        text not null default 'maintenance', -- maintenance | insurance | tax | other
  title       text,
  due         date not null,
  advance     integer,          -- เตือนล่วงหน้ากี่วัน (ว่าง = ใช้ค่ากลาง)
  done        boolean not null default false,
  created_at  timestamptz not null default now()
);

-- ------------------------------------------------- การตั้งค่า (1 แถวต่อผู้ใช้)
create table if not exists public.settings (
  user_id       uuid primary key references auth.users (id) on delete cascade,
  theme         text default 'auto',      -- auto | light | dark
  price_ac      numeric default 4.5,
  price_dc      numeric default 7.5,
  budget        numeric default 0,        -- งบต่อเดือน (0 = ไม่ตั้ง)
  advance_days  integer default 30,
  active_car    uuid references public.cars (id) on delete set null,
  dash_eff_unit text default 'km/kWh',
  updated_at    timestamptz not null default now()
);

-- ------------------------------------------------------------- ดัชนี
create index if not exists cars_user_idx             on public.cars (user_id);
create index if not exists charge_sessions_user_idx  on public.charge_sessions (user_id, date desc);
create index if not exists charge_sessions_car_idx   on public.charge_sessions (car_id);
create index if not exists costs_user_idx            on public.costs (user_id, date desc);
create index if not exists reminders_user_idx        on public.reminders (user_id, due);

-- =====================================================================
-- สิทธิ์ระดับตาราง (GRANT) — คนละชั้นกับ RLS และต้องมีทั้งคู่
--
--   GRANT = role ไหน "แตะตารางนี้ได้ไหม"
--   RLS   = แตะได้แล้ว "เห็นแถวไหนบ้าง"
--
-- ถ้าขาด GRANT จะขึ้น "permission denied for table cars" ตั้งแต่ยังไม่ถึง RLS
-- โปรเจกต์ Supabase บางรุ่นไม่ได้ตั้ง default privileges ให้ จึงประกาศไว้ตรงนี้ให้ชัด
--
-- ให้สิทธิ์เฉพาะ role `authenticated` เท่านั้น ไม่ให้ `anon`
-- คนที่ยังไม่ล็อกอินจึงยิงเข้าตารางเหล่านี้ไม่ได้เลย
-- =====================================================================
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;

-- ตารางที่สร้างเพิ่มทีหลังจะได้สิทธิ์เดียวกันโดยไม่ต้องมารันซ้ำ
alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema public
  grant usage, select on sequences to authenticated;

-- =====================================================================
-- Row Level Security — ทุกตารางเห็นเฉพาะแถวที่ user_id ตรงกับผู้ใช้ที่ล็อกอิน
-- =====================================================================
alter table public.cars            enable row level security;
alter table public.charge_sessions enable row level security;
alter table public.costs           enable row level security;
alter table public.reminders       enable row level security;
alter table public.settings        enable row level security;

do $$
declare t text;
begin
  foreach t in array array['cars', 'charge_sessions', 'costs', 'reminders'] loop
    execute format('drop policy if exists %I on public.%I', t || '_select_own', t);
    execute format('drop policy if exists %I on public.%I', t || '_insert_own', t);
    execute format('drop policy if exists %I on public.%I', t || '_update_own', t);
    execute format('drop policy if exists %I on public.%I', t || '_delete_own', t);

    execute format(
      'create policy %I on public.%I for select using (auth.uid() = user_id)',
      t || '_select_own', t);
    execute format(
      'create policy %I on public.%I for insert with check (auth.uid() = user_id)',
      t || '_insert_own', t);
    execute format(
      'create policy %I on public.%I for update using (auth.uid() = user_id) with check (auth.uid() = user_id)',
      t || '_update_own', t);
    execute format(
      'create policy %I on public.%I for delete using (auth.uid() = user_id)',
      t || '_delete_own', t);
  end loop;
end $$;

drop policy if exists settings_select_own on public.settings;
drop policy if exists settings_insert_own on public.settings;
drop policy if exists settings_update_own on public.settings;
create policy settings_select_own on public.settings
  for select using (auth.uid() = user_id);
create policy settings_insert_own on public.settings
  for insert with check (auth.uid() = user_id);
create policy settings_update_own on public.settings
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- =====================================================================
-- สร้างแถว settings ให้อัตโนมัติเมื่อมีผู้ใช้ใหม่สมัคร
-- (แอปเผื่อกรณีนี้ไว้อยู่แล้ว แต่มี trigger จะสะอาดกว่า)
-- =====================================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.settings (user_id) values (new.id) on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =====================================================================
-- ที่เก็บรูปแนบ — บัคเก็ตแบบส่วนตัว เข้าถึงผ่าน signed URL เท่านั้น
-- โครงสร้าง path คือ <user_id>/<uuid>.jpg ทำให้กันข้ามผู้ใช้ได้ด้วย policy
-- =====================================================================
insert into storage.buckets (id, name, public)
values ('charge-images', 'charge-images', false)
on conflict (id) do nothing;

drop policy if exists charge_images_select_own on storage.objects;
drop policy if exists charge_images_insert_own on storage.objects;
drop policy if exists charge_images_update_own on storage.objects;
drop policy if exists charge_images_delete_own on storage.objects;

create policy charge_images_select_own on storage.objects for select
  using (bucket_id = 'charge-images' and (storage.foldername(name))[1] = auth.uid()::text);
create policy charge_images_insert_own on storage.objects for insert
  with check (bucket_id = 'charge-images' and (storage.foldername(name))[1] = auth.uid()::text);
create policy charge_images_update_own on storage.objects for update
  using (bucket_id = 'charge-images' and (storage.foldername(name))[1] = auth.uid()::text);
create policy charge_images_delete_own on storage.objects for delete
  using (bucket_id = 'charge-images' and (storage.foldername(name))[1] = auth.uid()::text);
