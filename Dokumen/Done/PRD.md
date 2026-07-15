# Product Requirements Document (PRD)
## Rancang Bangun Sistem Point of Sale Grosir dengan Penerapan Priority Queue pada Antrian Pesanan
**Studi Kasus: Grosir Jasa**

| | |
|---|---|
| **Versi** | 1.0 |
| **Tanggal** | Juni 2026 |
| **Penyusun** | Kholis — Parzello Tech |
| **Stack** | Next.js (App Router) + shadcn/ui + Supabase (Postgres, Auth, Realtime, Storage) |
| **Algoritma Inti** | Priority Queue (min-heap) dengan kaidah *Shortest Job First* / *Shortest Processing Time* |

---

## 1. Ringkasan Eksekutif

Sistem ini adalah aplikasi Point of Sale (POS) berbasis web untuk usaha grosir yang melayani pemesanan dalam volume. Permasalahan khas grosir adalah banyaknya pesanan masuk secara bersamaan, sementara pemrosesan di gudang terbatas. Bila pesanan diproses berdasarkan urutan kedatangan (FIFO) saja, pesanan ringan yang sebenarnya bisa cepat selesai justru tertahan di belakang pesanan besar, sehingga rata-rata waktu tunggu seluruh pelanggan membengkak.

Sistem menerapkan **Priority Queue** dengan kaidah **Shortest Job First (SJF)**: pesanan dengan **estimasi waktu penyelesaian tercepat** didahulukan. Pendekatan ini secara teoretis meminimalkan rata-rata waktu tunggu (*mean flow time*) pada satu titik pemrosesan, dan menjadi kontribusi utama yang akan diuji secara empiris dengan membandingkannya terhadap skema FIFO.

Pelanggan dapat memesan mandiri (self-order), pesanan otomatis masuk ke antrian prioritas, lalu kasir memproses pesanan sesuai urutan prioritas hingga menyelesaikan pembayaran.

---

## 2. Latar Belakang & Pernyataan Masalah

Pada Grosir Jasa, pesanan diterima dari banyak pelanggan dengan karakteristik berbeda — ada yang hanya beberapa item dan stok tersedia, ada yang puluhan jenis barang dengan kuantitas besar. Tanpa pengaturan urutan yang cerdas:

- Pesanan kecil dan cepat selesai menunggu lama di belakang pesanan besar.
- Rata-rata waktu tunggu seluruh pelanggan meningkat, menurunkan kepuasan.
- Staf gudang tidak punya panduan urutan kerja yang objektif.
- Tidak ada visibilitas real-time atas status pesanan untuk pelanggan maupun pengelola.

**Hipotesis solusi:** dengan memprioritaskan pesanan berestimasi tercepat (SJF), throughput dan rata-rata waktu tunggu membaik dibanding FIFO, tanpa mengorbankan keadilan secara berlebihan (ditangani lewat mekanisme *aging*/anti-starvation).

---

## 3. Tujuan & Metrik Keberhasilan

### 3.1 Tujuan Produk
1. Menyediakan POS grosir lengkap: kasir, inventori, pelanggan, dan laporan.
2. Mengimplementasikan Priority Queue berbasis SJF untuk pengurutan pemrosesan pesanan.
3. Memberi visibilitas real-time status antrian dan pesanan ke semua peran.
4. Menyediakan data terukur untuk membandingkan kinerja FIFO vs Priority Queue.

### 3.2 Metrik Keberhasilan

| Metrik | Target |
|---|---|
| Rata-rata waktu tunggu pesanan (Priority Queue vs FIFO) | Penurunan ≥ 20% pada beban simulasi |
| Akurasi estimasi waktu penyelesaian vs aktual | Deviasi rata-rata ≤ 25% |
| Operasi enqueue/dequeue antrian | O(log n), respons < 200 ms |
| Latensi pembaruan papan antrian real-time | < 1 detik |
| Tidak ada pesanan "kelaparan" (starvation) | 0 pesanan menunggu di atas ambang batas waktu maksimum |

