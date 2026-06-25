-- ============================================================
-- v9 migration: ตารางตั้งค่ารวม (เก็บการจัดกลุ่มสินค้าให้ซิงค์ทุกเครื่อง)
-- เดิมเก็บใน localStorage (เครื่องใครเครื่องมัน) → ย้ายมาเก็บใน DB
-- รันใน Supabase SQL Editor ครั้งเดียว
-- ============================================================

CREATE TABLE IF NOT EXISTS mt_settings (
  key        text PRIMARY KEY,
  value      jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE mt_settings ENABLE ROW LEVEL SECURITY;

-- อ่านได้ทุกคน
DO $$ BEGIN
  CREATE POLICY "mt_settings_read" ON mt_settings FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- เพิ่ม/แก้ไข ได้เฉพาะผู้ที่ล็อกอินแล้ว
DO $$ BEGIN
  CREATE POLICY "mt_settings_insert" ON mt_settings FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "mt_settings_update" ON mt_settings FOR UPDATE USING (auth.uid() IS NOT NULL);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- เปิด realtime ให้ตารางนี้ (เพื่อให้ซิงค์สดทุกเครื่อง)
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE mt_settings;
EXCEPTION WHEN others THEN NULL; END $$;
