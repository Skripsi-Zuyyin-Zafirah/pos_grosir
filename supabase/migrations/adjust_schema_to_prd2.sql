-- Migration: Adjust database schema to PRD 2.0

-- 1. Drop triggers on public.orders to allow type modifications
DROP TRIGGER IF EXISTS tr_handle_order_cancellation ON public.orders CASCADE;
DROP TRIGGER IF EXISTS on_order_status_change ON public.orders CASCADE;
DROP TRIGGER IF EXISTS on_new_order ON public.orders CASCADE;

-- 2. Drop functions and RPCs that depend on the old schema
DROP FUNCTION IF EXISTS public.update_aging_scores();
DROP FUNCTION IF EXISTS public.pop_next_order(uuid);
DROP FUNCTION IF EXISTS public.checkout_order(text, numeric, jsonb, integer, numeric, text);
DROP FUNCTION IF EXISTS public.checkout_order(text, numeric, jsonb, integer, numeric);
DROP FUNCTION IF EXISTS public.finalize_order_payment(uuid, uuid, public.payment_method, numeric);
DROP FUNCTION IF EXISTS public.cancel_order_transaction(uuid, uuid);
DROP FUNCTION IF EXISTS public.finalize_order_transaction(uuid, uuid);
DROP FUNCTION IF EXISTS public.handle_new_order_notification();
DROP FUNCTION IF EXISTS public.handle_order_cancellation();
DROP FUNCTION IF EXISTS public.handle_order_status_notification();

-- 3. Drop RLS policies that reference old enum values or structures
DROP POLICY IF EXISTS "Customers can view active orders queue" ON public.orders;

-- 4. Drop tables that are out-of-scope in PRD 2.0
DROP TABLE IF EXISTS public.inventory CASCADE;
DROP TABLE IF EXISTS public.payments CASCADE;
DROP TABLE IF EXISTS public.queue_logs CASCADE;
DROP TABLE IF EXISTS public.system_settings CASCADE;
DROP TABLE IF EXISTS public.stock_movements CASCADE;

-- 5. Modify public.products table
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS stock_qty integer DEFAULT 0;
ALTER TABLE public.products DROP COLUMN IF EXISTS stock CASCADE;
ALTER TABLE public.products DROP COLUMN IF EXISTS unit CASCADE;
ALTER TABLE public.products DROP COLUMN IF EXISTS weight CASCADE;

-- 6. Modify public.product_units table
ALTER TABLE public.product_units RENAME COLUMN name TO unit_name;
ALTER TABLE public.product_units RENAME COLUMN time_weight TO pickup_time_seconds;

-- 7. Modify public.staff table
ALTER TABLE public.staff ALTER COLUMN status TYPE text;
UPDATE public.staff SET status = 'sibuk' WHERE status = 'busy';
DROP TYPE IF EXISTS public.staff_status CASCADE;
CREATE TYPE public.staff_status AS ENUM ('idle', 'sibuk');
ALTER TABLE public.staff ALTER COLUMN status TYPE public.staff_status USING status::public.staff_status;
ALTER TABLE public.staff DROP COLUMN IF EXISTS current_order_id CASCADE;

-- 8. Modify public.orders table
ALTER TABLE public.orders ALTER COLUMN status TYPE text;
UPDATE public.orders SET status = 'antri' WHERE status = 'waiting';
UPDATE public.orders SET status = 'diproses' WHERE status IN ('processing', 'ready');
UPDATE public.orders SET status = 'selesai' WHERE status = 'done';
UPDATE public.orders SET status = 'batal' WHERE status = 'cancelled';

DROP TYPE IF EXISTS public.order_status CASCADE;
CREATE TYPE public.order_status AS ENUM ('antri', 'diproses', 'selesai', 'batal');
ALTER TABLE public.orders ALTER COLUMN status TYPE public.order_status USING status::public.order_status;

-- Recreate payment_method type with 'tunai', 'online'
DROP TYPE IF EXISTS public.payment_method CASCADE;
CREATE TYPE public.payment_method AS ENUM ('tunai', 'online');
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS payment_method public.payment_method DEFAULT 'tunai';

-- Rename assigned_staff_id to staff_id
ALTER TABLE public.orders RENAME COLUMN assigned_staff_id TO staff_id;

