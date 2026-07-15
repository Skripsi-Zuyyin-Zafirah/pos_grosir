# Planning Implementasi — POS Grosir dengan Priority Queue

Dokumen ini menerjemahkan [PRD.md](./PRD.md) menjadi rencana implementasi bertahap (milestone) yang dapat dieksekusi. Setiap milestone memiliki tujuan, deliverable, daftar tugas teknis, dan kriteria selesai (*definition of done*) yang dapat diverifikasi.

**Status proyek saat ini:** Next.js (App Router) + shadcn/ui sudah di-scaffold dengan template dashboard (sidebar, chart, data-table dummy). Belum ada koneksi Supabase, skema DB, autentikasi, maupun modul domain (produk, order, queue).

---

## Ringkasan Milestone

| Milestone | Nama | Selaras dengan PRD |
|---|---|---|
| M0 | Setup Proyek & Fondasi Supabase | Fase 0, §10 |
| M1 | Autentikasi & Manajemen Peran | Fase 0, §7.1, §12 |
| M2 | Katalog Produk & Inventori | Fase 1, §7.2 |
| M3 | Self-Order Pelanggan & Perhitungan ECT | Fase 2, §7.3, §8.2 |
| M4 | Mesin Priority Queue (Min-Heap) & Anti-Starvation | Fase 3, §7.4, §8.3, §8.4 |
| M5 | Papan Antrian Real-time | Fase 3, §7.4, §10 |
| M6 | Pemrosesan Gudang (Picking/Packing) | Fase 4, §7.5 |
| M7 | Kasir & Pembayaran | Fase 4, §7.6 |
| M8 | Dashboard & Laporan | Fase 5, §7.7 |
| M9 | Modul Evaluasi FIFO vs Priority Queue | Fase 5, §7.4 (FR-PQ-07), §14 |
| M10 | Pengujian, Simulasi Beban & Polish | Fase 6, §14, §11 |

---

## M0 — Setup Proyek & Fondasi Supabase

**Tujuan:** Menyiapkan infrastruktur dasar agar seluruh modul berikutnya punya fondasi DB, tipe, dan konvensi yang konsisten.

