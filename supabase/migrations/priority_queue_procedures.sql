-- 1. Function to pop (dequeue) the next order from the queue and assign to staff
-- Model: Single Queue Multiple Server (SQMS)
CREATE OR REPLACE FUNCTION public.pop_next_order(p_staff_id uuid)
RETURNS uuid AS $$
DECLARE
  v_next_order_id uuid;
  v_staff_status public.staff_status;
BEGIN
  -- Ensure staff exists and is idle
  SELECT status INTO v_staff_status
  FROM public.staff
  WHERE id = p_staff_id;

  IF v_staff_status <> 'idle' THEN
    RETURN NULL;
  END IF;

  -- Get the order with the lowest EWP (tie-breaker: created_at)
  SELECT id INTO v_next_order_id
  FROM public.orders
  WHERE status = 'antri'
  ORDER BY ewp ASC, created_at ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  -- If an order is found, assign and dequeue it
  IF v_next_order_id IS NOT NULL THEN
    -- 1. Update order details
    UPDATE public.orders
    SET
      status = 'diproses',
      staff_id = p_staff_id,
      dequeued_at = NOW()
    WHERE id = v_next_order_id;

    -- 2. Update staff status to busy (sibuk)
    UPDATE public.staff
    SET
      status = 'sibuk',
      updated_at = NOW()
    WHERE id = p_staff_id;
  END IF;

  RETURN v_next_order_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 2. Function to checkout an order (creates order and order items, and decrements stock)
CREATE OR REPLACE FUNCTION public.checkout_order(
  p_customer_name text,
  p_ewp           numeric,
  p_items         jsonb,
  p_total_items   integer,
  p_total_price   numeric
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_order_id uuid;
  v_item     jsonb;
  v_user_id  uuid;
  v_idle_staff_id uuid;
BEGIN
  -- Get current authenticated user id
  v_user_id := auth.uid();

  -- Insert into orders (status 'antri' by default)
  INSERT INTO public.orders (user_id, customer_name, total_price, total_items, ewp, status, payment_method)
  VALUES (v_user_id, p_customer_name, p_total_price, p_total_items, p_ewp, 'antri', 'tunai')
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

    -- Decrement stock directly in products
    UPDATE public.products
    SET stock_qty = COALESCE(stock_qty, 0) - (v_item->>'qty')::integer
    WHERE id = (v_item->>'product_id')::uuid;
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
$$;


-- 3. Function to cancel an order transaction
CREATE OR REPLACE FUNCTION public.cancel_order_transaction(p_order_id uuid, p_staff_id uuid DEFAULT NULL)
RETURNS void AS $$
BEGIN
  -- Update order status to 'batal' (trigger tr_handle_order_cancellation restores stock)
  UPDATE public.orders
  SET status = 'batal'
  WHERE id = p_order_id;

  -- Update staff status if provided
  IF p_staff_id IS NOT NULL THEN
    UPDATE public.staff
    SET status = 'idle', updated_at = NOW()
    WHERE id = p_staff_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 4. Function to finalize an order payment (Cashier checkout)
CREATE OR REPLACE FUNCTION public.finalize_order_payment(
  p_order_id uuid,
  p_staff_id uuid,
  p_payment_method public.payment_method
)
RETURNS void AS $$
BEGIN
  -- 1. Complete order
  UPDATE public.orders
  SET
    status = 'selesai',
    payment_method = p_payment_method,
    completed_at = NOW()
  WHERE id = p_order_id;

  -- 2. Release staff back to idle
  IF p_staff_id IS NOT NULL THEN
    UPDATE public.staff
    SET
      status = 'idle',
      updated_at = NOW()
    WHERE id = p_staff_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 5. Trigger Function to automatically distribute queue orders when staff status changes to idle
CREATE OR REPLACE FUNCTION public.trigger_distribute_order_on_staff_idle()
RETURNS trigger AS $$
DECLARE
  v_next_order_id uuid;
BEGIN
  -- Triggered BEFORE UPDATE of status on public.staff
  -- Only execute if status shifts from busy ('sibuk') to idle ('idle')
  IF NEW.status = 'idle'::public.staff_status AND OLD.status = 'sibuk'::public.staff_status THEN
    -- Find the next waiting order in queue
    SELECT id INTO v_next_order_id
    FROM public.orders
    WHERE status = 'antri'
    ORDER BY ewp ASC, created_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED;

    -- If found, assign it to this staff member and make them busy again
    IF v_next_order_id IS NOT NULL THEN
      UPDATE public.orders
      SET
        status = 'diproses',
        staff_id = NEW.id,
        dequeued_at = NOW()
      WHERE id = v_next_order_id;

      NEW.status := 'sibuk';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Bind the BEFORE UPDATE trigger to public.staff
DROP TRIGGER IF EXISTS tr_distribute_order_on_staff_idle ON public.staff;
CREATE TRIGGER tr_distribute_order_on_staff_idle
BEFORE UPDATE OF status ON public.staff
FOR EACH ROW
EXECUTE FUNCTION public.trigger_distribute_order_on_staff_idle();