-- Drop fields not in PRD 2.0
ALTER TABLE public.orders DROP COLUMN IF EXISTS priority_score CASCADE;
ALTER TABLE public.orders DROP COLUMN IF EXISTS payment_status CASCADE;
ALTER TABLE public.orders DROP COLUMN IF EXISTS payment_type CASCADE;
ALTER TABLE public.orders DROP COLUMN IF EXISTS payment_proof_url CASCADE;
ALTER TABLE public.orders DROP COLUMN IF EXISTS cashier_id CASCADE;

-- 9. Modify public.order_items table
ALTER TABLE public.order_items RENAME COLUMN quantity TO qty;
ALTER TABLE public.order_items RENAME COLUMN price TO unit_price;
ALTER TABLE public.order_items DROP COLUMN IF EXISTS time_weight CASCADE;
ALTER TABLE public.order_items DROP COLUMN IF EXISTS unit_id CASCADE;
ALTER TABLE public.order_items DROP COLUMN IF EXISTS unit_name CASCADE;

-- 10. Modify public.notifications table
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS order_id uuid REFERENCES public.orders(id) ON DELETE CASCADE;
ALTER TABLE public.notifications DROP COLUMN IF EXISTS link CASCADE;
ALTER TABLE public.notifications DROP COLUMN IF EXISTS target_role CASCADE;
ALTER TABLE public.notifications DROP COLUMN IF EXISTS title CASCADE;
ALTER TABLE public.notifications DROP COLUMN IF EXISTS type CASCADE;

-- 11. Recreate active orders queue RLS policy
CREATE POLICY "Customers can view active orders queue" ON public.orders
FOR SELECT TO authenticated
USING (status = ANY (ARRAY['antri'::public.order_status, 'diproses'::public.order_status]));

-- 12. Create new trigger functions with PRD 2.0 structures
CREATE OR REPLACE FUNCTION public.handle_new_order_notification()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.notifications (user_id, order_id, message, is_read)
  VALUES (
    NEW.user_id,
    NEW.id,
    'Pesanan baru masuk dari ' || COALESCE(NEW.customer_name, 'Pelanggan') || ' sebesar Rp ' || TO_CHAR(NEW.total_price, 'FM999,999,999'),
    false
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.handle_order_cancellation()
RETURNS trigger AS $$
DECLARE
  v_item record;
BEGIN
  -- Check if order status changed to 'batal'
  IF NEW.status = 'batal'::public.order_status AND OLD.status <> 'batal'::public.order_status THEN
    -- Loop through order items and restore stock in products
    FOR v_item IN SELECT product_id, qty FROM public.order_items WHERE order_id = NEW.id
    LOOP
      UPDATE public.products
      SET stock_qty = stock_qty + v_item.qty
      WHERE id = v_item.product_id;
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.handle_order_status_notification()
RETURNS trigger AS $$
BEGIN
  -- Kirim notifikasi jika status berubah dan user_id pelanggan tersedia
  IF (OLD.status IS DISTINCT FROM NEW.status) AND NEW.user_id IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, order_id, message, is_read)
    VALUES (
      NEW.user_id,
      NEW.id,
      CASE 
        WHEN NEW.status = 'diproses' THEN 'Pesanan Anda sedang diproses oleh pegawai.'
        WHEN NEW.status = 'selesai' THEN 'Pesanan Anda telah selesai! Silakan lakukan pembayaran dan pengambilan barang.'
        WHEN NEW.status = 'batal' THEN 'Pesanan Anda telah dibatalkan.'
        ELSE 'Status pesanan Anda telah diperbarui.'
      END,
      false
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 13. Bind new triggers to public.orders table
CREATE TRIGGER on_new_order
AFTER INSERT ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.handle_new_order_notification();

CREATE TRIGGER on_order_status_change
AFTER UPDATE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.handle_order_status_notification();

CREATE TRIGGER tr_handle_order_cancellation
AFTER UPDATE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.handle_order_cancellation();

-- 14. Truncate staff and seed with 4 physical staff members
TRUNCATE TABLE public.staff RESTART IDENTITY CASCADE;
INSERT INTO public.staff (name, status) VALUES
('Pegawai 1', 'idle'),
('Pegawai 2', 'idle'),
('Pegawai 3', 'idle'),
('Pegawai 4', 'idle');
