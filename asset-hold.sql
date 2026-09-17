-- ══════════════════════════════════════════════════════════════════════════
--  ระบบตรวจนับทรัพย์สิน — พักรอบตรวจ (Hold)
--  รันไฟล์นี้ใน Supabase SQL Editor ของโปรเจกต์ asset-verify-brh3
--  ลำดับทั้งหมด: schema.sql → asset-rounds.sql → auth-tools.sql → asset-duplicates.sql
--                → asset-counts.sql → asset-location.sql → asset-count-media.sql
--                → asset-hold.sql (ไฟล์นี้)
--  รันซ้ำได้ ไม่ทำข้อมูลเดิมหาย
-- ══════════════════════════════════════════════════════════════════════════
--  รอบที่ status = 'Hold'
--    • ผู้ตรวจ (counter) บันทึกผลตรวจ / ยอดนับ / แก้ทะเบียน / ลบรายการ / ลบรอบ ไม่ได้
--    • ผู้ดูแล (admin) ทำได้ทุกอย่างตามปกติ — ไว้เตรียมข้อมูลก่อนเปิดรอบ
--    • พักหรือเปิดรอบ (เปลี่ยน status) ได้เฉพาะผู้ดูแล
--  แอปล็อกหน้าจอให้อยู่แล้ว ไฟล์นี้กันที่ฐานข้อมูลอีกชั้น: คนที่เปิดหน้ารอบค้างไว้ก่อนถูกพัก
--  หรือมีรายการค้างส่งตอนออฟไลน์ จะส่งเข้ารอบที่พักไว้ไม่ได้ (ส่งได้เมื่อเปิดรอบแล้ว)

-- ── 1) เช็คว่ารอบถูกพักอยู่หรือไม่ ──────────────────────────────────────────
create or replace function session_on_hold(sid uuid) returns boolean
language sql security definer stable set search_path = public as $$
  select coalesce((select s.status = 'Hold' from asset_sessions s where s.session_id = sid), false);
$$;

-- ── 2) เปลี่ยนสถานะรอบได้เฉพาะผู้ดูแล ─────────────────────────────────────────
create or replace function guard_session_status() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  -- auth.uid() เป็น null = รันจาก SQL Editor / งานหลังบ้าน → ไม่บล็อก
  if auth.uid() is null or is_admin() then
    return new;
  end if;
  if tg_op = 'INSERT' then
    if coalesce(new.status, 'Active') = 'Hold' then
      raise exception 'เฉพาะผู้ดูแลระบบเท่านั้นที่สร้างรอบแบบพักไว้ (Hold) ได้';
    end if;
  elsif new.status is distinct from old.status then
    raise exception 'เฉพาะผู้ดูแลระบบเท่านั้นที่พักหรือเปิดรอบตรวจได้';
  elsif old.status = 'Hold' then
    raise exception 'รอบนี้พักไว้ (Hold) — แก้ไขได้เฉพาะผู้ดูแลระบบ';
  end if;
  return new;
end $$;
drop trigger if exists guard_session_status on asset_sessions;
create trigger guard_session_status before insert or update on asset_sessions
  for each row execute function guard_session_status();

-- ── 3) ผลตรวจรายชิ้น ────────────────────────────────────────────────────────
drop policy if exists verify_log_write on asset_verify_log;
create policy verify_log_write on asset_verify_log for insert to authenticated
  with check (is_active_role(array['counter','admin'])
              and (is_admin() or not session_on_hold(session_id)));
drop policy if exists verify_log_delete on asset_verify_log;
create policy verify_log_delete on asset_verify_log for delete to authenticated
  using (is_admin() or (is_active_role(array['counter','admin']) and created_by = auth.uid()
                        and not session_on_hold(session_id)));

-- ── 4) ทะเบียนของรอบ ───────────────────────────────────────────────────────
drop policy if exists asset_master_write on asset_master;
create policy asset_master_write on asset_master for insert to authenticated
  with check (is_active_role(array['counter','admin'])
              and (is_admin() or not session_on_hold(session_id)));
drop policy if exists asset_master_update on asset_master;
create policy asset_master_update on asset_master for update to authenticated
  using (is_active_role(array['counter','admin']) and (is_admin() or not session_on_hold(session_id)))
  with check (is_active_role(array['counter','admin']) and (is_admin() or not session_on_hold(session_id)));

-- ── 5) ลบรอบ ───────────────────────────────────────────────────────────────
drop policy if exists asset_sessions_delete on asset_sessions;
create policy asset_sessions_delete on asset_sessions for delete to authenticated
  using (is_active_role(array['counter','admin']) and (is_admin() or status is distinct from 'Hold'));

-- ── 6) ยอดนับตามหมวด (ข้ามถ้ายังไม่ได้รัน asset-counts.sql) ────────────────────
do $$
begin
  if to_regclass('public.asset_count_log') is not null then
    execute 'drop policy if exists count_log_write on asset_count_log';
    execute $p$create policy count_log_write on asset_count_log for insert to authenticated
      with check (is_active_role(array['counter','admin'])
                  and (is_admin() or not session_on_hold(session_id)))$p$;
    execute 'drop policy if exists count_log_delete on asset_count_log';
    execute $p$create policy count_log_delete on asset_count_log for delete to authenticated
      using (is_admin() or (is_active_role(array['counter','admin']) and created_by = auth.uid()
                            and not session_on_hold(session_id)))$p$;
  end if;
end $$;

-- ── 7) ตรวจผลลัพธ์ ────────────────────────────────────────────────────────
select coalesce(status, '(ว่าง)') as status, count(*) as rounds
  from asset_sessions group by status order by 1;
