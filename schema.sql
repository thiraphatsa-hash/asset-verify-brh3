-- ════════════════════════════════════════════════════════════════════════════
-- Asset Verification (ตรวจนับทรัพย์สิน) — สคีมาฐานข้อมูลทั้งชุด
-- ใช้กับ Supabase Project ใหม่ (แยกจาก MCR Stock Count)
-- วิธีใช้: Supabase → SQL Editor → วางทั้งไฟล์ → Run (รันซ้ำได้ ไม่พังของเดิม)
--
-- โครงสร้างสิทธิ์ (โคลน pattern จาก MCR auth-roles.sql):
--   viewer  = ดูรายการ + Dashboard (อ่านอย่างเดียว)
--   counter = บันทึกผลตรวจได้ (ทีมตรวจหน้างาน)
--   admin   = ทุกอย่าง + จัดการบัญชี + นำเข้าทะเบียน + ลบ record ที่บันทึกผิด
-- ════════════════════════════════════════════════════════════════════════════

-- ── 1) ตาราง profiles (ผูกกับ auth.users) ───────────────────────────────────
create table if not exists profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  email      text,
  full_name  text,
  role       text not null default 'viewer',   -- viewer | counter | admin
  active     boolean not null default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ── 2) ฟังก์ชันช่วยเช็คสิทธิ์ (security definer = ข้าม RLS กันลูปซ้อน) ────────
create or replace function is_active_role(roles text[]) returns boolean
language sql security definer stable as $$
  select exists (select 1 from profiles
    where id = auth.uid() and active and role = any(roles));
$$;
create or replace function is_admin() returns boolean
language sql security definer stable as $$
  select exists (select 1 from profiles
    where id = auth.uid() and active and role = 'admin');
$$;

-- ── 3) สร้าง profile อัตโนมัติเมื่อสมัครใหม่ (role=viewer, รออนุมัติ) ───────────
create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, role, active)
  values (new.id, new.email, 'viewer', false)
  on conflict (id) do nothing;
  return new;
exception when others then
  return new;  -- ไม่ให้ trigger ทำให้การสมัครล้ม
end; $$;
do $$
begin
  drop trigger if exists on_auth_user_created on auth.users;
  create trigger on_auth_user_created after insert on auth.users
    for each row execute function handle_new_user();
exception when others then
  raise notice 'ข้ามการสร้าง trigger บน auth.users — แอปจะสร้าง profile เองตอนสมัคร: %', sqlerrm;
end $$;

-- ── 4) กันผู้ใช้แก้ role/active ของตัวเอง (เฉพาะ admin แก้ได้) ─────────────────
create or replace function guard_profile_update() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not is_admin() then
    new.role := old.role;
    new.active := old.active;
  end if;
  new.updated_at := now();
  return new;
end; $$;
drop trigger if exists profiles_guard on profiles;
create trigger profiles_guard before update on profiles
  for each row execute function guard_profile_update();

-- ── 5) RLS ของ profiles ──────────────────────────────────────────────────────
alter table profiles enable row level security;
drop policy if exists profiles_select on profiles;
create policy profiles_select on profiles for select to authenticated
  using (id = auth.uid() or is_admin());
drop policy if exists profiles_insert on profiles;
create policy profiles_insert on profiles for insert to authenticated
  with check (id = auth.uid() or is_admin());
drop policy if exists profiles_update on profiles;
create policy profiles_update on profiles for update to authenticated
  using (id = auth.uid() or is_admin()) with check (id = auth.uid() or is_admin());

-- ── 6) ทะเบียนทรัพย์สิน (Master — import จากไฟล์ Assets .xls) ─────────────────
create table if not exists asset_master (
  inventory_number text primary key,            -- เช่น RT-TAXX-25-0012 (คีย์หลัก)
  asset_type       text not null default 'FIXED'
                   check (asset_type in ('FIXED','RENTAL')),  -- FIXED=ชีท Fixed Assets, RENTAL=ชีทของเช่า
  category_code    text,                        -- ส่วนที่ 2 ของรหัส เช่น TAXX (derive ตอน import)
  description      text,
  -- คอลัมน์เฉพาะชีท Fixed Assets
  asset_class      text,
  asset_number     text,
  sub_number       text,
  serial_number    text,
  staff_text       text,                        -- ผู้รับผิดชอบ (ว่างได้)
  current_site     text,                        -- เช่น R-BRH3-10A12
  -- คอลัมน์เฉพาะชีทของเช่า
  material_code    text,                        -- รหัส SAP 11 หลัก
  plant            text,
  sloc             text,
  -- ข้อมูลระบบ
  site             text not null default 'BRH3',
  imported_at      timestamptz default now(),
  imported_by      text
);
create index if not exists asset_master_type_idx on asset_master (asset_type);
create index if not exists asset_master_cat_idx  on asset_master (category_code);
create index if not exists asset_master_site_idx on asset_master (site);