---

## 4. Lingkup (Scope)

### 4.1 Termasuk (In-Scope)
- Autentikasi & manajemen peran (Pelanggan, Kasir, Staf Gudang, Admin/Owner).
- Katalog produk & manajemen inventori (stok, lokasi, *reorder level*).
- Pemesanan mandiri oleh pelanggan (self-order).
- Mesin Priority Queue (SJF) dengan estimasi waktu penyelesaian + anti-starvation.
- Papan antrian real-time untuk kasir.
- Pemrosesan pesanan oleh kasir (picking, packing, perubahan status).
- Kasir & pembayaran (tunai/transfer/QRIS — pencatatan).
- Dashboard & laporan (penjualan, inventori, kinerja antrian).
- Modul evaluasi: log waktu tunggu untuk perbandingan FIFO vs Priority Queue.

### 4.2 Tidak Termasuk (Out-of-Scope) — versi ini
- Multi-cabang / multi-gudang.
- Integrasi *payment gateway* otomatis (hanya pencatatan manual + opsi QRIS statis).
- Aplikasi mobile native (web responsif saja).
- Integrasi akuntansi/pajak eksternal.
- Pengiriman/logistik pihak ketiga.

---

## 5. Persona & Peran Pengguna

| Peran | Deskripsi | Akses Utama |
|---|---|---|
| **Pelanggan** | Pembeli grosir yang memesan mandiri | Lihat katalog, buat pesanan, pantau status pesanan sendiri |
| **Kasir** | Memproses pesanan dari antrian sekaligus menyelesaikan pembayaran | Papan antrian prioritas, ubah status (proses/siap), penyesuaian stok saat picking, proses pembayaran, cetak/struk |
| **Admin/Owner** | Pengelola penuh sistem | Semua modul: produk, inventori, pengguna, parameter antrian, laporan + seluruh akses Kasir |

---

## 6. Alur Pengguna Utama (User Flows)

### 6.1 Alur Inti: Pesanan → Antrian → Gudang → Kasir
1. **Pelanggan** memilih produk, menentukan kuantitas, dan mengirim pesanan.
2. Sistem memvalidasi ketersediaan stok dan menghitung **Estimasi Waktu Penyelesaian (ECT)**.
3. Pesanan masuk **Priority Queue** dengan kunci prioritas = ECT (kecil = didahulukan).
4. **Kasir** melihat papan antrian terurut prioritas; mengambil pesanan teratas → status `DIPROSES`.
5. Kasir melakukan picking & packing; stok dikurangi; status → `SIAP`.
6. **Kasir** memproses pembayaran pesanan `SIAP` → status `SELESAI`.
7. **Pelanggan** menerima notifikasi real-time pada tiap perubahan status.

### 6.2 Alur Anti-Starvation (Aging)
- Setiap interval (mis. tiap menit), skor prioritas efektif pesanan yang menunggu lama diturunkan (dibuat lebih mendesak), sehingga pesanan besar tidak tertahan tanpa batas.

### 6.3 Alur Admin
- Mengatur produk/stok, mengelola pengguna, **mengonfigurasi parameter ECT** (waktu dasar, waktu per-SKU, waktu per-unit, laju aging), dan meninjau laporan kinerja antrian.

---

## 7. Kebutuhan Fungsional

Notasi ID: `FR-[MODUL]-[NO]`.

### 7.1 Autentikasi & Manajemen Pengguna
- **FR-AUTH-01** Sistem mendukung registrasi & login via Supabase Auth (email/password).
- **FR-AUTH-02** Setiap pengguna memiliki satu peran tersimpan di `profiles.role`.
- **FR-AUTH-03** Otorisasi berbasis peran (RBAC) ditegakkan di UI dan di basis data via Row Level Security (RLS).
- **FR-AUTH-04** Admin dapat membuat/menonaktifkan akun kasir.

