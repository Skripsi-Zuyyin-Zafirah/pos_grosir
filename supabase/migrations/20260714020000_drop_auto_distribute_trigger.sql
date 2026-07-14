-- Alur baru: kasir assign manual dari Dashboard Kasir.
-- Trigger auto-distribute lama membuat pesanan ter-assign sendiri tanpa struk dicetak.
DROP TRIGGER IF EXISTS tr_distribute_order_on_staff_idle ON public.staff;
DROP FUNCTION IF EXISTS public.trigger_distribute_order_on_staff_idle();