**Tugas:**
- Buat project Supabase, simpan kredensial di `.env.local` (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`).
- Install & konfigurasi `@supabase/supabase-js` + `@supabase/ssr` untuk Next.js App Router (client browser, client server, middleware).
- Buat migrasi awal skema DB sesuai §9: `profiles`, `products`, `inventory`, `orders`, `order_items`, `payments`, `stock_movements`, `queue_logs`, `system_settings` — termasuk enum (`role`, `status` order, `method` payment, `mode` queue_logs).
- Generate TypeScript types dari skema Supabase (`supabase gen types typescript`).
- Tambahkan index pada `orders.priority_score` dan `orders.status` (mendukung NFR-04, FR-PQ risiko di §15).
- Struktur folder domain: `lib/supabase/`, `lib/queue/`, `lib/ect/`, `app/(auth)/`, `app/(customer)/`, `app/(cashier)/`, `app/(admin)/`.

**Definition of Done:** Migrasi berhasil dijalankan di Supabase, tipe TS ter-generate, koneksi client/server terverifikasi via query sederhana.

---

## M1 — Autentikasi & Manajemen Peran

**Selaras:** FR-AUTH-01..04, §12

**Tugas:**
- Halaman login/register via Supabase Auth (email/password).
- Trigger DB untuk membuat baris `profiles` otomatis saat user baru dibuat (`role` default `pelanggan`).
- Middleware Next.js untuk proteksi route berdasarkan peran (`pelanggan`, `kasir`, `admin`).
- Aktifkan RLS di semua tabel; tulis policy awal sesuai §12 (pelanggan akses data sendiri, kasir akses antrian & pembayaran, admin akses penuh).
- Halaman admin: kelola akun kasir (buat/nonaktifkan) — FR-AUTH-04.
- Redirect berbasis peran setelah login (pelanggan → katalog, kasir → papan antrian, admin → dashboard).

**Definition of Done:** Tiga peran bisa login dan diarahkan ke area masing-masing; RLS terverifikasi menolak akses lintas-peran (uji manual query dengan token berbeda).

---

## M2 — Katalog Produk & Inventori

**Selaras:** FR-INV-01..05

**Tugas:**
- CRUD produk (admin): SKU, nama, kategori, harga, satuan, berat, upload foto ke Supabase Storage.
- Manajemen stok: `stock_qty`, `location`, `reorder_level` per produk.
- Indikator stok rendah (badge/notifikasi saat `stock_qty <= reorder_level`).
- Halaman katalog publik (read-only) untuk pelanggan dengan info ketersediaan stok.
- Validasi server-side ketersediaan stok saat order dibuat (dipakai ulang di M3).
- Catat `stock_movements` setiap perubahan stok manual oleh admin.

**Definition of Done:** Admin dapat mengelola produk & stok end-to-end; pelanggan melihat katalog dengan status stok akurat; perubahan stok tercatat di `stock_movements`.

---

## M3 — Self-Order Pelanggan & Perhitungan ECT

**Selaras:** FR-CUST-01..05, FR-PQ-01, §8.2

**Tugas:**
- Keranjang belanja (state client) + checkout → buat `orders` + `order_items`.
- Modul `lib/ect/calculate.ts`: implementasi rumus ECT (§8.2) membaca parameter dari `system_settings` (`t_base`, `t_pick`, `t_pack`, faktor berat, penalti ketersediaan).
- Simpan `estimated_completion_time` pada order saat dibuat.
- Halaman riwayat & status pesanan pelanggan (real-time via Supabase Realtime — subscribe ke perubahan `orders` milik sendiri).
- Pembatalan pesanan oleh pelanggan selama status `ANTRI` (FR-CUST-05).
- Form admin untuk mengonfigurasi parameter ECT di `system_settings` (persiapan untuk M4/M9).

**Definition of Done:** Pelanggan dapat membuat pesanan, ECT terhitung dan tersimpan, status pesanan ter-update real-time, pembatalan berfungsi sesuai aturan status.

---

## M4 — Mesin Priority Queue (Min-Heap) & Anti-Starvation

**Selaras:** FR-PQ-02..04, §8.3, §8.4 — **inti akademik**

**Tugas:**
- Implementasi struktur data **binary min-heap** generik di `lib/queue/min-heap.ts` (insert, extract-min, peek) dengan kompleksitas O(log n) — unit test wajib untuk struktur ini.
- Modul `lib/queue/priority-queue-service.ts`: wrapper di atas min-heap yang sinkron dengan tabel `orders` (Postgres sebagai source of truth, heap untuk operasi cepat in-memory/per-request).
- Logika rebuild heap dari DB saat cold start (`SELECT * FROM orders WHERE status='ANTRI' ORDER BY priority_score`) — O(n).
- Implementasi aging: `priority_score = ECT - (aging_rate * waktu_tunggu_menit)`, dihitung ulang berkala.
- Pilihan implementasi aging (pilih salah satu, dokumentasikan keputusan):
  - Supabase Edge Function + `pg_cron` berjalan tiap interval, update `priority_score` semua order `ANTRI`.
  - Atau hitung on-the-fly saat papan antrian dibaca (computed, tidak disimpan).
- Catat `enqueued_at`/`dequeued_at` pada setiap transisi (FR-PQ-06), tulis baris ke `queue_logs`.
- Mode switch FIFO/Priority disimpan di `system_settings.queue_mode` (FR-PQ-07) — dipakai M5 & M9.

**Definition of Done:** Unit test min-heap lulus (insert/extract-min/peek, kasus edge n=0/1, duplikat skor); order dengan ECT kecil konsisten keluar lebih dulu kecuali ada aging; rebuild dari DB menghasilkan urutan identik dengan heap yang dipelihara live.

---

## M5 — Papan Antrian Real-time

**Selaras:** FR-PQ-05, FR-WH-01, NFR-02

**Tugas:**
- Halaman papan antrian kasir: list order `ANTRI` terurut sesuai mode aktif (FIFO/Priority), live update via Supabase Realtime channel.
- Tampilkan ECT, waktu tunggu berjalan, dan skor prioritas efektif per order.
- Highlight visual untuk order yang aging-nya tinggi (mendekati starvation) — mendukung pengujian §14.5.
- Verifikasi latensi update < 1 detik (NFR-02) melalui pengujian manual.

**Definition of Done:** Perubahan status/urutan order tercermin di papan antrian kasir tanpa refresh manual, dalam < 1 detik.

---

## M6 — Pemrosesan Gudang (Picking/Packing)

**Selaras:** FR-WH-02..05

**Tugas:**
- Aksi kasir "Ambil pesanan" → dequeue dari priority queue, set status `DIPROSES`, catat `dequeued_at`.
- UI checklist picking per item; saat ditandai, kurangi `stock_qty` dan tulis `stock_movements` (reason: order, `ref_order_id`).
- Aksi "Tandai Siap" → status `SIAP` setelah semua item di-pack.
- Catat waktu aktual pemrosesan (selisih `dequeued_at` → waktu status `SIAP`) untuk dibandingkan dengan ECT (mendukung §14.6).

**Definition of Done:** Alur DIPROSES → SIAP berfungsi, stok berkurang otomatis dan tercatat, waktu aktual tersimpan untuk evaluasi akurasi ECT.

---

## M7 — Kasir & Pembayaran

**Selaras:** FR-POS-01..04

**Tugas:**
- Halaman daftar order `SIAP` untuk kasir.
- Form pembayaran: pilih metode (tunai/transfer/QRIS), input jumlah bayar, hitung kembalian untuk tunai.
- Simpan `payments` (cashier_id, method, amount, paid_at), update order → `SELESAI`, catat `completed_at`.
- Tampilan/cetak struk ringkas (PDF/print view).

**Definition of Done:** Order `SIAP` dapat dibayar lunas, status berubah ke `SELESAI`, struk dapat ditampilkan/dicetak.

---

## M8 — Dashboard & Laporan

**Selaras:** FR-RPT-01..03

**Tugas:**
- Sambungkan komponen dashboard yang sudah ada (`section-cards.tsx`, `chart-area-interactive.tsx`, `data-table.tsx`) ke data nyata: pesanan hari ini, pendapatan, panjang antrian, stok rendah.
- Laporan penjualan per periode (harian/mingguan/bulanan) dengan ekspor CSV.
- Laporan inventori & riwayat pergerakan stok.

**Definition of Done:** Dashboard menampilkan angka real dari DB (bukan dummy), laporan dapat difilter per periode dan diekspor CSV.

---

## M9 — Modul Evaluasi FIFO vs Priority Queue

**Selaras:** FR-RPT-04, FR-PQ-07, §8.5, §14.1-14.4

**Tugas:**
- Halaman admin untuk switch mode antrian (FIFO ↔ Priority) — menulis ke `system_settings.queue_mode`, dibaca oleh M4/M5.
- Laporan kinerja antrian: rata-rata waktu tunggu per mode (dari `queue_logs.wait_time_seconds`), distribusi waktu tunggu (histogram), perbandingan throughput.
- Skrip/utility simulasi beban: generate N pesanan dengan profil bervariasi (kecil/besar, stok penuh/kritis) untuk keperluan pengujian §14.1.
- Visualisasi sensitivitas parameter (`t_pick`, `aging_rate`) terhadap rata-rata waktu tunggu — mendukung §14.7.

**Definition of Done:** Dapat menjalankan beban yang sama di kedua mode dan menghasilkan laporan perbandingan rata-rata waktu tunggu, distribusi, dan throughput.

---

## M10 — Pengujian, Simulasi Beban & Polish

**Selaras:** Fase 6, §11 (NFR), §14.5-14.7, §3.2

**Tugas:**
- Uji starvation: jalankan beban campuran, verifikasi tidak ada order menunggu melampaui ambang batas (target §3.2: 0 starvation).
- Uji akurasi ECT: bandingkan estimasi vs waktu aktual (target deviasi ≤ 25%), kalibrasi parameter bila perlu.
- Uji performa: pastikan enqueue/extract-min < 200 ms dan O(log n) terverifikasi pada n besar (ratusan order — NFR-04).
- Audit RLS menyeluruh per peran (NFR-03).
- Review responsivitas UI di desktop & tablet gudang (NFR-05).
- Perbaikan UX berdasarkan temuan pengujian; dokumentasikan hasil pengujian untuk bab skripsi.

**Definition of Done:** Semua target metrik di §3.2 tercapai atau terdokumentasi dengan penjelasan deviasi; hasil pengujian siap dipakai sebagai bahan bab evaluasi skripsi.

---

## Catatan Eksekusi

- **Urutan boleh disesuaikan** bila ada keputusan dari §16 (Pertanyaan Terbuka) yang mengubah desain, terutama soal jumlah kasir paralel (mempengaruhi asumsi single-machine SJF di M4/M9).
- M4 (Priority Queue) adalah kontribusi akademik inti — alokasikan waktu ekstra untuk unit test dan dokumentasi algoritma karena akan dibahas mendalam di skripsi.
- M9 dan M10 saling bergantung erat dengan M4: keputusan desain aging/ECT di M4 perlu di-lock sebelum simulasi beban dijalankan agar data evaluasi konsisten.
