-- ════════════════════════════════════════════════════════════════════════════
-- Asset Verification — เครื่องมือจัดการบัญชีผู้ใช้
--   1) ฟังก์ชันให้ admin ลบบัญชีถาวรได้จากในแอป
--   2) คำสั่งยืนยันอีเมลให้บัญชีที่ค้างอยู่ (แก้ปัญหา "Email not confirmed")
--
-- วิธีใช้: Supabase (โปรเจกต์ asset-verify-brh3) → SQL Editor → วางทั้งไฟล์ → Run
-- ⚠ ดูให้แน่ใจว่าอยู่โปรเจกต์ที่ถูกต้อง: Settings → API ต้องเป็น onwioowjaafxobuubhwf
-- ════════════════════════════════════════════════════════════════════════════

-- ── 1) ลบบัญชีถาวร (เฉพาะ admin) ─────────────────────────────────────────────
-- security definer = ทำงานด้วยสิทธิ์เจ้าของฟังก์ชัน จึงลบจาก auth.users ได้
-- ข้อมูลการตรวจที่บัญชีนั้นบันทึกไว้ "ไม่หาย" เพราะเก็บชื่อผู้ตรวจเป็นข้อความ
create or replace function admin_delete_user(target uuid)
returns void language plpgsql security definer set search_path = public, auth as $$
begin
  if not is_admin() then
    raise exception 'เฉพาะผู้ดูแลระบบ (admin) เท่านั้นที่ลบบัญชีได้';
  end if;
  if target = auth.uid() then
    raise exception 'ลบบัญชีตัวเองไม่ได้';
  end if;
  delete from public.profiles where id = target;
  delete from auth.users where id = target;
end $$;
revoke all on function admin_delete_user(uuid) from public;
grant execute on function admin_delete_user(uuid) to authenticated;

-- ── 2) ยืนยันอีเมลให้บัญชีที่สมัครไว้แล้วทั้งหมด ────────────────────────────────
-- ใช้เมื่อเจอ error "Email not confirmed" ตอน login
-- (ทางแก้ถาวรคือปิดสวิตช์ Confirm email — ดู docs/SETUP-DEPLOY.md ขั้นที่ 6)
update auth.users
   set email_confirmed_at = coalesce(email_confirmed_at, now())
 where email_confirmed_at is null;

-- ── 3) ตั้งบัญชีของคุณเป็น admin + เปิดใช้งาน (แก้อีเมลให้ตรงก่อนรัน) ───────────
insert into profiles (id, email, role, active)
  select id, email, 'admin', true from auth.users
   where email in ('thiraphat.sa@gmail.com', 'thiraphat@ritta.co.th')
  on conflict (id) do update set role = 'admin', active = true;

-- ── 4) ดูรายชื่อบัญชีทั้งหมดพร้อมสถานะ ───────────────────────────────────────
select u.email,
       (u.email_confirmed_at is not null) as email_ยืนยันแล้ว,
       p.role, p.active as เปิดใช้งาน, p.full_name as ชื่อที่แสดง
  from auth.users u left join profiles p on p.id = u.id
 order by u.created_at;
