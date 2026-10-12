-- ============================================================
-- v10 migration: กันออเดอร์ซ้ำที่ฐานข้อมูล (ชั้นสุดท้าย)
-- กฎ: เบอร์เดียวกัน + เพจเดียวกัน ภายใน 3 วัน
--   • พนักงาน (employee) และ แอดมิน (admin) → บล็อก
--   • หัวหน้า (manager), จัดส่ง (packer/head) → ลงซ้ำได้ (หน้าเว็บเตือนให้กดยืนยันก่อน)
-- กันได้แม้หน้าเว็บพลาด, เน็ตสะดุด หรือกดพร้อมกัน 2 เครื่อง
-- รันใน Supabase SQL Editor ครั้งเดียว (รันซ้ำได้ ไม่พัง)
-- ============================================================

-- ทำให้ชื่อเพจเทียบกันได้: ตัดอักขระล่องหน/ช่องว่างทั้งหมด + ตัวพิมพ์เล็ก
CREATE OR REPLACE FUNCTION mt_page_key(p text) RETURNS text
LANGUAGE sql IMMUTABLE AS $$
  SELECT lower(regexp_replace(coalesce(p, ''), '[\s ​‌‍﻿]', '', 'g'))
$$;

CREATE OR REPLACE FUNCTION mt_phone_key(p text) RETURNS text
LANGUAGE sql IMMUTABLE AS $$
  SELECT regexp_replace(coalesce(p, ''), '\D', '', 'g')
$$;

CREATE INDEX IF NOT EXISTS mt_orders_phone_key_idx ON mt_orders (mt_phone_key(customer_phone), created_at);

CREATE OR REPLACE FUNCTION mt_block_duplicate_order() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_role text;
  v_dup  record;
BEGIN
  -- เก็บค่าแบบสะอาด: เบอร์เหลือแต่ตัวเลข, ชื่อเพจตัดช่องว่างหัวท้าย/ซ้ำ
  NEW.customer_phone := mt_phone_key(NEW.customer_phone);
  NEW.sales_channel  := btrim(regexp_replace(coalesce(NEW.sales_channel, ''), '[\s ​‌‍﻿]+', ' ', 'g'));

  SELECT role INTO v_role FROM mt_profiles WHERE id = auth.uid();
  IF v_role IS NULL OR v_role NOT IN ('employee', 'admin') THEN
    RETURN NEW;
  END IF;

  -- ล็อกตามเบอร์ กันกรณีกดบันทึกพร้อมกันหลายเครื่อง
  PERFORM pg_advisory_xact_lock(hashtext('mt_order_dup:' || NEW.customer_phone));

  SELECT id, customer_name, created_at INTO v_dup
  FROM mt_orders
  WHERE mt_phone_key(customer_phone) = NEW.customer_phone
    AND mt_page_key(sales_channel) = mt_page_key(NEW.sales_channel)
    AND created_at >= now() - interval '3 days'
  ORDER BY created_at DESC
  LIMIT 1;

  IF FOUND THEN
    RAISE EXCEPTION 'DUPLICATE_ORDER: เบอร์ % ลงในเพจนี้แล้วเมื่อ %', NEW.customer_phone,
      to_char(v_dup.created_at AT TIME ZONE 'Asia/Bangkok', 'DD/MM HH24:MI');
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS mt_block_duplicate_order ON mt_orders;
CREATE TRIGGER mt_block_duplicate_order
  BEFORE INSERT ON mt_orders
  FOR EACH ROW EXECUTE FUNCTION mt_block_duplicate_order();

-- (ไม่บังคับ) ดูออเดอร์ที่ซ้ำย้อนหลัง 30 วัน
-- SELECT mt_phone_key(customer_phone) AS phone, mt_page_key(sales_channel) AS page,
--        count(*), array_agg(order_number ORDER BY created_at), array_agg(employee_name ORDER BY created_at)
-- FROM mt_orders WHERE created_at >= now() - interval '30 days'
-- GROUP BY 1, 2 HAVING count(*) > 1 ORDER BY max(created_at) DESC;
