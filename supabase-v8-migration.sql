-- ============================================================
-- v8 migration: กลุ่มประเภทสินค้า (ผูกหลายเพจเป็น 1 ประเภท)
-- ใช้สำหรับ "จัดกลุ่มเพจ → ประเภทสินค้า" ตอน Export
-- รันใน Supabase SQL Editor ครั้งเดียว
-- ============================================================

CREATE TABLE IF NOT EXISTS mt_product_groups (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL,
  pages      jsonb NOT NULL DEFAULT '[]'::jsonb,  -- รายชื่อเพจในกลุ่มนี้
  created_at timestamptz DEFAULT now()
);

ALTER TABLE mt_product_groups ENABLE ROW LEVEL SECURITY;

-- อ่านได้ทุกคน (ต้องใช้ตอนเลือกกลุ่มเพื่อ export)
DO $$ BEGIN
  CREATE POLICY "mt_pg_read" ON mt_product_groups FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- เพิ่ม/แก้ไข/ลบ ได้เฉพาะผู้ที่ล็อกอินแล้ว
DO $$ BEGIN
  CREATE POLICY "mt_pg_insert" ON mt_product_groups FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "mt_pg_update" ON mt_product_groups FOR UPDATE USING (auth.uid() IS NOT NULL);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "mt_pg_delete" ON mt_product_groups FOR DELETE USING (auth.uid() IS NOT NULL);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
