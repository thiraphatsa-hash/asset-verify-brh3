-- ══════════════════════════════════════════════════════════════════════════
--  ระบบตรวจนับทรัพย์สิน — พื้นที่จัดเก็บ (Location) ของทรัพย์สินแต่ละชิ้น
--  รันไฟล์นี้ใน Supabase SQL Editor ของโปรเจกต์ asset-verify-brh3
--  ลำดับทั้งหมด: schema.sql → asset-rounds.sql → auth-tools.sql
--                → asset-duplicates.sql → asset-counts.sql → asset-location.sql (ไฟล์นี้)
--  รันซ้ำได้ ไม่ทำข้อมูลเดิมหาย
-- ══════════════════════════════════════════════════════════════════════════

-- พื้นที่จัดเก็บตามทะเบียน เช่น "โกดัง 1" / "Office" / "สโตร์"
--  • นำเข้าจากคอลัมน์ Location หรือ "Port ED - Text" ในไฟล์ทะเบียน
--  • ผู้ตรวจเติม/แก้ได้เองหน้างาน (ใช้ policy asset_master_update ที่มีอยู่แล้ว
--    ซึ่งอนุญาต role counter/admin)
alter table asset_master add column if not exists location      text;
alter table asset_master add column if not exists location_code text;   -- รหัสพื้นที่ เช่น Z006

create index if not exists asset_master_loc_idx on asset_master (session_id, location);

select 'asset_master.location พร้อมใช้งาน' as info,
       count(*) filter (where location is not null and location <> '') as rows_with_location,
       count(*) as total_rows
  from asset_master;
