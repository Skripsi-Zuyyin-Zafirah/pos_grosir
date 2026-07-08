-- Migration: Update checkout_order untuk menyertakan insert ke queue_logs
-- Sebelumnya queue_logs di-insert dari client (kena RLS block).
-- Kini di-insert di dalam RPC yang SECURITY DEFINER sehingga bypass RLS.

CREATE OR REPLACE FUNCTION public.checkout_order(
  p_customer_name text,
  p_ewp           numeric,
  p_items         jsonb,
  p_total_items   integer,
  p_total_price   numeric,
  p_queue_mode    text DEFAULT 'fifo'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_order_id uuid;
  v_item     jsonb;
  v_user_id  uuid;
BEGIN
  -- Get current authenticated user id
  v_user_id := auth.uid();

  -- Insert into orders
  INSERT INTO public.orders (user_id, customer_name, total_price, total_items, ewp, status, payment_status)
  VALUES (v_user_id, p_customer_name, p_total_price, p_total_items, p_ewp, 'waiting', 'unpaid')
  RETURNING id INTO v_order_id;

  -- Insert order items and decrement stock
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    INSERT INTO public.order_items (order_id, product_id, quantity, price)
    VALUES (
      v_order_id,
      (v_item->>'product_id')::uuid,
      (v_item->>'quantity')::integer,
      (v_item->>'price')::numeric
    );

    UPDATE public.inventory
    SET stock_qty = stock_qty - (v_item->>'quantity')::integer
    WHERE product_id = (v_item->>'product_id')::uuid;
  END LOOP;

  -- Record into queue_logs (SECURITY DEFINER bypasses RLS)
  INSERT INTO public.queue_logs (order_id, mode, enqueued_at)
  VALUES (v_order_id, p_queue_mode::queue_mode_enum, now());

  RETURN v_order_id;
END;
$$;