### 7.2 Katalog Produk & Inventori
- **FR-INV-01** CRUD produk: SKU, nama, kategori, harga grosir, satuan, berat, foto.
- **FR-INV-02** Pencatatan stok per produk, lokasi rak, dan *reorder level*.
- **FR-INV-03** Stok berkurang otomatis saat pesanan diproses (picking) dan tercatat di *stock movement*.
- **FR-INV-04** Notifikasi/penanda stok rendah saat ≤ *reorder level*.
- **FR-INV-05** Validasi ketersediaan stok saat pesanan dibuat.

### 7.3 Pelanggan & Self-Order
- **FR-CUST-01** Pelanggan melihat katalog produk beserta ketersediaan stok.
- **FR-CUST-02** Pelanggan menambah item ke keranjang dan mengirim pesanan.
- **FR-CUST-03** Pelanggan memantau status pesanannya secara real-time.
- **FR-CUST-04** Pelanggan melihat riwayat pesanan sendiri.
- **FR-CUST-05** Pelanggan dapat membatalkan pesanan selama status masih `ANTRI`.

### 7.4 Antrian Prioritas (Modul Inti)
- **FR-PQ-01** Saat pesanan dibuat, sistem menghitung **ECT** berdasarkan model estimasi (lihat Bagian 8).
- **FR-PQ-02** Pesanan dimasukkan ke Priority Queue (min-heap) dengan kunci prioritas = skor prioritas (ECT).
- **FR-PQ-03** Operasi `enqueue` dan `extract-min` berjalan dalam kompleksitas O(log n).
- **FR-PQ-04** Mekanisme **aging**: skor prioritas efektif diturunkan seiring lama menunggu untuk mencegah starvation.
- **FR-PQ-05** Papan antrian menampilkan urutan pemrosesan terkini secara real-time.
- **FR-PQ-06** Setiap operasi enqueue/dequeue mencatat *timestamp* untuk perhitungan waktu tunggu (evaluasi).
- **FR-PQ-07** Admin dapat memilih mode pengurutan (Priority Queue / FIFO) untuk keperluan perbandingan/pengujian.

### 7.5 Pemrosesan Pesanan (oleh Kasir)
- **FR-WH-01** Kasir melihat antrian terurut prioritas (papan real-time).
- **FR-WH-02** Kasir mengambil pesanan teratas → status `DIPROSES` (dequeue).
- **FR-WH-03** Kasir menandai item ter-picking; sistem menyesuaikan stok.
- **FR-WH-04** Kasir menandai pesanan `SIAP` setelah packing selesai.
- **FR-WH-05** Sistem mencatat waktu aktual pemrosesan (untuk mengukur akurasi ECT).

### 7.6 Kasir & Pembayaran
- **FR-POS-01** Kasir melihat daftar pesanan berstatus `SIAP`.
- **FR-POS-02** Kasir memilih metode pembayaran (tunai/transfer/QRIS) dan mencatat pembayaran.
- **FR-POS-03** Sistem menghitung total, kembalian (tunai), dan menerbitkan struk/ringkasan.
- **FR-POS-04** Status pesanan → `SELESAI` setelah pembayaran lunas tercatat.

### 7.7 Dashboard & Laporan
- **FR-RPT-01** Dashboard ringkas: pesanan hari ini, pendapatan, panjang antrian, stok rendah.
- **FR-RPT-02** Laporan penjualan per periode (harian/mingguan/bulanan) dengan ekspor CSV.
- **FR-RPT-03** Laporan inventori & pergerakan stok.
- **FR-RPT-04** **Laporan kinerja antrian**: rata-rata waktu tunggu, perbandingan FIFO vs Priority Queue, distribusi waktu tunggu.

---

## 8. Desain Algoritma Priority Queue (Inti Akademik)

