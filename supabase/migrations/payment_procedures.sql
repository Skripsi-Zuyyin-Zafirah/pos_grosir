CREATE OR REPLACE FUNCTION public.finalize_order_payment(
  p_order_id uuid,
  p_cashier_id uuid,
  p_method public.payment_method,
  p_amount numeric
)
RETURNS void AS $$
BEGIN
  -- 1. Insert payment details
  INSERT INTO public.payments (order_id, cashier_id, method, amount, paid_at)
  VALUES (p_order_id, p_cashier_id, p_method, p_amount, NOW());

  -- 2. Complete order details
  UPDATE public.orders
  SET
    status = 'done',
    payment_status = 'paid',
    completed_at = NOW()
  WHERE id = p_order_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
