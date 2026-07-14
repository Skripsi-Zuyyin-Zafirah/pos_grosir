-- Alur Dashboard Kasir:
-- antri --[assign_order_to_staff]--> diproses (pegawai mengemas)
--       --[complete_packing]-------> diproses + packed_at terisi (siap diambil, pegawai bebas)
--       --[finalize_order_payment]-> selesai

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS packed_at timestamptz;

-- Tugaskan satu pesanan antri ke pegawai idle tertentu
CREATE OR REPLACE FUNCTION public.assign_order_to_staff(p_order_id uuid, p_staff_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_staff_status public.staff_status;
  v_order_status public.order_status;
BEGIN
  SELECT status INTO v_staff_status FROM public.staff WHERE id = p_staff_id FOR UPDATE;
  IF v_staff_status IS NULL THEN
    RAISE EXCEPTION 'Pegawai tidak ditemukan';
  END IF;
  IF v_staff_status <> 'idle' THEN
    RAISE EXCEPTION 'Pegawai sedang sibuk';
  END IF;

  SELECT status INTO v_order_status FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF v_order_status IS NULL THEN
    RAISE EXCEPTION 'Pesanan tidak ditemukan';
  END IF;
  IF v_order_status <> 'antri' THEN
    RAISE EXCEPTION 'Pesanan sudah tidak dalam antrian';
  END IF;

  UPDATE public.orders
  SET status = 'diproses', staff_id = p_staff_id, dequeued_at = NOW()
  WHERE id = p_order_id;

  UPDATE public.staff
  SET status = 'sibuk', updated_at = NOW()
  WHERE id = p_staff_id;
END;
$$;

-- Tandai selesai packing: barang ke pickup area, pegawai kembali idle
CREATE OR REPLACE FUNCTION public.complete_packing(p_order_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_staff_id uuid;
  v_order_status public.order_status;
BEGIN
  SELECT status, staff_id INTO v_order_status, v_staff_id
  FROM public.orders WHERE id = p_order_id FOR UPDATE;

  IF v_order_status IS NULL THEN
    RAISE EXCEPTION 'Pesanan tidak ditemukan';
  END IF;
  IF v_order_status <> 'diproses' THEN
    RAISE EXCEPTION 'Pesanan tidak sedang diproses';
  END IF;

  UPDATE public.orders SET packed_at = NOW() WHERE id = p_order_id;

  IF v_staff_id IS NOT NULL THEN
    UPDATE public.staff
    SET status = 'idle', updated_at = NOW()
    WHERE id = v_staff_id
      -- jangan bebaskan pegawai jika masih memegang pesanan lain yang belum dikemas
      AND NOT EXISTS (
        SELECT 1 FROM public.orders o
        WHERE o.staff_id = v_staff_id AND o.status = 'diproses' AND o.packed_at IS NULL AND o.id <> p_order_id
      );
  END IF;
END;
$$;
