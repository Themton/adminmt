-- ============================================================
-- v11 migration: ปิดช่องโหว่สิทธิ์ตาราง mt_orders
-- เดิม: policy "mt_manage_orders" (ALL, true) → ใครก็ได้ (แม้ไม่ล็อกอิน)
--       อ่าน/แก้/ลบ ออเดอร์และข้อมูลลูกค้าได้หมด
-- ใหม่:
--   • อ่าน / ลงออเดอร์ → ต้องล็อกอิน
--   • แก้ไข / ลบ       → เฉพาะ manager, admin, packer, head
--   • พนักงาน (employee) แก้/ลบไม่ได้ ("ไม่สามารถแก้ไขหรือลบได้หลังบันทึก")
-- รันใน Supabase SQL Editor ครั้งเดียว (รันซ้ำได้ ไม่พัง)
-- ============================================================

-- อ่าน role ของคนที่ล็อกอิน (SECURITY DEFINER กัน RLS วนลูป)
CREATE OR REPLACE FUNCTION mt_my_role() RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT role FROM mt_profiles WHERE id = auth.uid()
$$;

ALTER TABLE mt_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "mt_manage_orders" ON mt_orders;
DROP POLICY IF EXISTS "mt_read_orders"   ON mt_orders;
DROP POLICY IF EXISTS "mt_insert_orders" ON mt_orders;
DROP POLICY IF EXISTS "mt_update_orders" ON mt_orders;
DROP POLICY IF EXISTS "mt_delete_orders" ON mt_orders;

CREATE POLICY "mt_read_orders" ON mt_orders
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "mt_insert_orders" ON mt_orders
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "mt_update_orders" ON mt_orders
  FOR UPDATE TO authenticated
  USING (mt_my_role() IN ('manager', 'admin', 'packer', 'head'))
  WITH CHECK (mt_my_role() IN ('manager', 'admin', 'packer', 'head'));

CREATE POLICY "mt_delete_orders" ON mt_orders
  FOR DELETE TO authenticated
  USING (mt_my_role() IN ('manager', 'admin', 'packer', 'head'));

-- ตรวจผล: ควรเห็น 4 policy ด้านบน และไม่มี mt_manage_orders
SELECT policyname, cmd, roles::text FROM pg_policies WHERE tablename = 'mt_orders' ORDER BY cmd;