### 8.1 Kaidah Prioritas
Kaidah yang digunakan adalah **Shortest Job First (SJF)** / **Shortest Processing Time (SPT)**: pesanan dengan estimasi waktu penyelesaian terkecil diproses lebih dulu. Secara teori penjadwalan, SPT meminimalkan **rata-rata waktu penyelesaian (mean flow time)** pada satu mesin/titik pemrosesan.

### 8.2 Model Estimasi Waktu Penyelesaian (ECT)
ECT setiap pesanan dihitung sebagai:

```
ECT = T_base
      + (t_pick × jumlah_SKU_distinct)
      + (t_pack × total_kuantitas × faktor_berat)
      + penalti_ketersediaan
```

| Parameter | Keterangan | Nilai default (dapat dikonfigurasi Admin) |
|---|---|---|
| `T_base` | Overhead administrasi/verifikasi per pesanan | 2 menit |
| `t_pick` | Waktu ambil per jenis barang (SKU) | 1.5 menit/SKU |
| `t_pack` | Waktu kemas per unit | 0.2 menit/unit |
| `faktor_berat` | Pengali untuk barang berat/bulky (khas grosir) | 1.0–1.5 |
| `penalti_ketersediaan` | Penalti bila ada item stok kritis/partial | 0 atau besar |

Parameter dibuat **konfigurabel** agar bisa dilakukan analisis sensitivitas pada bab pengujian.

### 8.3 Struktur Data: Min-Heap
Priority Queue diimplementasikan sebagai **binary min-heap** di lapisan aplikasi (modul layanan TypeScript), dengan basis data sebagai persistensi:

| Operasi | Kompleksitas |
|---|---|
| `enqueue` (insert) | O(log n) |
| `extract-min` (dequeue prioritas tertinggi) | O(log n) |
| `peek` | O(1) |
| Membangun ulang heap dari DB | O(n) |

Kunci prioritas = **skor prioritas efektif** (lihat aging). Nilai terkecil keluar lebih dulu.

### 8.4 Anti-Starvation (Aging)
Agar pesanan besar (ECT tinggi) tidak menunggu selamanya:

```
skor_prioritas_efektif = ECT − (laju_aging × waktu_tunggu_menit)
```

Semakin lama menunggu, skor turun (menjadi lebih mendesak). `laju_aging` dikonfigurasi Admin. Skor efektif dihitung ulang secara periodik (mis. via Supabase Edge Function + pg_cron atau pada setiap pembacaan antrian).

### 8.5 Mode Perbandingan
Sistem mendukung dua mode pemrosesan yang dapat di-*switch* Admin:
- **FIFO** — urut waktu kedatangan (`created_at` ASC).
- **Priority Queue (SJF)** — urut skor prioritas efektif ASC.

Mode ini memungkinkan pengujian A/B untuk membuktikan klaim penurunan rata-rata waktu tunggu.

---

## 9. Model Data (Supabase / PostgreSQL)

Tabel inti (kolom audit `created_at`, `updated_at` diasumsikan ada di setiap tabel):

### `profiles`
| Kolom | Tipe | Keterangan |
|---|---|---|
| id (PK) | uuid | referensi `auth.users` |
| full_name | text | |
| role | enum | `pelanggan` \| `kasir` \| `admin` |
| is_active | bool | |

### `products`
| Kolom | Tipe | Keterangan |
|---|---|---|
| id (PK) | uuid | |
| sku | text (unik) | |
| name | text | |
| category | text | |
| price | numeric | harga grosir |
| unit | text | satuan |
| weight | numeric | untuk faktor berat ECT |
| image_url | text | Supabase Storage |

### `inventory`
| Kolom | Tipe | Keterangan |
|---|---|---|
| product_id (PK, FK) | uuid | |
| stock_qty | int | |
| location | text | rak/lokasi |
| reorder_level | int | ambang stok rendah |

