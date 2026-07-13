-- =====================================================================
-- Migration: Update checkout_order to deduct stock and log stock_mutations
-- Milestone 4: Katalog & Pemesanan Customer
-- =====================================================================

-- Update checkout_order function to also:
-- 1. Deduct stock from products (qty * multiplier for multi-unit items)
-- 2. Log every stock deduction to stock_mutations with type 'sale'
-- The p_items JSONB array now supports optional fields: unit_id, unit_name, multiplier
-- If multiplier is not supplied or is 0/null, it defaults to 1 (single-unit)

CREATE OR REPLACE FUNCTION public.checkout_order(
  p_customer_name text,
  p_ewp numeric,
  p_items jsonb,
  p_total_items integer,
  p_total_price numeric
)
RETURNS uuid AS $$
DECLARE
  v_order_id uuid;
  v_order_number text;
  v_item jsonb;
  v_product_id uuid;
  v_qty integer;
  v_unit_price numeric;
  v_unit_id uuid;
  v_unit_name text;
  v_multiplier integer;
  v_pcs_deducted integer;
  v_current_stock integer;
  v_user_id uuid;
BEGIN
  -- Get current user id (may be null for walk-in / POS orders)
  v_user_id := auth.uid();

  -- Generate order number: ORD-YYYYMMDD-XXXXXX
  v_order_number := 'ORD-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' ||
                    UPPER(SUBSTRING(gen_random_uuid()::text, 1, 6));

  -- 1. Create the order record
  INSERT INTO public.orders (
    order_number,
    customer_name,
    user_id,
    total_items,
    total_price,
    ewp,
    status,
    payment_status,
    enqueued_at,
    created_at
  ) VALUES (
    v_order_number,
    p_customer_name,
    v_user_id,
    p_total_items,
    p_total_price,
    p_ewp,
    'antri',
    'unpaid',
    NOW(),
    NOW()
  )
  RETURNING id INTO v_order_id;

  -- 2. Insert order items + deduct stock
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_product_id  := (v_item->>'product_id')::uuid;
    v_qty         := COALESCE((v_item->>'qty')::integer, 1);
    v_unit_price  := COALESCE((v_item->>'unit_price')::numeric, 0);
    v_unit_name   := v_item->>'unit_name';
    v_multiplier  := COALESCE((v_item->>'multiplier')::integer, 1);
    IF v_multiplier IS NULL OR v_multiplier < 1 THEN
      v_multiplier := 1;
    END IF;

    -- Handle unit_id (may be null for single-unit)
    IF v_item->>'unit_id' IS NOT NULL AND v_item->>'unit_id' <> 'null' THEN
      v_unit_id := (v_item->>'unit_id')::uuid;
    ELSE
      v_unit_id := NULL;
    END IF;

    -- 2a. Insert order item row
    INSERT INTO public.order_items (
      order_id,
      product_id,
      quantity,
      price,
      unit_id,
      unit_name,
      time_weight
    ) VALUES (
      v_order_id,
      v_product_id,
      v_qty,
      v_unit_price,
      v_unit_id,
      v_unit_name,
      0
    );

    -- 2b. Deduct stock in pcs: qty * multiplier
    v_pcs_deducted := v_qty * v_multiplier;

    -- Fetch current stock to validate (NOWAIT-style check)
    SELECT stock INTO v_current_stock
    FROM public.products
    WHERE id = v_product_id
    FOR UPDATE;

    IF v_current_stock IS NULL THEN
      RAISE EXCEPTION 'Produk tidak ditemukan: %', v_product_id;
    END IF;

    IF v_current_stock < v_pcs_deducted THEN
      RAISE EXCEPTION 'Stok tidak mencukupi untuk produk %: tersisa % pcs, dibutuhkan % pcs',
        v_product_id, v_current_stock, v_pcs_deducted;
    END IF;

    -- Update product stock
    UPDATE public.products
    SET stock = stock - v_pcs_deducted
    WHERE id = v_product_id;

    -- 2c. Log mutation to stock_mutations (type: 'sale')
    INSERT INTO public.stock_mutations (product_id, change_qty, type, notes, user_id, created_at)
    VALUES (
      v_product_id,
      -v_pcs_deducted,
      'sale',
      'Penjualan melalui pesanan ' || v_order_number ||
        CASE WHEN v_unit_name IS NOT NULL THEN ' (' || v_qty::text || ' ' || v_unit_name || ')' ELSE '' END,
      v_user_id,
      NOW()
    );
  END LOOP;

  -- 3. Create queue log entry
  INSERT INTO public.queue_logs (order_id, mode, enqueued_at)
  VALUES (v_order_id, 'fifo', NOW());

  RETURN v_order_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execution to authenticated users
GRANT EXECUTE ON FUNCTION public.checkout_order(text, numeric, jsonb, integer, numeric) TO authenticated;

-- Also update stock_mutations to support 'sale' type if not already included
-- (the type column is VARCHAR so no enum changes needed)

COMMENT ON FUNCTION public.checkout_order IS
  'Creates an order, inserts order items, automatically deducts product stock (qty * multiplier for multi-unit), and logs each deduction to stock_mutations with type sale.';
