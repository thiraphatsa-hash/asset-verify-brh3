-- ════════════════════════════════════════════════════════════════════════════
-- Asset Verification — รองรับ RT code ที่ใช้ซ้ำหลายชิ้น
--
-- หน้างานจริงพบว่า RT code เดียวกันถูกติดไว้กับทรัพย์สิน 2–3 ชิ้นคนละที่
-- ระบบจึงต้องแยกได้ว่า "พบอีกชิ้น" (นับเพิ่ม) กับ "บันทึกแก้ผลเดิม" (ไม่นับเพิ่ม)
--
-- piece_no = ชิ้นที่เท่าไรของ RT code นั้นในรอบนี้
--   บันทึกครั้งแรก           → 1
--   เลือก "พบอีกชิ้น"        → เลขชิ้นสูงสุดเดิม + 1
--   เลือก "แก้ไขผลเดิม"      → เลขชิ้นเดิมของ record ล่าสุด (สถานะทับของเดิม)
--
-- วิธีใช้: Supabase (โปรเจกต์ asset-verify-brh3) → SQL Editor → วางทั้งไฟล์ → Run
-- ⚠ ต้องรัน schema.sql + asset-rounds.sql มาก่อน · ไฟล์นี้รันซ้ำได้ปลอดภัย
-- ════════════════════════════════════════════════════════════════════════════

alter table asset_verify_log
  add column if not exists piece_no integer not null default 1;

create index if not exists verify_log_piece_idx
  on asset_verify_log (session_id, inventory_number, piece_no);

-- ตรวจผล: RT code ที่มีมากกว่า 1 ชิ้นในแต่ละรอบ
select s.site, s.round_name, l.inventory_number,
       max(l.piece_no) as จำนวนชิ้น,
       count(*)        as จำนวน_record
  from asset_verify_log l
  join asset_sessions s on s.session_id = l.session_id
 group by s.site, s.round_name, l.inventory_number
having max(l.piece_no) > 1
 order by max(l.piece_no) desc;
