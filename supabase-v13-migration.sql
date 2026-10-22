-- One phone across all staff and pages: block for 7 * 24 hours.
BEGIN;
CREATE OR REPLACE FUNCTION public.mt_phone_7day_key(p text) RETURNS text
LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE WHEN d ~ '^66[0-9]{9}$' THEN '0' || substr(d, 3) ELSE d END
  FROM (SELECT regexp_replace(coalesce(p, ''), '[^0-9]', '', 'g') AS d) s;
$$;
CREATE INDEX IF NOT EXISTS mt_orders_phone_7day_idx
  ON public.mt_orders (public.mt_phone_7day_key(customer_phone), created_at DESC);
CREATE OR REPLACE FUNCTION public.mt_block_duplicate_order() RETURNS trigger
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_phone text := public.mt_phone_7day_key(NEW.customer_phone);
  v_dup record;
BEGIN
  IF v_phone = '' THEN RAISE EXCEPTION 'กรุณาระบุเบอร์โทรลูกค้า'; END IF;
  NEW.customer_phone := v_phone;
  IF TG_OP = 'UPDATE' THEN
    IF NEW.created_at IS DISTINCT FROM OLD.created_at THEN
      RAISE EXCEPTION 'ไม่สามารถเปลี่ยนวันเวลาที่บันทึกออเดอร์';
    END IF;
    IF v_phone = public.mt_phone_7day_key(OLD.customer_phone) THEN RETURN NEW; END IF;
  ELSE
    NEW.created_at := statement_timestamp();
  END IF;
  -- Serialise writers for the same phone; no staff, role, or page exceptions.
  PERFORM pg_advisory_xact_lock(hashtextextended('mt_order_7day:' || v_phone, 0));
  SELECT o.created_at INTO v_dup FROM public.mt_orders o
  WHERE public.mt_phone_7day_key(o.customer_phone) = v_phone
    AND o.id IS DISTINCT FROM NEW.id
    AND o.created_at > statement_timestamp() - interval '7 days'
  ORDER BY o.created_at DESC LIMIT 1;
  IF FOUND THEN
    -- Plain Thai keeps the original date visible even on older web clients.
    RAISE EXCEPTION 'เบอร์ % มีการลงออเดอร์ไปแล้ว วันที่ % เวลา % น. ไม่สามารถลงซ้ำภายใน 7 วัน (ลงได้อีกครั้ง % น.)',
      v_phone,
      to_char(v_dup.created_at AT TIME ZONE 'Asia/Bangkok', 'DD/MM/YYYY'),
      to_char(v_dup.created_at AT TIME ZONE 'Asia/Bangkok', 'HH24:MI'),
      to_char((v_dup.created_at + interval '7 days') AT TIME ZONE 'Asia/Bangkok', 'DD/MM/YYYY HH24:MI');
  END IF;
  RETURN NEW;
END;
$$;
CREATE OR REPLACE TRIGGER mt_block_duplicate_order
  BEFORE INSERT ON public.mt_orders FOR EACH ROW
  EXECUTE FUNCTION public.mt_block_duplicate_order();
CREATE OR REPLACE TRIGGER mt_block_duplicate_order_update
  BEFORE UPDATE OF customer_phone, created_at ON public.mt_orders FOR EACH ROW
  EXECUTE FUNCTION public.mt_block_duplicate_order();
COMMIT;
SELECT 'เปิดกฎห้ามเบอร์ซ้ำ 7 วัน ทุกแอดมิน ทุกเพจ' AS result;
