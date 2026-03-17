# ADMIN THE MT — วิธีตั้งค่าโปรเจคใหม่

## 1. สร้าง Supabase Project
- ไปที่ https://supabase.com → New Project
- จดไว้: **Project URL** + **anon public key** (Settings → API)

## 2. รัน Database Schema
- Supabase Dashboard → **SQL Editor** → New Query
- วาง `supabase-full-schema.sql` ทั้งหมด → **Run**

## 3. สร้าง User หัวหน้า
- Supabase → **Authentication** → **Users** → **Add user**
  - Email: `a@gmail.com` (หรือ email จริง)
  - Password: `123456`
  - กด Create user
- กลับไป **SQL Editor** → รัน:
```sql
INSERT INTO profiles (id, full_name, role)
SELECT id, 'หัวหน้า', 'manager'
FROM auth.users WHERE email = 'a@gmail.com';
```

## 4. ตั้งค่า .env
```
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJxxxxxx
```

## 5. รันในเครื่อง
```bash
npm install
npm run dev
```

## 6. Deploy GitHub Pages
- สร้าง repo ใหม่ใน GitHub
- Settings → Secrets → เพิ่ม:
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY`
- Settings → Pages → Source: **GitHub Actions**
```bash
git init
git add .
git commit -m "initial"
git remote add origin https://github.com/YOUR/REPO.git
git push -u origin main
```

## 7. Google Sheet Backup
- ตั้งค่า Google Apps Script ตาม `google-apps-script.js`
- Deploy แล้วนำ URL ไปเปลี่ยนในไฟล์ `src/lib/sheetSync.js` บรรทัดที่ 2
