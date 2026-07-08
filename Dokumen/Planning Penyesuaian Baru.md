# Rencana Penyesuaian Sistem POS Grosir Jasa Berdasarkan PRD Revisi 2.0

Dokumen ini memuat rencana kerja (planning) untuk menyesuaikan sistem Point of Sale (POS) Grosir Jasa yang sudah ada agar selaras dengan **Product Requirements Document (PRD) Revisi 2.0**. Penyesuaian difokuskan pada perubahan skema database, simplifikasi logika antrean (menghilangkan aging dan mode switch FIFO), penyelarasan rumus estimasi (ECT -> EWP), serta penerapan model Single Queue Multiple Server (SQMS) secara penuh untuk 4 pegawai fisik.

---

## 🔍 Analisis Gap (Sistem Saat Ini vs PRD Revisi 2.0)

Berdasarkan analisis terhadap kode dan struktur database yang ada, ditemukan beberapa perbedaan mendasar yang harus disesuaikan:

| Komponen / Fitur | Implementasi Saat Ini | Spesifikasi PRD Revisi 2.0 | Tindakan Penyesuaian |
|---|---|---|---|
| **Struktur Database (Stok & Rak)** | Stok disimpan terpisah di tabel `inventory` beserta data `location` (rak). | Tidak ada tabel `inventory` terpisah. Stok (`stock_qty`) melekat langsung pada tabel `products`. Lokasi rak dihapus. | Hapus tabel `inventory`. Pindahkan kolom `stock_qty` langsung ke tabel `products`. Hapus field lokasi rak di semua halaman. |
| **Pencatatan Pembayaran** | Pembayaran dicatat pada tabel `payments` terpisah. | Tidak ada tabel `payments` terpisah. Metode pembayaran (`payment_method` enum `tunai` \| `online`) dan status pembayaran langsung melekat pada tabel `orders`. | Hapus tabel `payments`. Tambahkan kolom `payment_method` (`tunai` \| `online`) langsung ke tabel `orders`. |
| **Log Antrean & Pengaturan** | Memiliki tabel `queue_logs` dan `system_settings` untuk melacak log antrean dan menyimpan konfigurasi. | Tidak ada tabel `queue_logs` atau `system_settings` di database. Laporan dihitung secara dinamis dari `orders`/`order_items`. | Hapus tabel `queue_logs` dan `system_settings`. Hapus modul setting parameter antrean global di UI. |
| **Metode Estimasi Waktu** | Menggunakan formula **ECT (Estimasi Completion Time)** berbasis parameter global (`t_base`, `t_pick`, `t_pack`, faktor berat) di `lib/ect/calculate.ts`. | Menggunakan formula **EWP (Estimasi Waktu Proses)** linear: $EWP = \sum (Q_i \times W_i)$ di mana $W_i$ adalah waktu pengambilan konstan per unit produk (`pickup_time_seconds`). | Hapus logika ECT lama. Buat fungsi perhitungan EWP baru berdasarkan kuantitas item ($Q_i$) dikalikan waktu ambil unit produk ($W_i$). |
| **Logika Priority Queue & Aging** | Menggunakan `priority_score` dengan mekanisme *aging* kontinu (waktu tunggu mengurangi score) dan mendukung switch mode antrean (FIFO vs Priority). | Priority Queue murni menggunakan Min-Heap berbasis EWP tanpa *aging*. Menggunakan waktu kedatangan (`created_at`) sebagai *tie-breaker* jika EWP sama. Tidak ada mode switch FIFO. | Hapus kolom `priority_score`, fungsi *aging*, dan *mode switch* FIFO. Ubah Min-Heap agar diurutkan berdasarkan `ewp` ASC dan `created_at` ASC sebagai *tie-breaker*. |
| **Pegawai (Staff)** | Memiliki entitas `staff` dengan status bahasa Inggris (`idle` / `busy`). | Memiliki tepat 4 pegawai fisik dengan status bahasa Indonesia (`idle` / `sibuk`). Pegawai bukan pengguna sistem (tidak memiliki login). | Sesuaikan enum status staf di database menjadi `idle` \| `sibuk`. Batasi data staf secara default berisi 4 entitas pegawai. |
| **Alur Status Transaksi** | Menggunakan status order bahasa Inggris (`waiting`, `processing`, `ready`, `done`, `cancelled`). | Menggunakan status order bahasa Indonesia (`antri`, `diproses`, `selesai`, `batal`). | Ubah enum status order di database dan perbarui seluruh filter status di frontend. |

---

## 📌 Milestones Rencana Kerja Penyesuaian