-- ── 7) บันทึกผลตรวจ (append-only: 1 การตรวจ = 1 แถว ห้าม update ทับ) ─────────
create table if not exists asset_verify_log (
  log_id           uuid primary key default gen_random_uuid(),
  client_id        text unique,                 -- id ฝั่งเครื่อง กันบันทึกซ้ำจาก offline retry
  inventory_number text not null,
  asset_type       text,                        -- FIXED | RENTAL | UNLISTED (snapshot ตอนบันทึก)
  site             text not null default 'BRH3',
  result           text not null check (result in ('FOUND','NOT_FOUND','MOVED')),
  condition        text check (condition in ('NORMAL','DAMAGED')),  -- เฉพาะเมื่อ FOUND
  method           text not null check (method in ('SCAN','MANUAL')),
  inspector        text,                        -- ชื่อผู้ตรวจ (จาก profile)
  location_text    text,                        -- อาคาร/ชั้น/ห้อง/โซน
  gps_lat          double precision,
  gps_lng          double precision,
  gps_accuracy     double precision,
  photo_paths      jsonb not null default '[]'::jsonb,  -- path ใน Storage bucket
  -- เฉพาะผล "ย้ายออก" (ตามโครงฟอร์มกระดาษเดิม)
  move_to_site     text,
  move_doc_no      text,
  move_date        date,
  note             text,
  unregistered     boolean not null default false,      -- ทรัพย์สินนอกทะเบียน
  unlisted_desc    text,                                -- คำอธิบายกรณีนอกทะเบียน
  verified_at      timestamptz not null default now(),  -- เวลาตรวจจริงฝั่งเครื่อง (offline ก็เวลาเดิม)
  created_by       uuid default auth.uid(),
  created_at       timestamptz not null default now()   -- เวลาที่แถวถึงเซิร์ฟเวอร์
);
create index if not exists verify_log_inv_idx  on asset_verify_log (inventory_number, verified_at desc);
create index if not exists verify_log_time_idx on asset_verify_log (verified_at desc);
create index if not exists verify_log_site_idx on asset_verify_log (site);

-- ── 8) RLS ของตารางข้อมูล ────────────────────────────────────────────────────
alter table asset_master enable row level security;
drop policy if exists asset_master_read   on asset_master;
drop policy if exists asset_master_write  on asset_master;
drop policy if exists asset_master_update on asset_master;
drop policy if exists asset_master_delete on asset_master;
create policy asset_master_read on asset_master for select to authenticated
  using (is_active_role(array['viewer','counter','admin']));
create policy asset_master_write on asset_master for insert to authenticated
  with check (is_active_role(array['counter','admin']));
create policy asset_master_update on asset_master for update to authenticated
  using (is_active_role(array['counter','admin']))
  with check (is_active_role(array['counter','admin']));
create policy asset_master_delete on asset_master for delete to authenticated
  using (is_active_role(array['counter','admin']));

alter table asset_verify_log enable row level security;
drop policy if exists verify_log_read   on asset_verify_log;
drop policy if exists verify_log_write  on asset_verify_log;
drop policy if exists verify_log_delete on asset_verify_log;
create policy verify_log_read on asset_verify_log for select to authenticated
  using (is_active_role(array['viewer','counter','admin']));
create policy verify_log_write on asset_verify_log for insert to authenticated
  with check (is_active_role(array['counter','admin']));
-- append-only: ไม่มี policy update เลย (ห้ามแก้ทับ) — ลบได้เฉพาะ admin (กรณีบันทึกผิดจริง)
create policy verify_log_delete on asset_verify_log for delete to authenticated
  using (is_admin());

-- ── 9) Realtime: ให้ทุกเครื่องเห็นผลตรวจของกันและกันแบบสด ─────────────────────
do $$
begin
  alter publication supabase_realtime add table asset_verify_log;
exception when others then
  raise notice 'asset_verify_log อยู่ใน publication แล้ว หรือเพิ่มไม่ได้: %', sqlerrm;
end $$;

-- ── 10) Storage bucket สำหรับรูปถ่าย ─────────────────────────────────────────
insert into storage.buckets (id, name, public)
  values ('asset-files', 'asset-files', false)
  on conflict (id) do nothing;

drop policy if exists asset_files_read   on storage.objects;
drop policy if exists asset_files_insert on storage.objects;
drop policy if exists asset_files_update on storage.objects;
drop policy if exists asset_files_delete on storage.objects;
create policy asset_files_read on storage.objects for select to authenticated
  using (bucket_id = 'asset-files' and is_active_role(array['viewer','counter','admin']));
create policy asset_files_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'asset-files' and is_active_role(array['counter','admin']));
create policy asset_files_update on storage.objects for update to authenticated
  using (bucket_id = 'asset-files' and is_active_role(array['counter','admin']))
  with check (bucket_id = 'asset-files' and is_active_role(array['counter','admin']));
create policy asset_files_delete on storage.objects for delete to authenticated
  using (bucket_id = 'asset-files' and is_admin());

-- ════════════════════════════════════════════════════════════════════════════
-- หลังสมัครบัญชีแรกของคุณผ่านหน้าแอปแล้ว ให้รันบรรทัดนี้ (แก้อีเมลเป็นของคุณ)
-- เพื่อตั้งตัวเองเป็น admin + เปิดใช้งาน:
--
--   update profiles set role = 'admin', active = true
--     where email = 'you@example.com';
-- ════════════════════════════════════════════════════════════════════════════
