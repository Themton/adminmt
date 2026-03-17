-- ╔══════════════════════════════════════════════════════════════╗
-- ║  ADMIN THE MT — Safe Schema (ไม่กระทบโปรแกรมอื่น)            ║
-- ║  ใช้ prefix mt_ กับทุกตาราง                                  ║
-- ╚══════════════════════════════════════════════════════════════╝

-- ═══ STEP 1: สร้างตารางทั้งหมดก่อน ═══

CREATE TABLE IF NOT EXISTS mt_teams (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS mt_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'employee' CHECK (role IN ('manager', 'employee')),
  team_id UUID REFERENCES mt_teams(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS mt_orders (
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
  team_id UUID REFERENCES mt_teams(id) ON DELETE SET NULL,
  employee_name TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ═══ STEP 2: เปิด RLS ═══

ALTER TABLE mt_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE mt_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE mt_orders ENABLE ROW LEVEL SECURITY;

-- ═══ STEP 3: Policy ทั้งหมด (ตารางมีครบแล้ว ไม่ error) ═══

-- mt_teams
DO $$ BEGIN CREATE POLICY "mt_read_teams" ON mt_teams FOR SELECT USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "mt_insert_team" ON mt_teams FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM mt_profiles WHERE id = auth.uid() AND role = 'manager')); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "mt_update_team" ON mt_teams FOR UPDATE USING (EXISTS (SELECT 1 FROM mt_profiles WHERE id = auth.uid() AND role = 'manager')); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "mt_delete_team" ON mt_teams FOR DELETE USING (EXISTS (SELECT 1 FROM mt_profiles WHERE id = auth.uid() AND role = 'manager')); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- mt_profiles
DO $$ BEGIN CREATE POLICY "mt_read_profiles" ON mt_profiles FOR SELECT USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "mt_insert_profiles" ON mt_profiles FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM mt_profiles WHERE id = auth.uid() AND role = 'manager')); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "mt_update_profiles" ON mt_profiles FOR UPDATE USING (auth.uid() = id OR EXISTS (SELECT 1 FROM mt_profiles WHERE id = auth.uid() AND role = 'manager')); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- mt_orders
DO $$ BEGIN CREATE POLICY "mt_read_orders" ON mt_orders FOR SELECT USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "mt_insert_orders" ON mt_orders FOR INSERT WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "mt_update_orders" ON mt_orders FOR UPDATE USING (EXISTS (SELECT 1 FROM mt_profiles WHERE id = auth.uid() AND role = 'manager')); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "mt_delete_orders" ON mt_orders FOR DELETE USING (EXISTS (SELECT 1 FROM mt_profiles WHERE id = auth.uid() AND role = 'manager')); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ═══ STEP 4: Auto running number ═══

CREATE OR REPLACE FUNCTION mt_set_order_number()
RETURNS TRIGGER AS $$
DECLARE seq INTEGER; dt TEXT;
BEGIN
  SELECT COALESCE(MAX(daily_seq), 0) + 1 INTO seq FROM mt_orders WHERE order_date = NEW.order_date;
  NEW.daily_seq := seq;
  dt := TO_CHAR(NEW.order_date, 'YYYYMMDD');
  NEW.order_number := dt || '-' || LPAD(seq::TEXT, 3, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS mt_auto_order_number ON mt_orders;
CREATE TRIGGER mt_auto_order_number BEFORE INSERT ON mt_orders FOR EACH ROW EXECUTE FUNCTION mt_set_order_number();

-- ═══ STEP 5: Realtime ═══
ALTER PUBLICATION supabase_realtime ADD TABLE mt_orders;

-- ═══ STEP 6: Storage ═══
INSERT INTO storage.buckets (id, name, public) VALUES ('slips', 'slips', true) ON CONFLICT (id) DO NOTHING;
DO $$ BEGIN CREATE POLICY "mt_upload_slip" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'slips'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "mt_view_slip" ON storage.objects FOR SELECT USING (bucket_id = 'slips'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
