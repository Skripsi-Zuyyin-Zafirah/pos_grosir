-- Auto-assignment antrian ke pegawai (Pegawai 1-4).
-- Pegawai tidak menyentuh sistem: fungsi ini dipanggil dari Dashboard Kasir.
-- 1. Bebaskan pegawai yang tidak lagi memegang pesanan 'diproses'
--    (pesanannya sudah dibayar/selesai atau batal).
-- 2. Assign pesanan 'antri' (EWP terkecil dulu) ke pegawai idle, maksimal 4 pegawai pertama.

CREATE OR REPLACE FUNCTION public.auto_assign_orders()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_staff RECORD;
  v_order_id uuid;
  v_assigned integer := 0;
BEGIN
  -- Sinkronkan status pegawai dengan kenyataan pesanan
  UPDATE public.staff s
  SET status = 'idle', updated_at = NOW()
  WHERE s.status = 'sibuk'
    AND NOT EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.staff_id = s.id AND o.status = 'diproses'
    );

  -- Bagikan antrian ke pegawai idle (4 pegawai pertama berdasarkan nama)
  FOR v_staff IN
    SELECT id FROM (
      SELECT id, name FROM public.staff ORDER BY name LIMIT 4
    ) pool
    WHERE EXISTS (SELECT 1 FROM public.staff st WHERE st.id = pool.id AND st.status = 'idle')
    ORDER BY name
  LOOP
    SELECT public.pop_next_order(v_staff.id) INTO v_order_id;
    EXIT WHEN v_order_id IS NULL;
    v_assigned := v_assigned + 1;
  END LOOP;

  RETURN v_assigned;
END;
$$;
