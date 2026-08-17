-- Add payment_status column to public.orders if not exists
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS payment_status public.payment_status DEFAULT 'unpaid';

-- Add payment_proof_url column to public.orders if not exists
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS payment_proof_url text;

-- Add payment_channel column to public.orders if not exists
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS payment_channel text;

-- Recreate the checkout_order function to accept p_payment_method, p_payment_proof_url, and p_payment_channel parameters
CREATE OR REPLACE FUNCTION public.checkout_order(
  p_customer_name text,
  p_ewp numeric,
  p_items jsonb,
  p_total_items integer,
  p_total_price numeric,
  p_payment_method public.payment_method DEFAULT 'tunai',
  p_payment_proof_url text DEFAULT NULL,
  p_payment_channel text DEFAULT NULL
)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_order_id uuid;
  v_item     jsonb;
  v_user_id  uuid;
  v_idle_staff_id uuid;
  v_multiplier integer;
  v_qty_pcs integer;
BEGIN
  -- Get current authenticated user id
  v_user_id := auth.uid();

  -- Insert into orders (status 'antri' by default)
  INSERT INTO public.orders (user_id, customer_name, total_price, total_items, ewp, status, payment_method, payment_status, payment_proof_url, payment_channel)
  VALUES (
    v_user_id,
    p_customer_name,
    p_total_price,
    p_total_items,
    p_ewp,
    'antri',
    p_payment_method,
    CASE WHEN p_payment_method = 'online' THEN 'paid'::public.payment_status ELSE 'unpaid'::public.payment_status END,
    p_payment_proof_url,
    p_payment_channel
  )
  RETURNING id INTO v_order_id;

  -- Insert order items and decrement stock
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    -- Insert order item using qty and unit_price
    INSERT INTO public.order_items (order_id, product_id, qty, unit_price)
    VALUES (
      v_order_id,
      (v_item->>'product_id')::uuid,
      (v_item->>'qty')::integer,
      (v_item->>'unit_price')::numeric
    );

    -- Get multiplier
    v_multiplier := COALESCE((v_item->>'multiplier')::integer, 1);
    IF v_multiplier IS NULL OR v_multiplier < 1 THEN
      v_multiplier := 1;
    END IF;
    v_qty_pcs := (v_item->>'qty')::integer * v_multiplier;

    -- Decrement stock and stock_qty in products
    UPDATE public.products
    SET 
      stock = COALESCE(stock, 0) - v_qty_pcs,
      stock_qty = COALESCE(stock_qty, 0) - v_qty_pcs
    WHERE id = (v_item->>'product_id')::uuid;

    -- Log mutation to stock_mutations (type: 'sale')
    INSERT INTO public.stock_mutations (product_id, change_qty, type, notes, user_id, created_at)
    SELECT 
      (v_item->>'product_id')::uuid,
      -v_qty_pcs,
      'sale',
      'Penjualan melalui pesanan ' || COALESCE(order_number, v_order_id::text),
      v_user_id,
      NOW()
    FROM public.orders
    WHERE id = v_order_id;

  END LOOP;

  -- SQMS Automatic Distribution:
  -- Find one idle staff member and assign the priority order to them if available
  SELECT id INTO v_idle_staff_id
  FROM public.staff
  WHERE status = 'idle'
  LIMIT 1;

  IF v_idle_staff_id IS NOT NULL THEN
    PERFORM public.pop_next_order(v_idle_staff_id);
  END IF;

  RETURN v_order_id;
END;
$function$;

-- Allow authenticated users to upload payment proofs to the products bucket under payment_proofs/
CREATE POLICY "Customer Insert Payment Proofs"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'products' AND
  (position('payment_proofs/' in name) = 1)
);
