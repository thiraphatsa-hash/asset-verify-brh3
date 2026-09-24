-- ============================================================================
-- asset-speed.sql — ลดปริมาณข้อมูลที่ดาวน์โหลด (egress) ของระบบตรวจนับทรัพย์สิน
-- รันต่อจาก schema.sql / asset-rounds.sql / asset-duplicates.sql
-- (ถ้ายังไม่ได้รัน asset-counts.sql ก็รันไฟล์นี้ได้ ระบบจะข้ามส่วนยอดนับให้เอง)
--
-- ไฟล์นี้ไม่แก้ข้อมูลเดิมและไม่แตะสิทธิ์ RLS — เพิ่มแค่ 3 อย่าง
--   1) asset_master.updated_at  ให้รู้ว่าทะเบียนของรอบเปลี่ยนเมื่อไหร่
--   2) round_fingerprint(sid)   "ลายนิ้วมือ" ของรอบ (จำนวนแถว + เวลาล่าสุด)
--                               แอปถามอันนี้ก่อน ถ้าไม่เปลี่ยนก็ไม่ต้องโหลดอะไรเลย
--   3) sessions_progress()      ให้ฐานข้อมูลนับความคืบหน้าของทุกรอบมาให้
--                               แทนที่แอปจะดึงผลตรวจทุกแถวมานับเองในเครื่อง
-- ============================================================================

-- ── 1) ทะเบียนทรัพย์สิน: จำเวลาที่แก้ล่าสุด ────────────────────────────────
alter table asset_master add column if not exists updated_at timestamptz not null default now();

create or replace function touch_asset_master() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists asset_master_touch on asset_master;
create trigger asset_master_touch before update on asset_master
  for each row execute function touch_asset_master();

-- ── 2) ดัชนีสำหรับหา "ผลล่าสุดของแต่ละรหัสในรอบ" ให้เร็ว ───────────────────
create index if not exists verify_log_latest_idx
  on asset_verify_log (session_id, inventory_number, verified_at desc, log_id desc);
create index if not exists verify_log_created_idx
  on asset_verify_log (session_id, created_at);

-- ── 3) ลายนิ้วมือของรอบ ────────────────────────────────────────────────────
-- คืน json: { masters, masters_at, logs, logs_at, counts, counts_at }
-- ขนาดคำตอบไม่กี่ร้อยไบต์ เทียบกับการโหลดทะเบียน+ผลตรวจทั้งรอบหลายร้อย KB
create or replace function round_fingerprint(sid uuid) returns json
language plpgsql stable security definer set search_path = public as $$
declare
  out_json json;
  c_num bigint := 0;
  c_at  timestamptz;
begin
  if not is_active_role(array['viewer','counter','admin']) then
    raise exception 'ไม่มีสิทธิ์ดูข้อมูลรอบนี้';
  end if;
  if to_regclass('public.asset_count_log') is not null then
    execute 'select count(*), max(created_at) from asset_count_log where session_id = $1'
      into c_num, c_at using sid;
  end if;
  select json_build_object(
    'masters',    (select count(*)         from asset_master     where session_id = sid),
    'masters_at', (select max(updated_at)  from asset_master     where session_id = sid),
    'logs',       (select count(*)         from asset_verify_log where session_id = sid),
    'logs_at',    (select max(created_at)  from asset_verify_log where session_id = sid),
    'counts',     c_num,
    'counts_at',  c_at
  ) into out_json;
  return out_json;
end;
$$;

-- ── 4) ความคืบหน้าของทุกรอบ (นับฝั่งเซิร์ฟเวอร์) ───────────────────────────
-- 1 แถวต่อ 1 รอบ แทนการส่งผลตรวจทุกแถวมาให้แอปนับเอง
-- นับจาก "ผลล่าสุดของแต่ละรหัส" เหมือนที่แอปคำนวณ และไม่นับรายการนอกทะเบียน
create or replace function sessions_progress()
returns table (session_id uuid, checked bigint, found bigint, notfound bigint, moved bigint)
language sql stable security definer set search_path = public as $$
  with latest as (
    select distinct on (l.session_id, l.inventory_number)
           l.session_id as sid, l.result as result
      from asset_verify_log l
     where coalesce(l.unregistered, false) = false
       and is_active_role(array['viewer','counter','admin'])
     order by l.session_id, l.inventory_number, l.verified_at desc, l.log_id desc
  )
  select latest.sid,
         count(*)                                        as checked,
         count(*) filter (where latest.result = 'FOUND')     as found,
         count(*) filter (where latest.result = 'NOT_FOUND') as notfound,
         count(*) filter (where latest.result = 'MOVED')     as moved
    from latest
   group by latest.sid;
$$;

grant execute on function round_fingerprint(uuid) to authenticated;
grant execute on function sessions_progress()    to authenticated;