### `orders`
| Kolom | Tipe | Keterangan |
|---|---|---|
| id (PK) | uuid | |
| customer_id (FK) | uuid | → profiles |
| status | enum | `ANTRI` \| `DIPROSES` \| `SIAP` \| `SELESAI` \| `BATAL` |
| total_amount | numeric | |
| estimated_completion_time | numeric | ECT (menit) |
| priority_score | numeric | skor prioritas efektif |
| enqueued_at | timestamptz | masuk antrian |
| dequeued_at | timestamptz | mulai diproses |
| completed_at | timestamptz | selesai |

### `order_items`
| Kolom | Tipe | Keterangan |
|---|---|---|
| id (PK) | uuid | |
| order_id (FK) | uuid | |
| product_id (FK) | uuid | |
| qty | int | |
| unit_price | numeric | harga saat order |

### `payments`
| Kolom | Tipe | Keterangan |
|---|---|---|
| id (PK) | uuid | |
| order_id (FK) | uuid | |
| cashier_id (FK) | uuid | → profiles |
| method | enum | `tunai` \| `transfer` \| `qris` |
| amount | numeric | |
| paid_at | timestamptz | |

### `stock_movements`
| Kolom | Tipe | Keterangan |
|---|---|---|
| id (PK) | uuid | |
| product_id (FK) | uuid | |
| change_qty | int | + masuk / − keluar |
| reason | text | order/penyesuaian |
| ref_order_id | uuid | opsional |

### `queue_logs` (evaluasi)
| Kolom | Tipe | Keterangan |
|---|---|---|
| id (PK) | uuid | |
| order_id (FK) | uuid | |
| mode | enum | `fifo` \| `priority` |
| enqueued_at | timestamptz | |
| dequeued_at | timestamptz | |
| wait_time_seconds | int | dihitung untuk laporan |

### `system_settings`
| Kolom | Tipe | Keterangan |
|---|---|---|
| key | text (PK) | mis. `t_base`, `t_pick`, `t_pack`, `aging_rate`, `queue_mode` |
| value | jsonb/numeric | parameter konfigurabel |

---

## 10. Arsitektur Sistem & Teknologi

| Lapisan | Teknologi | Peran |
|---|---|---|
| Frontend | Next.js (App Router), TypeScript, Tailwind, shadcn/ui | UI semua peran, responsif |
| Logika Server | Next.js Route Handlers / Server Actions | Validasi, perhitungan ECT, modul Priority Queue (min-heap) |
| Basis Data | Supabase PostgreSQL + RLS | Persistensi data, otorisasi tingkat baris |
| Auth | Supabase Auth | Login, sesi, peran |
| Realtime | Supabase Realtime | Papan antrian & status pesanan live |
| Storage | Supabase Storage | Foto produk, struk |
| Penjadwalan | Supabase Edge Functions + pg_cron | Pembaruan aging skor prioritas berkala |

**Catatan implementasi PQ:** min-heap dipelihara sebagai modul layanan; saat *cold start* heap dibangun ulang dari tabel `orders` berstatus `ANTRI`. Sumber kebenaran tetap di Postgres; min-heap mempercepat operasi enqueue/extract-min dan menjadi demonstrasi eksplisit struktur data prioritas.

---

## 11. Kebutuhan Non-Fungsional (NFR)

| ID | Kategori | Kebutuhan |
|---|---|---|
| NFR-01 | Kinerja | Operasi antrian O(log n); respons API < 200 ms pada beban normal |
| NFR-02 | Realtime | Pembaruan papan antrian < 1 detik |
| NFR-03 | Keamanan | RLS aktif di semua tabel; tiap peran hanya mengakses datanya |
| NFR-04 | Skalabilitas | Mendukung ratusan pesanan aktif tanpa degradasi signifikan |
| NFR-05 | Keterpakaian | UI responsif (desktop & tablet gudang), konsisten via shadcn/ui |
| NFR-06 | Auditabilitas | Semua pergerakan stok & transaksi tercatat |
| NFR-07 | Keterujian | Mode FIFO/Priority dapat di-*switch* untuk pengujian terkontrol |

---

## 12. Keamanan & RLS (Ringkasan Kebijakan)

