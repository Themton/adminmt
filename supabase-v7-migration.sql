-- เพิ่มคอลัมน์ email + password_text ใน mt_profiles
ALTER TABLE mt_profiles ADD COLUMN IF NOT EXISTS email TEXT DEFAULT '';
ALTER TABLE mt_profiles ADD COLUMN IF NOT EXISTS password_text TEXT DEFAULT '';
