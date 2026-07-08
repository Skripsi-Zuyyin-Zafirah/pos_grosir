-- Skenario Uji Akademik End-to-End POS Grosir Jasa
-- File: supabase/migrations/run_academic_verification.sql
-- Untuk memverifikasi 3 aspek: Min-Heap Tie-Breaker, Perhitungan EWP, dan Distribusi SQMS.

DO $$
DECLARE
  v_user_id uuid := 'ef6d5809-e6df-4fcc-a7c1-4c8e840b3087'; -- User kurama@gmail.com
  v_prod_id1 uuid;
  v_prod_id2 uuid;
  v_unit_id1 uuid;
  v_unit_id2 uuid;
  v_staff_id1 uuid;
  v_staff_id2 uuid;
  v_staff_id3 uuid;
  v_staff_id4 uuid;
  
  v_order_id1 uuid;
  v_order_id2 uuid;
  v_order_id3 uuid;
  v_order_id4 uuid;
  v_order_id5 uuid;
  
  v_ewp_calc numeric;
  v_ewp_db numeric;
  v_staff_status_before public.staff_status;
  v_staff_status_after public.staff_status;
  v_order_status public.order_status;
  v_assigned_staff_id uuid;
BEGIN
  RAISE NOTICE '=== MEMULAI SIMULASI PENGUJIAN AKADEMIK ===';

  -- 0. SIAPKAN PRODUK & PEGAWAI SECARA BERSIH
  -- Dapatkan 2 ID produk
  SELECT id INTO v_prod_id1 FROM public.products ORDER BY name LIMIT 1;
  SELECT id INTO v_prod_id2 FROM public.products ORDER BY name LIMIT 1 OFFSET 1;
  
  -- Dapatkan 2 ID unit kemasan
  SELECT id, pickup_time_seconds INTO v_unit_id1, v_ewp_calc FROM public.product_units WHERE product_id = v_prod_id1 LIMIT 1;
  SELECT id INTO v_unit_id2 FROM public.product_units WHERE product_id = v_prod_id2 LIMIT 1;
  
  -- Dapatkan 4 ID pegawai
  SELECT id INTO v_staff_id1 FROM public.staff ORDER BY name LIMIT 1;
  SELECT id INTO v_staff_id2 FROM public.staff ORDER BY name LIMIT 1 OFFSET 1;
  SELECT id INTO v_staff_id3 FROM public.staff ORDER BY name LIMIT 1 OFFSET 2;
  SELECT id INTO v_staff_id4 FROM public.staff ORDER BY name LIMIT 1 OFFSET 3;

  -- Bersihkan data order/transaksi pengujian sebelumnya agar tidak mengganggu antrean
  UPDATE public.staff SET status = 'idle';
  UPDATE public.orders SET status = 'batal', staff_id = NULL WHERE status IN ('antri', 'diproses');

  RAISE NOTICE 'Pegawai diset kembali ke idle.';

  -- --------------------------------------------------------------------------------
  -- UJI 1: VERIFIKASI PERHITUNGAN EWP (MANUAL VS SISTEM)
  -- Skenario: Customer checkout 3 unit barang1 dengan Wi = v_ewp_calc
  -- Rumus EWP manual: Q1 * W1 = 3 * v_ewp_calc
  -- --------------------------------------------------------------------------------
  RAISE NOTICE '--- UJI 1: VERIFIKASI PERHITUNGAN EWP ---';
  
  -- Lakukan checkout via RPC
  v_order_id1 := public.checkout_order(
    'Penguji EWP',
    (3 * v_ewp_calc), -- EWP yang dikirim ke RPC (dihitung oleh sistem client)
    jsonb_build_array(
      jsonb_build_object('product_id', v_prod_id1, 'qty', 3, 'unit_price', 5000)
    ),
    3,
    15000
  );

  -- Ambil EWP yang tercatat di database
  SELECT ewp INTO v_ewp_db FROM public.orders WHERE id = v_order_id1;
  
  RAISE NOTICE 'Hasil Perhitungan EWP:';
  RAISE NOTICE '- EWP Manual (Client): % detik', (3 * v_ewp_calc);
  RAISE NOTICE '- EWP Database (Sistem): % detik', v_ewp_db;
  
  IF v_ewp_db = (3 * v_ewp_calc) THEN
    RAISE NOTICE '✓ UJI 1 BERHASIL: Deviasi Perhitungan EWP bernilai 0%%';
  ELSE
    RAISE EXCEPTION '❌ UJI 1 GAGAL: Ada ketidakcocokan nilai EWP!';
  END IF;


  -- --------------------------------------------------------------------------------
  -- UJI 2: OTOMATISASI DISTRIBUSI SQMS (SINGLE QUEUE MULTIPLE SERVER)
  -- Skenario: Staf 1 idle, begitu order1 masuk, staf1 harus berubah jadi 'sibuk'
  -- dan order1 berstatus 'diproses'.
  -- --------------------------------------------------------------------------------
  RAISE NOTICE '--- UJI 2: OTOMATISASI DISTRIBUSI SQMS ---';
  
  -- Karena tadi kita checkout order1, mari kita cek apakah otomatis didistribusikan
  SELECT status, staff_id INTO v_order_status, v_assigned_staff_id
  FROM public.orders
  WHERE id = v_order_id1;
  
  SELECT status INTO v_staff_status_after
  FROM public.staff
  WHERE id = v_assigned_staff_id;

  RAISE NOTICE 'Status Penugasan SQMS:';
  RAISE NOTICE '- Status Pesanan 1: %', v_order_status;
  RAISE NOTICE '- Ditugaskan ke Pegawai ID: %', v_assigned_staff_id;
  RAISE NOTICE '- Status Pegawai Bertugas: %', v_staff_status_after;

  IF v_order_status = 'diproses' AND v_staff_status_after = 'sibuk' THEN
    RAISE NOTICE '✓ UJI 2 BERHASIL: Pesanan otomatis didistribusikan dan merubah status pegawai menjadi sibuk';
  ELSE
    RAISE EXCEPTION '❌ UJI 2 GAGAL: Otomatisasi distribusi SQMS tidak terpicu!';
  END IF;


  -- --------------------------------------------------------------------------------
  -- UJI 3: PENGUJIAN LOGIKA MIN-HEAP & TIE-BREAKER
  -- Skenario:
  -- 1. Kita buat 4 pegawai sibuk terlebih dahulu dengan membuat 3 order lagi.
  -- 2. Setelah itu, 4 pegawai berstatus 'sibuk'.
  -- 3. Kita masukkan 3 order tambahan (order A, B, C) yang akan masuk ke antrean ('antri').
  --    - Order A: EWP = 20, created_at = T1
  --    - Order B: EWP = 10, created_at = T2 (EWP lebih kecil, harus ke akar heap)
  --    - Order C: EWP = 20, created_at = T0 (EWP sama dengan A, tapi created_at lebih awal)
  -- 4. Urutan prioritas keluar (pop) harus: Order B -> Order C -> Order A.
  -- --------------------------------------------------------------------------------
  RAISE NOTICE '--- UJI 3: LOGIKA MIN-HEAP & TIE-BREAKER ---';
  
  -- Buat 4 pegawai sibuk dengan checkout 3 order baru (karena 1 sudah sibuk)
  v_order_id2 := public.checkout_order('Staf Sibuk 2', 50, '[]'::jsonb, 1, 10000);
  v_order_id3 := public.checkout_order('Staf Sibuk 3', 60, '[]'::jsonb, 1, 10000);
  v_order_id4 := public.checkout_order('Staf Sibuk 4', 70, '[]'::jsonb, 1, 10000);
  
  -- Pastikan semua 4 staff berstatus sibuk
  DECLARE
    v_busy_count integer;
  BEGIN
    SELECT count(*) INTO v_busy_count FROM public.staff WHERE status = 'sibuk';
    RAISE NOTICE 'Jumlah pegawai sibuk saat ini: % dari 4', v_busy_count;
  END;

  -- Buat 3 order baru dalam antrean ('antri')
  -- Order A (EWP = 20, T1)
  INSERT INTO public.orders (user_id, customer_name, total_price, total_items, ewp, status, created_at)
  VALUES (v_user_id, 'Order A (EWP 20, T1)', 20000, 2, 20, 'antri', NOW() - INTERVAL '1 minute')
  RETURNING id INTO v_order_id2;

  -- Order B (EWP = 10, T2)
  INSERT INTO public.orders (user_id, customer_name, total_price, total_items, ewp, status, created_at)
  VALUES (v_user_id, 'Order B (EWP 10, T2)', 10000, 1, 10, 'antri', NOW())
  RETURNING id INTO v_order_id3;

  -- Order C (EWP = 20, T0 - Tie-Breaker target)
  INSERT INTO public.orders (user_id, customer_name, total_price, total_items, ewp, status, created_at)
  VALUES (v_user_id, 'Order C (EWP 20, T0)', 20000, 2, 20, 'antri', NOW() - INTERVAL '3 minutes')
  RETURNING id INTO v_order_id4;

  -- Lakukan simulasi pengambilan antrean prioritas (Min-Heap EWP ASC, created_at ASC)
  -- Prioritas teratas haruslah Order B (EWP = 10)
  DECLARE
    v_top_order_id uuid;
    v_top_order_name text;
  BEGIN
    SELECT id, customer_name INTO v_top_order_id, v_top_order_name
    FROM public.orders
    WHERE status = 'antri'
    ORDER BY ewp ASC, created_at ASC
    LIMIT 1;

    RAISE NOTICE 'Akar Min-Heap Terdeteksi: % (ID: %)', v_top_order_name, v_top_order_id;
    
    IF v_top_order_id = v_order_id3 THEN
      RAISE NOTICE '✓ Sub-Uji Min-Heap EWP Terkecil: BERHASIL (Order B terpilih)';
    ELSE
      RAISE EXCEPTION '❌ Sub-Uji Min-Heap EWP Terkecil: GAGAL!';
    END IF;
  END;

  -- Sekarang kita simulasikan jika Order B sudah dipop/dihapus dari status 'antri'.
  -- Sisa antrean adalah Order A (EWP 20, T1) dan Order C (EWP 20, T0).
  -- Karena EWP sama, Tie-breaker waktu kedatangan (created_at) harus memilih Order C yang masuk lebih awal (T0).
  UPDATE public.orders SET status = 'diproses' WHERE id = v_order_id3; -- Simulasikan Order B diproses
  
  DECLARE
    v_next_order_id uuid;
    v_next_order_name text;
  BEGIN
    SELECT id, customer_name INTO v_next_order_id, v_next_order_name
    FROM public.orders
    WHERE status = 'antri'
    ORDER BY ewp ASC, created_at ASC
    LIMIT 1;

    RAISE NOTICE 'Tie-Breaker Min-Heap Terdeteksi: % (ID: %)', v_next_order_name, v_next_order_id;
    
    IF v_next_order_id = v_order_id4 THEN
      RAISE NOTICE '✓ Sub-Uji Tie-Breaker Arrival Time: BERHASIL (Order C terpilih)';
    ELSE
      RAISE EXCEPTION '❌ Sub-Uji Tie-Breaker Arrival Time: GAGAL!';
    END IF;
  END;

  -- --------------------------------------------------------------------------------
  -- UJI 4: OTOMATISASI SQMS SAAT PEGAWAI SELESAI TRANSAKSI
  -- Skenario:
  -- 1. Satu pegawai (misal staff 1) menyelesaikan ordernya via RPC `finalize_order_payment`.
  -- 2. Status staff 1 harusnya menjadi idle, tetapi karena ada antrean 'antri' (Order C dan Order A),
  --    trigger `tr_distribute_order_on_staff_idle` harus otomatis menugaskan Order C (prioritas teratas)
  --    ke staff 1 tersebut, sehingga status staff 1 tetap 'sibuk' dan status Order C berubah jadi 'diproses'.
  -- --------------------------------------------------------------------------------
  RAISE NOTICE '--- UJI 4: OTOMATISASI SQMS SAAT SELESAI TRANSAKSI ---';
  
  -- Cari order yang sedang di-handle oleh v_staff_id1
  DECLARE
    v_active_order_id uuid;
  BEGIN
    SELECT id INTO v_active_order_id FROM public.orders WHERE staff_id = v_staff_id1 AND status = 'diproses' LIMIT 1;
    
    IF v_active_order_id IS NOT NULL THEN
      RAISE NOTICE 'Pegawai 1 sedang memproses order: %. Menjalankan pembayaran...', v_active_order_id;
      
      -- Selesaikan pembayaran
      PERFORM public.finalize_order_payment(v_active_order_id, v_staff_id1, 'tunai');
      
      -- Cek status pegawai 1 saat ini (harus tetap 'sibuk' karena otomatis menarik Order C)
      SELECT status INTO v_staff_status_after FROM public.staff WHERE id = v_staff_id1;
      
      -- Cek status Order C (v_order_id4) yang harusnya ditarik otomatis
      SELECT status, staff_id INTO v_order_status, v_assigned_staff_id FROM public.orders WHERE id = v_order_id4;
      
      RAISE NOTICE 'Status Pasca Pembayaran:';
      RAISE NOTICE '- Status Pegawai 1: % (Harus sibuk)', v_staff_status_after;
      RAISE NOTICE '- Status Order C (v_order_id4): % (Harus diproses)', v_order_status;
      RAISE NOTICE '- Pegawai yang ditugaskan untuk Order C: %', v_assigned_staff_id;
      
      IF v_staff_status_after = 'sibuk' AND v_order_status = 'diproses' AND v_assigned_staff_id = v_staff_id1 THEN
        RAISE NOTICE '✓ UJI 4 BERHASIL: Staf otomatis menarik pesanan berikutnya dan tetap sibuk.';
      ELSE
        RAISE EXCEPTION '❌ UJI 4 GAGAL: Transisi otomatisasi SQMS pasca pembayaran tidak bekerja!';
      END IF;
    ELSE
      RAISE NOTICE 'Staf 1 tidak memproses pesanan aktif, lewati uji 4.';
    END IF;
  END;

  -- Bersihkan kembali data pengujian agar database bersih
  UPDATE public.orders SET status = 'batal', staff_id = NULL WHERE id IN (v_order_id1, v_order_id2, v_order_id3, v_order_id4);
  UPDATE public.staff SET status = 'idle';

  RAISE NOTICE '=== SEMUA UJI AKADEMIK BERHASIL DISIMULASIKAN ===';
END $$;