```mermaid
gantt
    title Roadmap Penyesuaian PRD 2.0
    dateFormat  YYYY-MM-DD
    section database
    Pembersihan & Migrasi Skema DB (8 Tabel) :crit, active, db1, 2026-07-08, 2d
    section backend
    Pembaruan Perhitungan EWP & Min-Heap         :after db1, be1, 2d
    Otomatisasi Distribusi SQMS ke Staf         :after be1, be2, 1d
    section frontend
    Pembaruan Alur Self-Order Pembeli          :after be2, fe1, 2d
    Penyelarasan Dashboard Antrean Kasir        :after fe1, fe2, 2d
    Laporan Penjualan & Dashboard Admin         :after fe2, fe3, 1d
    section testing
    Pengujian Black Box & Validasi Algoritma    :after fe3, t1, 2d
```

---

## 📦 Rincian Tugas per Milestone

### Milestone 1: Restrukturisasi Database (Supabase Migrations)
Menyesuaikan database PostgreSQL di Supabase agar tepat memiliki 8 tabel inti dengan kolom yang sesuai dengan PRD Bab 9.

1. **Membuat Migrasi Skema Baru**:
   - Hapus tabel: `inventory`, `payments`, `queue_logs`, `system_settings`.
   - Modifikasi tabel `products`:
     - Tambahkan kolom `stock_qty` (integer, default 0).
     - Hapus kolom `stock`, `unit`, `weight` yang tidak sesuai skema PRD.
   - Modifikasi tabel `product_units`:
     - Ganti nama kolom `time_weight` menjadi `pickup_time_seconds` ($W_i$) (numeric/int).
   - Modifikasi tabel `orders`:
     - Tambahkan enum `payment_method` (`tunai`, `online`).
     - Tambahkan enum `order_status` baru (`antri`, `diproses`, `selesai`, `batal`) menggantikan status lama.
     - Hubungkan `staff_id` (FK nullable) langsung ke tabel `staff`.
     - Hapus kolom `priority_score` (karena kunci prioritas murni menggunakan `ewp` + `created_at` sebagai tie-breaker).
     - Hapus kolom `payment_status`, `payment_type`, `payment_proof_url`, `cashier_id` yang tidak ada di PRD 2.0.
   - Modifikasi tabel `order_items`:
     - Sederhanakan kolom menjadi: `id`, `order_id`, `product_id`, `qty`, `unit_price`. Hapus `time_weight`, `unit_id`, `unit_name`.
   - Modifikasi tabel `staff`:
     - Tambahkan kolom `name` (text) dan `status` (`idle`, `sibuk`).
     - Inisialisasi awal (seed) dengan tepat **4 data pegawai** di tabel `staff`.
2. **Perbarui Database Types**:
   - Generate ulang types typescript dari Supabase menggunakan CLI: `supabase gen types typescript` ke `lib/supabase/database.types.ts`.

---

### Milestone 2: Perubahan Logika Algoritma & Perhitungan (Backend)
Menyesuaikan modul backend agar menghitung EWP dengan benar dan melakukan antrean prioritas sesuai kriteria baru.

1. **Modul Perhitungan EWP (`lib/ect/calculate.ts` -> `lib/ewp/calculate.ts`)**:
   - Ganti nama berkas/modul dari `ect` menjadi `ewp`.
   - Ubah logika perhitungan ke formula: $EWP = \sum (Q_i \times W_i)$.
   - Ambil nilai $W_i$ (`pickup_time_seconds`) dari data unit produk yang dipilih.
2. **Modul Min-Heap (`lib/queue/min-heap.ts`)**:
   - Sesuaikan pembanding di binary heap. Min-heap harus membandingkan properti `ewp` sebagai kunci prioritas utama.
   - Tambahkan perbandingan `created_at` (arrival time) sebagai *tie-breaker* utama jika nilai `ewp` sama persis.
3. **Penyederhanaan `PriorityQueueService` (`lib/queue/priority-queue-service.ts`)**:
   - Hapus pemanggilan `refreshAgingScores` dan fungsi RPC database `update_aging_scores`.
   - Ubah fungsi `getSortedQueue` untuk mengambil data `orders` dengan status `'antri'`, memprosesnya lewat `MinHeap` dengan pembanding `ewp` dan `created_at`.
4. **Pembaruan SQL Functions / Stored Procedures**:
   - Tulis ulang RPC `checkout_order` agar menghitung EWP, memasukkan data ke `orders` dengan status `'antri'`, mengurangi stok di `products` secara langsung, dan menghilangkan referensi ke `queue_logs`.
   - Tulis ulang RPC `pop_next_order` (atau mekanisme distribusi SQMS) agar mengambil order teratas (akar heap) berdasarkan `ewp ASC, created_at ASC` dan menugaskannya ke pegawai berstatus `'idle'`.

---

### Milestone 3: Penerapan Alur Distribusi Otomatis SQMS (Single Queue Multiple Server)
Memastikan distribusi pesanan ke 4 pegawai berjalan secara otomatis dan real-time.

