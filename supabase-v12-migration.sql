-- ============================================================
-- v12 migration: ปิดช่องโหว่ตาราง mt_profiles
--  1) คนที่ไม่ใช่ manager/admin แก้ role / ทีม / อีเมล / รหัสผ่าน ไม่ได้
--     (เดิม พนักงานเปลี่ยนตัวเองเป็นหัวหน้าได้)
--  2) ย้ายรหัสผ่านไปตาราง mt_profile_secrets ที่อ่านได้เฉพาะ manager/admin
--     (เดิม ทุกคนที่ล็อกอินดึงรหัสผ่านทุกคนได้)
--     หน้าเว็บเดิมที่ยังเขียน password_text ลง mt_profiles ยังใช้ได้ — trigger ย้ายให้เอง
-- ต้องรัน v11 ก่อน (ใช้ฟังก์ชัน mt_my_role) | รันซ้ำได้ ไม่พัง
-- ============================================================

CREATE TABLE IF NOT EXISTS mt_profile_secrets (
  id            uuid PRIMARY KEY,
  password_text text NOT NULL DEFAULT '',
  updated_at    timestamptz DEFAULT now()
);
ALTER TABLE mt_profile_secrets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "mt_secrets_manager_only" ON mt_profile_secrets;
CREATE POLICY "mt_secrets_manager_only" ON mt_profile_secrets
  FOR ALL TO authenticated
  USING (mt_my_role() IN ('manager', 'admin'))
  WITH CHECK (mt_my_role() IN ('manager', 'admin'));

-- ย้ายรหัสผ่านเดิมไปตารางใหม่ แล้วล้างออกจาก mt_profiles
INSERT INTO mt_profile_secrets (id, password_text)
  SELECT id, password_text FROM mt_profiles WHERE coalesce(password_text, '') <> ''
ON CONFLICT (id) DO UPDATE SET password_text = EXCLUDED.password_text, updated_at = now();

CREATE OR REPLACE FUNCTION mt_guard_profile() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_role text := mt_my_role();
  v_boss boolean := auth.uid() IS NULL OR v_role IN ('manager', 'admin');
BEGIN
  IF TG_OP = 'UPDATE' AND NOT v_boss THEN
    IF NEW.role IS DISTINCT FROM OLD.role
       OR NEW.team_id IS DISTINCT FROM OLD.team_id
       OR NEW.email IS DISTINCT FROM OLD.email
       OR coalesce(NEW.password_text, '') <> '' THEN
      RAISE EXCEPTION 'ไม่มีสิทธิ์แก้ไข role / ทีม / อีเมล / รหัสผ่าน';
    END IF;
  END IF;

  -- รหัสผ่านที่ส่งมา → เก็บในตารางลับ (ค่าว่าง = ไม่เปลี่ยน กันหน้าเว็บเก่าเขียนทับเป็นว่าง)
  IF coalesce(NEW.password_text, '') <> '' AND v_boss THEN
    INSERT INTO mt_profile_secrets (id, password_text) VALUES (NEW.id, NEW.password_text)
    ON CONFLICT (id) DO UPDATE SET password_text = EXCLUDED.password_text, updated_at = now();
  END IF;
  NEW.password_text := '';
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS mt_guard_profile ON mt_profiles;
CREATE TRIGGER mt_guard_profile
  BEFORE INSERT OR UPDATE ON mt_profiles
  FOR EACH ROW EXECUTE FUNCTION mt_guard_profile();

-- ล้างรหัสผ่านออกจาก mt_profiles (trigger ด้านบนจะทำให้เป็นค่าว่าง)
UPDATE mt_profiles SET password_text = '' WHERE coalesce(password_text, '') <> '';

-- ลบผู้ใช้ → ลบรหัสผ่านด้วย
CREATE OR REPLACE FUNCTION mt_cleanup_secret() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  DELETE FROM mt_profile_secrets WHERE id = OLD.id;
  RETURN OLD;
END $$;
DROP TRIGGER IF EXISTS mt_cleanup_secret ON mt_profiles;
CREATE TRIGGER mt_cleanup_secret AFTER DELETE ON mt_profiles
  FOR EACH ROW EXECUTE FUNCTION mt_cleanup_secret();

-- ตรวจผล: secrets ควรเท่ากับจำนวนบัญชีที่มีรหัส, ใน profiles ต้องเหลือ 0
SELECT (SELECT count(*) FROM mt_profile_secrets) AS secrets_saved,
       (SELECT count(*) FROM mt_profiles WHERE coalesce(password_text, '') <> '') AS still_in_profiles;
