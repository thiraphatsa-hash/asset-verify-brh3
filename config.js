// ค่าเชื่อมต่อ Supabase ของแอปตรวจนับทรัพย์สิน (คนละ Project กับ MCR Stock Count)
// anon key เปิดเผยได้ (public-safe) — RLS + login เป็นตัวคุมสิทธิ์
// ❌ ห้ามใส่ service_role key ในไฟล์นี้เด็ดขาด
window.ASSET_CONFIG = {
  // 👉 เติม 2 ค่านี้จาก Supabase → Project Settings → API (โปรเจกต์ใหม่ของแอปทรัพย์สิน)
  SUPABASE_URL: 'https://onwioowjaafxobuubhwf.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9ud2lvb3dqYWFmeG9idXViaHdmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU0MjYxNjMsImV4cCI6MjEwMTAwMjE2M30.teYUwE74buG0krJPcnizf_y_atl_qE4MIvvfFX1Ve8U',

  STORAGE_BUCKET: 'asset-files',
  SITE: 'BRH3',                       // รหัสโครงการของทะเบียนชุดนี้
  APP_TITLE: 'ตรวจนับทรัพย์สิน BRH3'
};
