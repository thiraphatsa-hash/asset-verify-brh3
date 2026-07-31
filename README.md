# Asset Verification — ระบบตรวจนับทรัพย์สิน (BRH3)

Web App ตรวจนับทรัพย์สินหน้างานด้วยมือถือ/แท็บเล็ต ทีมหลายคนตรวจพร้อมกันและเห็นผลของกันและกันแบบสด
สร้างด้วยโครงสร้างและ pattern เดียวกับ MCR Stock Count (`../supabase-web/`) แต่**แยก Supabase Project และ
แยก Cloudflare Pages project** เพื่อให้โควตาฟรีของทั้งสองระบบไม่ชนกัน

> โฟลเดอร์นี้อยู่นอก git repo ของ MCR (repo `mcr-stock-count` มี root ที่ `../supabase-web`)
> วิธี deploy อยู่ใน [docs/SETUP-DEPLOY.md](docs/SETUP-DEPLOY.md) ขั้นที่ 4

## เอกสาร

| ไฟล์ | ใช้ตอนไหน |
|---|---|
| [docs/SETUP-DEPLOY.md](docs/SETUP-DEPLOY.md) | ติดตั้งครั้งแรก: สร้าง Supabase project, รัน SQL, ขึ้น Cloudflare Pages |
| [docs/USER-GUIDE.md](docs/USER-GUIDE.md) | คู่มือทีมตรวจหน้างาน (ส่งให้ทีมได้เลย) |

## โครงสร้างไฟล์

```
asset-verify/
├── index.html          หน้าเว็บหลัก (แท็บ Fixed / ของเช่า / สรุปผล / จัดการ)
├── app.js              logic ทั้งหมด: รายการ, สแกน, บันทึก, คิวออฟไลน์, dashboard, export
├── styles.css          ธีมเขียว mobile-first (แยกสีจาก MCR ที่เป็นน้ำเงิน กันเปิดผิดแอป)
├── config.js           ⚠ ต้องเติม SUPABASE_URL + SUPABASE_ANON_KEY ของ project ใหม่
├── schema.sql          ⚠ รันใน Supabase SQL Editor ครั้งเดียวตอนติดตั้ง
├── reset.html          หน้าตั้งรหัสผ่านใหม่ (ปลายทางลิงก์รีเซ็ตจากอีเมล)
├── src/assetStore.js   data layer คุยกับ Supabase (window.AssetStore)
└── docs/               คู่มือติดตั้งและคู่มือผู้ใช้
```

## สถาปัตยกรรม

- **Frontend** — static HTML/CSS/vanilla JS ไม่มี build step (แก้ไฟล์แล้ว push ได้เลย)
- **Backend** — Supabase: PostgreSQL + Auth + Storage + Realtime
- **ตาราง** — `asset_master` (ทะเบียน 306 รายการ) และ `asset_verify_log` (**append-only** 1 การตรวจ = 1 แถว)
- **สถานะล่าสุดของทรัพย์สินแต่ละชิ้น = record ล่าสุดของรหัสนั้น** — ไม่มีการเขียนทับ ตรวจย้อนหลังได้เสมอ
- **Realtime** — ผลตรวจของคนอื่นเด้งเข้าเครื่องเราเองภายในไม่กี่วินาที + sync สำรองทุก 2 นาที
- **ออฟไลน์** — บันทึกลง IndexedDB ในเครื่องก่อนเสมอ แล้วส่งขึ้นเซิร์ฟเวอร์เมื่อมีเน็ต
  (รูปถ่ายก็อยู่ในคิวด้วย) กันข้อมูลหายตอนสัญญาณหลุด
- **สิทธิ์** — viewer ดูอย่างเดียว · counter บันทึกผลตรวจ · admin จัดการบัญชี/นำเข้าทะเบียน/ลบ record ที่ผิด

## ทะเบียนทรัพย์สิน (ข้อมูลจริงที่ตรวจแล้ว)

ไฟล์ `Assets_BRH3__30-7-69.xls` มี 2 ชีท รวม **306 รายการ ไม่มีรหัสซ้ำ**:

- **ทรัพย์สิน Fixed Assets — 270 รายการ** (62 หมวด) คอลัมน์: Asset Class, Asset Number, Sub Numb,
  Inventory Number, Description, Serial Number, Staff – Text, Current Site
- **ทรัพย์สินของเช่า — 36 รายการ** (7 หมวด) คอลัมน์: Material, Description, Inventory Number, Plan, Sloc

รหัสทรัพย์สินตรงรูปแบบ `RT-XXXX-XX-XXXX` ทั้งหมด — regex ที่ใช้จริงคือ
`RT-[A-Z0-9]{4}-[A-Z0-9]{2}-\d{4}` (ส่วนปีรองรับค่า `YY` ที่มีจริงในข้อมูล เช่น `RT-SDBX-YY-0038`)
ตัวสแกนจะดึงเฉพาะส่วนที่ตรงรูปแบบออกมา จึงอ่านได้แม้ QR จะมี URL หรือข้อความอื่นปนมา

⚠ **Staff – Text ว่าง 217 จาก 270 รายการ (80%)** — ตัวกรองผู้รับผิดชอบจึงมีตัวเลือก "(ไม่ระบุ)" ให้
ถ้าต้องการกรองตามคนได้จริงทั้งหมด ต้องเติมข้อมูลผู้รับผิดชอบในไฟล์ต้นทางก่อนนำเข้า
