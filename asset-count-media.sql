-- ══════════════════════════════════════════════════════════════════════════
--  ระบบตรวจนับทรัพย์สิน — ให้ "ยอดนับตามหมวด" แนบรูปและเก็บพิกัด GPS ได้
--  รันไฟล์นี้ใน Supabase SQL Editor ของโปรเจกต์ asset-verify-brh3
--  ลำดับทั้งหมด: schema.sql → asset-rounds.sql → auth-tools.sql
--                → asset-duplicates.sql → asset-counts.sql
--                → asset-location.sql → asset-count-media.sql (ไฟล์นี้)
--  รันซ้ำได้ ไม่ทำข้อมูลเดิมหาย
-- ══════════════════════════════════════════════════════════════════════════

-- ยอดนับเดิมเก็บแค่จำนวนกับจุดที่นับ พอเอาไปทำรายงานจริงแล้วพิสูจน์ไม่ได้ว่านับที่ไหน
-- จึงเก็บรูปและพิกัดแบบเดียวกับผลตรวจรายชิ้น (ชนิดคอลัมน์ตรงกับ asset_verify_log)
alter table asset_count_log add column if not exists gps_lat      double precision;
alter table asset_count_log add column if not exists gps_lng      double precision;
alter table asset_count_log add column if not exists gps_accuracy double precision;
alter table asset_count_log add column if not exists photo_paths  jsonb not null default '[]'::jsonb;

-- ── ตรวจผลลัพธ์ ────────────────────────────────────────────────────────────
select 'asset_count_log พร้อมเก็บรูป/พิกัดแล้ว' as info,
       count(*)                                                   as total_rows,
       count(*) filter (where gps_lat is not null)                as rows_with_gps,
       count(*) filter (where jsonb_array_length(photo_paths) > 0) as rows_with_photo
from asset_count_log;
