-- ════════════════════════════════════════════════════════════════════════════
-- Asset Verification — เพิ่มระบบ "รอบการตรวจนับ" (เหมือน MCR)
--   ทะเบียนทรัพย์สินผูกกับรอบ: 1 รอบ = 1 ไฟล์ที่อัปโหลด
--   ลบรอบ = ลบทะเบียนและผลตรวจของรอบนั้นทั้งหมด (cascade)
--
-- วิธีใช้: Supabase → SQL Editor → วางทั้งไฟล์ → Run
-- ไฟล์นี้รันซ้ำได้ปลอดภัย และย้ายข้อมูลเดิม (ถ้ามี) เข้ารอบแรกให้อัตโนมัติ
-- ⚠ ต้องรัน schema.sql ก่อนไฟล์นี้
-- ════════════════════════════════════════════════════════════════════════════

-- ── 1) ตารางรอบการตรวจนับ ────────────────────────────────────────────────────
create table if not exists asset_sessions (
  session_id    uuid primary key default gen_random_uuid(),
  site          text not null,                    -- รหัสโครงการ เช่น BRH3
  cost_center   text,                             -- เช่น R-BRH3-10A12
  round_name    text,                             -- ชื่อรอบ (ไม่บังคับ) เช่น "รอบ 2/2569"
  count_date_from date,
  count_date_to   date,
  inspector_name  text,                           -- ผู้รับผิดชอบรอบนี้
  note          text,
  file_name     text,
  asset_count   integer not null default 0,       -- จำนวนทรัพย์สินในรอบ (ตั้งตอน import)
  fixed_count   integer not null default 0,
  rental_count  integer not null default 0,
  status        text not null default 'Active',   -- Active | Completed
  created_at    timestamptz not null default now(),
  created_by    text
);
create index if not exists asset_sessions_site_idx on asset_sessions (site, created_at desc);

-- ── 2) ผูกทะเบียนทรัพย์สินเข้ากับรอบ ─────────────────────────────────────────
alter table asset_master add column if not exists asset_id uuid not null default gen_random_uuid();
alter table asset_master add column if not exists session_id uuid;

-- ย้ายข้อมูลเดิมที่ยังไม่มีรอบ → สร้างรอบแรกให้อัตโนมัติ (ทำครั้งเดียว)
do $$
declare
  legacy_site text;
  legacy_cc   text;
  new_id      uuid;
  n_fixed     integer;
  n_rental    integer;
begin
  if exists (select 1 from asset_master where session_id is null) then
    select coalesce(max(site), 'BRH3') into legacy_site from asset_master where session_id is null;
    select max(current_site) into legacy_cc from asset_master where session_id is null;
    select count(*) filter (where asset_type = 'FIXED'),
           count(*) filter (where asset_type = 'RENTAL')
      into n_fixed, n_rental
      from asset_master where session_id is null;

    insert into asset_sessions (site, cost_center, round_name, count_date_from, inspector_name,
                                note, asset_count, fixed_count, rental_count, created_by)
      values (legacy_site, legacy_cc, 'รอบแรก (ย้ายจากข้อมูลเดิม)', current_date, null,
              'สร้างอัตโนมัติตอนอัปเกรดเป็นระบบรอบตรวจ', n_fixed + n_rental, n_fixed, n_rental, 'system')
      returning session_id into new_id;

    update asset_master set session_id = new_id where session_id is null;
    update asset_verify_log set session_id = new_id where session_id is null;
    raise notice 'ย้ายทะเบียนเดิม % รายการเข้ารอบแรกแล้ว', n_fixed + n_rental;
  end if;
end $$;

-- เปลี่ยนคีย์หลัก: เดิมคีย์คือ inventory_number (ทั้งระบบมีได้ตัวเดียว)
-- ใหม่: asset_id เป็นคีย์ และ inventory_number ห้ามซ้ำ "ภายในรอบเดียวกัน" เท่านั้น
do $$
begin
  if exists (select 1 from pg_constraint where conname = 'asset_master_pkey'
               and conrelid = 'asset_master'::regclass
               and pg_get_constraintdef(oid) like '%inventory_number%') then
    alter table asset_master drop constraint asset_master_pkey;
    alter table asset_master add primary key (asset_id);
  end if;
exception when others then
  raise notice 'ข้ามการเปลี่ยน primary key: %', sqlerrm;
end $$;

alter table asset_master alter column session_id set not null;
do $$
begin
  alter table asset_master add constraint asset_master_session_fk
    foreign key (session_id) references asset_sessions(session_id) on delete cascade;
exception when duplicate_object then null;
end $$;
create unique index if not exists asset_master_session_inv_uidx
  on asset_master (session_id, inventory_number);
create index if not exists asset_master_session_idx on asset_master (session_id);

-- ── 3) ผูกผลตรวจเข้ากับรอบ ───────────────────────────────────────────────────
alter table asset_verify_log add column if not exists session_id uuid;
do $$
begin
  alter table asset_verify_log add constraint asset_verify_log_session_fk
    foreign key (session_id) references asset_sessions(session_id) on delete cascade;
exception when duplicate_object then null;
end $$;
create index if not exists verify_log_session_idx on asset_verify_log (session_id, verified_at desc);

-- ── 4) RLS ของตารางรอบ (ชุดเดียวกับตารางอื่น) ────────────────────────────────
alter table asset_sessions enable row level security;
drop policy if exists asset_sessions_read   on asset_sessions;
drop policy if exists asset_sessions_write  on asset_sessions;
drop policy if exists asset_sessions_update on asset_sessions;
drop policy if exists asset_sessions_delete on asset_sessions;
create policy asset_sessions_read on asset_sessions for select to authenticated
  using (is_active_role(array['viewer','counter','admin']));
create policy asset_sessions_write on asset_sessions for insert to authenticated
  with check (is_active_role(array['counter','admin']));
create policy asset_sessions_update on asset_sessions for update to authenticated
  using (is_active_role(array['counter','admin']))
  with check (is_active_role(array['counter','admin']));
create policy asset_sessions_delete on asset_sessions for delete to authenticated
  using (is_active_role(array['counter','admin']));

-- ลบผลตรวจได้เมื่อลบทั้งรอบ (cascade) — ส่วนการลบรายแถวยังจำกัดเฉพาะ admin ตามเดิม

-- ── 5) Realtime ──────────────────────────────────────────────────────────────
do $$
begin
  alter publication supabase_realtime add table asset_sessions;
exception when others then null;
end $$;

-- ── 6) ตรวจผลลัพธ์ ───────────────────────────────────────────────────────────
select s.site, s.round_name, s.asset_count,
       (select count(*) from asset_master m where m.session_id = s.session_id) as rows_actual
  from asset_sessions s order by s.created_at;