1. **Mekanisme Otomatisasi Distribusi**:
   - Saat pembeli berhasil checkout, sistem otomatis memicu pencarian staf yang berstatus `idle`.
   - Jika ada staf `idle`, panggil RPC `pop_next_order` untuk menugaskan pesanan prioritas teratas (akar min-heap) kepada staf tersebut.
   - Status staf berubah menjadi `sibuk`, dan status pesanan berubah menjadi `diproses`.
   - Jika semua staf `sibuk`, pesanan tetap tinggal di antrean dengan status `antri`.
   - Saat kasir mengonfirmasi pembayaran (selesai), status pesanan menjadi `selesai`, status staf yang bersangkutan kembali menjadi `idle`, dan sistem secara otomatis menarik pesanan berikutnya dari antrean untuk ditugaskan ke staf tersebut.

---

### Milestone 4: Penyesuaian Antarmuka Pengguna (Frontend UI)

#### 1. Halaman Pembeli (Self-Order)
- **Katalog & Keranjang (`app/customer/shop/page.tsx` & `app/customer/cart/page.tsx`)**:
  - Ambil info stok langsung dari `products.stock_qty`.
  - Hitung estimasi EWP secara real-time pada keranjang belanja menggunakan rumus $EWP = \sum (Q_i \times W_i)$.
  - Tampilkan ringkasan EWP kepada pembeli sebelum checkout.
- **Riwayat Pesanan (`app/customer/orders/page.tsx`)**:
  - Tampilkan status pesanan dengan istilah: `antri`, `diproses`, `selesai`, `batal`.
  - Tampilkan EWP pesanan dan pantau perubahan status secara real-time menggunakan Supabase Realtime.

#### 2. Halaman Kasir
- **Dasbor Antrean Real-time (`app/dashboard/queue/page.tsx`)**:
  - Tampilkan daftar antrean pesanan yang terurut berdasarkan Min-Heap (EWP + `created_at` tie-breaker).
  - Tampilkan daftar 4 pegawai beserta status mereka (`idle` / `sibuk`) dan pesanan yang sedang dikerjakan.
  - Hilangkan panel konfigurasi *aging rate* dan *queue mode switch*.
- **Halaman Kasir & Cetak Struk (`app/dashboard/cashier/page.tsx`)**:
  - Kasir memproses pembayaran pesanan yang berstatus `diproses` atau siap.
  - Sediakan tombol konfirmasi pembayaran (Metode: Tunai / Online).
  - Saat konfirmasi sukses, perbarui status pesanan menjadi `selesai`, dan status pegawai kembali ke `idle`.
  - Fitur cetak struk disesuaikan agar mencantumkan data pegawai bertugas secara fisik untuk mengambil barang.

#### 3. Halaman Admin
- **Manajemen Produk & Unit (`app/dashboard/products/page.tsx` & `app/dashboard/picking-time/page.tsx`)**:
  - Form tambah/edit produk disesuaikan agar mengedit kolom `stock_qty` langsung di tabel `products`. Hapus input lokasi rak dan berat.
  - Menu Waktu Pengambilan digunakan untuk mengelola data unit kemasan (`product_units`) dan nilai `pickup_time_seconds` ($W_i$) per unit barang.
- **Dashboard & Laporan Penjualan (`app/dashboard/page.tsx` & `app/dashboard/reports/page.tsx`)**:
  - Hapus tab evaluasi antrean (FIFO vs Priority Queue).
  - Sesuaikan query visualisasi chart agar mengambil data total penjualan bulanan dan produk terlaris secara dinamis langsung dari agregasi tabel `orders` dan `order_items` (karena tabel `payments` dihapus).

---

## 🔍 Rencana Verifikasi & Pengujian Akademik

Untuk mendukung keabsahan penelitian skripsi, pengujian khusus akan dilakukan pada aspek-aspek berikut:

1. **Uji Kebenaran Logika Min-Heap (Tie-Breaker)**:
   - Membuat skenario uji dengan memasukkan pesanan yang memiliki EWP sama tetapi waktu kedatangan berbeda.
   - Memverifikasi bahwa pesanan yang datang lebih awal (nilai `created_at` lebih kecil) selalu dikeluarkan lebih dulu oleh fungsi antrean.
2. **Uji Perhitungan EWP Manual vs Sistem**:
   - Mengambil beberapa sampel pesanan, menghitung EWP secara manual menggunakan rumus $EWP = \sum (Q_i \times W_i)$, lalu membandingkannya dengan nilai `orders.ewp` di database untuk memastikan deviasi bernilai 0%.
3. **Uji Otomatisasi Distribusi SQMS**:
   - Memeriksa perubahan status staf (`idle` $\leftrightarrow$ `sibuk`) secara otomatis ketika pesanan masuk dan diselesaikan.
   - Memastikan tidak ada pesanan yang terdistribusi ke staf yang sedang sibuk.

---

*Dokumen ini merupakan panduan utama dalam menyelaraskan kode sistem dengan kebutuhan akademik skripsi. Seluruh perubahan wajib mengacu pada kesepakatan struktur dan logika dalam dokumen ini.*