| Peran | Kebijakan akses |
|---|---|
| Pelanggan | `SELECT/INSERT` pesanan miliknya; baca katalog publik |
| Kasir | Baca antrian; `UPDATE` status `DIPROSES`/`SIAP`/`SELESAI`; tulis pergerakan stok; `INSERT` pembayaran |
| Admin | Akses penuh seluruh tabel & pengaturan |

---

## 13. Rencana Pengembangan (Roadmap Bertahap)

| Fase | Fokus | Output |
|---|---|---|
| **Fase 0** | Setup proyek | Next.js + shadcn + Supabase, skema DB, Auth & RLS dasar |
| **Fase 1** | Inventori & katalog | CRUD produk, manajemen stok, katalog pelanggan |
| **Fase 2** | Self-order & pesanan | Keranjang, pembuatan pesanan, perhitungan ECT |
| **Fase 3** | Priority Queue | Min-heap, enqueue/dequeue, aging, papan antrian real-time |
| **Fase 4** | Gudang & Kasir | Pemrosesan, perubahan status, pembayaran, struk |
| **Fase 5** | Laporan & evaluasi | Dashboard, laporan, modul perbandingan FIFO vs Priority |
| **Fase 6** | Pengujian & polish | Uji beban/simulasi, validasi metrik, perbaikan UX |

---

## 14. Rencana Pengujian & Evaluasi (Pendukung Skripsi)

1. **Simulasi beban** — generate N pesanan dengan profil bervariasi (kecil/besar, stok penuh/kritis).
2. **Jalankan mode FIFO**, catat `wait_time` tiap pesanan → hitung rata-rata.
3. **Jalankan mode Priority Queue (SJF)** dengan beban setara, catat ulang.
4. **Bandingkan** rata-rata waktu tunggu, distribusi, dan throughput.
5. **Uji starvation** — verifikasi mekanisme aging mencegah pesanan menunggu melampaui ambang.
6. **Akurasi ECT** — bandingkan estimasi vs waktu aktual pemrosesan gudang.
7. **Analisis sensitivitas** — variasikan parameter (`t_pick`, `aging_rate`) dan amati pengaruhnya.

---

## 15. Risiko & Mitigasi

| Risiko | Dampak | Mitigasi |
|---|---|---|
| Estimasi ECT tidak akurat | Urutan prioritas keliru | Parameter konfigurabel + kalibrasi dari data aktual |
| Starvation pesanan besar | Ketidakadilan | Mekanisme aging + ambang batas maksimum |
| Konsistensi heap vs DB | Urutan tidak sinkron | Postgres sebagai sumber kebenaran; rebuild heap saat *cold start* |
| Lonjakan pesanan bersamaan | Kinerja menurun | Operasi O(log n) + indeks DB pada `priority_score` |
| Kompleksitas realtime | Bug status | Status pesanan sebagai *single source* + langganan Realtime terfokus |

---

## 16. Asumsi & Pertanyaan Terbuka

**Asumsi:**
- Satu titik pemrosesan gudang (single processing station) — sesuai model SJF satu mesin.
- Pembayaran dicatat manual (belum ada integrasi gateway otomatis).
- Pelanggan sudah terdaftar untuk dapat self-order.

**Pertanyaan terbuka (untuk dikonfirmasi):**
1. Apakah ada lebih dari satu kasir yang memproses pesanan secara paralel? (memengaruhi model penjadwalan: 1 mesin vs banyak mesin)
2. Apakah pembayaran dilakukan **sebelum** pesanan diproses (prabayar) atau **setelah** siap (seperti alur saat ini)?
3. Apakah perlu peran "supervisor" yang bisa override prioritas pesanan secara manual?
4. Apakah satuan waktu ECT (menit) dan parameter default sudah sesuai realita Grosir Jasa, atau perlu observasi lapangan dulu?

---

*Dokumen ini bersifat hidup dan akan diperbarui seiring keputusan desain dan temuan pengujian.*
