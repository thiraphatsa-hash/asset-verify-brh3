-- ══════════════════════════════════════════════════════════════════════════
--  ระบบตรวจนับทรัพย์สิน — โหมดนับจำนวนตามหมวด + ให้ผู้ตรวจแก้ของตัวเองได้
--  รันไฟล์นี้ใน Supabase SQL Editor ของโปรเจกต์ asset-verify-brh3
--  ลำดับทั้งหมด: schema.sql → asset-rounds.sql → auth-tools.sql
--                → asset-duplicates.sql → asset-counts.sql (ไฟล์นี้)
--  รันซ้ำได้ ไม่ทำข้อมูลเดิมหาย
-- ══════════════════════════════════════════════════════════════════════════

-- ── 1) ตารางนับจำนวนตามหมวด ───────────────────────────────────────────────
--  ใช้ตอนเจอของหน้างานแต่ไม่ทราบ RT code เช่น เก้าอี้กองรวมกัน 20 ตัว
--  เก็บแยกจาก asset_verify_log โดยสิ้นเชิง → ผลตรวจรายชิ้นไม่เพี้ยน
--  แต่ละครั้งที่นับ = 1 แถว (นับหลายจุดได้ ระบบรวมยอดสะสมให้เอง)
create table if not exists asset_count_log (
  count_id      uuid primary key default gen_random_uuid(),
  client_id     text unique,                  -- id ฝั่งเครื่อง กันบันทึกซ้ำจาก offline retry
  session_id    uuid references asset_sessions(session_id) on delete cascade,
  site          text,
  asset_type    text not null default 'FIXED' check (asset_type in ('FIXED','RENTAL')),
  category_code text not null,                -- หมวด 4 ตัวใน RT code เช่น CHXX
  counted       integer not null default 0 check (counted >= 0),
  location_text text,                         -- จุดที่นับ เช่น "ชั้น 3 โซน B"
  note          text,
  inspector     text,                         -- ชื่อผู้นับ (จาก profile)
  counted_at    timestamptz not null default now(),
  created_by    uuid default auth.uid(),
  created_at    timestamptz not null default now()
);
create index if not exists count_log_session_idx on asset_count_log (session_id, counted_at desc);
create index if not exists count_log_cat_idx     on asset_count_log (session_id, category_code);

alter table asset_count_log enable row level security;
drop policy if exists count_log_read   on asset_count_log;
drop policy if exists count_log_write  on asset_count_log;
drop policy if exists count_log_delete on asset_count_log;
create policy count_log_read on asset_count_log for select to authenticated
  using (is_active_role(array['viewer','counter','admin']));
create policy count_log_write on asset_count_log for insert to authenticated
  with check (is_active_role(array['counter','admin']));
-- ลบได้ถ้าเป็น admin หรือเป็นแถวที่ตัวเองบันทึกไว้เอง
create policy count_log_delete on asset_count_log for delete to authenticated
  using (is_admin() or (is_active_role(array['counter','admin']) and created_by = auth.uid()));

-- Realtime: เครื่องอื่นเห็นยอดนับใหม่ทันที
do $$
begin
  begin
    alter publication supabase_realtime add table asset_count_log;
  exception when duplicate_object then null;
  end;
end $$;

-- ── 2) ผู้ตรวจแก้/ลบรายการที่ตัวเองบันทึกผิดได้ ────────────────────────────
--  ของเดิมลบได้เฉพาะ admin — หน้างานแก้เองไม่ได้ต้องรอผู้ดูแล
--  ยังคง append-only เหมือนเดิม (ไม่มี policy update) การ "แก้" = ลบแถวที่ผิดแล้วบันทึกใหม่
drop policy if exists verify_log_delete on asset_verify_log;
create policy verify_log_delete on asset_verify_log for delete to authenticated
  using (is_admin() or (is_active_role(array['counter','admin']) and created_by = auth.uid()));

-- ── 3) ตรวจผลลัพธ์ ────────────────────────────────────────────────────────
select 'asset_count_log rows' as info, count(*) as n from asset_count_log;
