-- ╔══════════════════════════════════════════════════════════════╗
-- ║  ADMIN THE MT — Full Database Schema                        ║
-- ║  รัน SQL นี้ใน Supabase SQL Editor ของโปรเจคใหม่              ║
-- ║  รันครั้งเดียว ครบทุกตาราง                                     ║
-- ╚══════════════════════════════════════════════════════════════╝

-- ═══ 1. ตาราง teams ═══
CREATE TABLE IF NOT EXISTS teams (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone_read_teams" ON teams FOR SELECT USING (true);
CREATE POLICY "manager_insert_team" ON teams FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'manager')
);
CREATE POLICY "manager_update_team" ON teams FOR UPDATE USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'manager')
);
CREATE POLICY "manager_delete_team" ON teams FOR DELETE USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'manager')
);

-- ═══ 2. ตาราง profiles ═══
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'employee' CHECK (role IN ('manager', 'employee')),
  team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone_read_profiles" ON profiles FOR SELECT USING (true);
CREATE POLICY "manager_insert_profiles" ON profiles FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'manager')
);
CREATE POLICY "update_profiles" ON profiles FOR UPDATE USING (
  auth.uid() = id OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'manager')
);

-- ═══ 3. ตาราง orders ═══
CREATE TABLE IF NOT EXISTS orders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_number TEXT,
  order_date DATE NOT NULL DEFAULT CURRENT_DATE,
  daily_seq INTEGER DEFAULT 1,
  customer_phone TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  customer_address TEXT DEFAULT '',
  sub_district TEXT DEFAULT '',
  district TEXT DEFAULT '',
  zip_code TEXT DEFAULT '',
  province TEXT DEFAULT '',
  customer_social TEXT DEFAULT '',
  sales_channel TEXT DEFAULT '',
  sale_price NUMERIC DEFAULT 0,
  cod_amount NUMERIC DEFAULT 0,
  payment_type TEXT DEFAULT 'cod',
  slip_url TEXT DEFAULT '',
  remark TEXT DEFAULT '',
  employee_id UUID REFERENCES auth.users(id),
  team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
  employee_name TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- ทุกคนดูออเดอร์ได้
CREATE POLICY "read_orders" ON orders FOR SELECT USING (true);
-- ทุกคนสร้างออเดอร์ได้
CREATE POLICY "insert_orders" ON orders FOR INSERT WITH CHECK (true);
-- หัวหน้าแก้ไขออเดอร์ได้
CREATE POLICY "manager_update_orders" ON orders FOR UPDATE USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'manager')
);
-- หัวหน้าลบออเดอร์ได้
CREATE POLICY "manager_delete_orders" ON orders FOR DELETE USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'manager')
);

-- ═══ 4. Auto running number (ลำดับที่ รันใหม่ทุกวัน) ═══
CREATE OR REPLACE FUNCTION set_order_number()
RETURNS TRIGGER AS $$
DECLARE
  seq INTEGER;
  dt TEXT;
BEGIN
  SELECT COALESCE(MAX(daily_seq), 0) + 1 INTO seq
  FROM orders WHERE order_date = NEW.order_date;
  
  NEW.daily_seq := seq;
  dt := TO_CHAR(NEW.order_date, 'YYYYMMDD');
  NEW.order_number := dt || '-' || LPAD(seq::TEXT, 3, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER auto_order_number
  BEFORE INSERT ON orders
  FOR EACH ROW
  EXECUTE FUNCTION set_order_number();

-- ═══ 5. Realtime ═══
ALTER PUBLICATION supabase_realtime ADD TABLE orders;

-- ═══ 6. Storage bucket สำหรับสลิป ═══
INSERT INTO storage.buckets (id, name, public) VALUES ('slips', 'slips', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "anyone_upload_slip" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'slips');
CREATE POLICY "anyone_view_slip" ON storage.objects
  FOR SELECT USING (bucket_id = 'slips');

-- ═══ 7. สร้าง user หัวหน้าคนแรก ═══
-- ** หลังรัน SQL นี้แล้ว ไปสร้าง user ที่ Authentication → Users → Add user **
-- ** แล้วรัน SQL ข้างล่างแทน email จริง **
-- INSERT INTO profiles (id, full_name, role)
-- SELECT id, 'หัวหน้า', 'manager'
-- FROM auth.users WHERE email = 'your@email.com';
