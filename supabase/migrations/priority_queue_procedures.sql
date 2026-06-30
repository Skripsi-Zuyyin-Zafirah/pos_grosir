-- 1. Function to recalculate priority scores with aging
CREATE OR REPLACE FUNCTION public.update_aging_scores()
RETURNS void AS $$
DECLARE
  v_queue_mode text;
  v_aging_rate numeric;
BEGIN
  -- Fetch current queue configuration
  SELECT COALESCE(value->>0, 'fifo') INTO v_queue_mode
  FROM public.system_settings
  WHERE key = 'queue_mode';

  SELECT COALESCE((value->>0)::numeric, 1.0) INTO v_aging_rate
  FROM public.system_settings
  WHERE key = 'aging_rate';

  IF v_queue_mode = 'priority' THEN
    -- SJF Priority Queue with Aging Formula:
    -- priority_score = ECT - (aging_rate * wait_time_minutes)
    UPDATE public.orders
    SET priority_score = ewp - (v_aging_rate * (EXTRACT(EPOCH FROM (NOW() - created_at)) / 60.0))
    WHERE status = 'waiting';
  ELSE
    -- FIFO Mode:
    -- Set priority score directly proportional to creation time epoch (older = smaller score = processed first)
    UPDATE public.orders
    SET priority_score = EXTRACT(EPOCH FROM created_at)
    WHERE status = 'waiting';
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 2. Function to pop (dequeue) the next order from the queue and assign to staff
CREATE OR REPLACE FUNCTION public.pop_next_order(p_staff_id uuid)
RETURNS uuid AS $$
DECLARE
  v_next_order_id uuid;
BEGIN
  -- First recalculate aging priority scores
  PERFORM public.update_aging_scores();

  -- Get the order with the lowest priority score
  SELECT id INTO v_next_order_id
  FROM public.orders
  WHERE status = 'waiting'
  ORDER BY priority_score ASC, created_at ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  -- If an order is found, dequeue it
  IF v_next_order_id IS NOT NULL THEN
    -- 1. Update order details
    UPDATE public.orders
    SET
      status = 'processing',
      assigned_staff_id = p_staff_id,
      dequeued_at = NOW()
    WHERE id = v_next_order_id;

    -- 2. Update staff status
    UPDATE public.staff
    SET
      status = 'busy',
      current_order_id = v_next_order_id,
      updated_at = NOW()
    WHERE id = p_staff_id;

    -- 3. Log queue dequeue time
    UPDATE public.queue_logs
    SET
      dequeued_at = NOW(),
      wait_time_seconds = EXTRACT(EPOCH FROM (NOW() - enqueued_at))
    WHERE order_id = v_next_order_id AND dequeued_at IS NULL;
  END IF;

  RETURN v_next_order_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
