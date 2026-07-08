# Product Requirements Document (PRD)
## Rancang Bangun Sistem Point of Sale Grosir dengan Penerapan Priority Queue pada Antrian Pesanan
**Studi Kasus: Grosir Jasa (Aceh Timur)**

| | |
|---|---|
| **Versi** | 2.0 (revisi — disesuaikan dengan skripsi) |
| **Tanggal** | Juli 2026 |
| **Penyusun** | Zuyyin Zafirah |
| **Stack** | Next.js 15+ (App Router) + Tailwind CSS + shadcn/ui + Supabase (PostgreSQL, Auth, Realtime) + React Context/Zustand |
| **Algoritma Inti** | Priority Queue (Min-Heap) dengan model estimasi **EWP** (Estimasi Waktu Proses) khas grosir, bukan SJF klasik dengan *exponential averaging* |

---

## 1. Ringkasan Eksekutif

Sistem ini adalah aplikasi Point of Sale (POS) berbasis web untuk Grosir Jasa di Aceh Timur. Saat ini pemesanan masih manual: pembeli datang ke toko, menulis daftar belanja di kertas, dan menyerahkannya ke salah satu dari **empat pegawai** tanpa mekanisme distribusi yang formal. Akibatnya distribusi beban kerja antar pegawai tidak merata dan pembeli tidak bisa mengecek stok sebelum datang.

Sistem menerapkan **Priority Queue berbasis Min-Heap** dengan nilai prioritas berupa **Estimasi Waktu Proses (EWP)**: pesanan dengan EWP terkecil diproses lebih dulu. Bila dua pesanan memiliki EWP yang sama, **waktu kedatangan (arrival time)** dipakai sebagai penyeimbang keadilan (tie-breaker). Begitu dihitung, sistem **secara otomatis** mendistribusikan pesanan ke salah satu dari empat pegawai yang sedang **idle** — model ini disebut **Single Queue Multiple Server (SQMS)**.

Pembeli memesan mandiri (self-order) dari perangkat mobile, pesanan otomatis masuk ke Min-Heap, pegawai idle menerima dan menyiapkan barang secara fisik, dan kasir memantau dasbor antrian, mencetak struk, serta mengonfirmasi pembayaran.

---

## 2. Latar Belakang & Pernyataan Masalah

Pada Grosir Jasa, pesanan diterima dari banyak pembeli dengan karakteristik berbeda — ada yang hanya beberapa item, ada yang puluhan jenis barang dalam kuantitas besar. Tanpa mekanisme pengaturan yang formal:

- Distribusi pesanan ke empat pegawai bergantung pada penilaian subjektif pembeli/pegawai sendiri, bukan sistem.
- Pembagian beban kerja antar pegawai tidak merata; ada pegawai yang idle sementara yang lain menumpuk pesanan besar.
- Pembeli tidak dapat mengetahui ketersediaan stok sebelum datang ke toko.
- Tidak ada laporan penjualan terstruktur untuk pengambilan keputusan pemilik usaha.

**Hipotesis penelitian:** penerapan Priority Queue berbasis Min-Heap dengan kriteria EWP dan waktu kedatangan mampu mendistribusikan pesanan secara otomatis dan efisien ke empat pegawai, sehingga tidak ada pegawai yang menganggur selama masih ada pesanan dalam antrian.

---

## 3. Tujuan & Ruang Lingkup Pengujian

### 3.1 Tujuan Produk
1. Menyediakan POS grosir berbasis web: pemesanan digital, manajemen stok, pembayaran, dan laporan.
2. Mengimplementasikan Priority Queue berbasis Min-Heap dengan kriteria EWP + waktu kedatangan sebagai tie-breaker.
3. Mendistribusikan pesanan secara otomatis ke pegawai idle melalui model Single Queue Multiple Server (empat pegawai).
4. Memberi visibilitas real-time atas status pesanan dan ketersediaan pegawai (idle/sibuk) kepada kasir.

### 3.2 Metode Pengujian
Pengujian sistem menggunakan **Black Box Testing** untuk memvalidasi seluruh fungsionalitas sesuai spesifikasi (F-01–F-14), ditambah **verifikasi manual** terhadap kebenaran logika algoritma Min-Heap (insert/extract-min) dan perhitungan EWP.

> Catatan: penelitian ini **tidak** membandingkan performa FIFO vs Priority Queue secara empiris, dan **tidak** menyediakan mode switch FIFO/Priority — fokus pembuktian ada pada kebenaran algoritma dan otomatisasi distribusi ke pegawai.

---

## 4. Lingkup (Scope)

### 4.1 Termasuk (In-Scope) — sesuai Batasan Masalah BAB I
- Registrasi akun untuk pembeli & login untuk seluruh pengguna (pembeli, kasir, admin).
- Katalog produk & ketersediaan stok real-time untuk pembeli.
- Pemesanan mandiri (self-order) oleh pembeli via browser di perangkat mobile.
- Perhitungan estimasi total harga otomatis.
- Mesin Priority Queue (Min-Heap) berbasis EWP + tie-breaker waktu kedatangan.
- Distribusi otomatis pesanan ke pegawai idle (Single Queue Multiple Server, 4 pegawai).
- Dasbor antrian real-time untuk kasir (urutan prioritas, EWP, status idle/sibuk pegawai).
- Pencetakan struk pesanan oleh kasir (untuk diserahkan ke pegawai sebagai panduan kerja).
- Konfirmasi pembayaran oleh kasir (tunai maupun online) — pembeli mengambil barang sendiri, **tanpa fitur pengiriman**.
- Pembaruan stok otomatis saat pesanan dikonfirmasi selesai.
- Manajemen produk & pengguna oleh admin.
- Laporan penjualan dalam bentuk **visualisasi grafik bulanan** dan **produk terlaris**.

### 4.2 Tidak Termasuk (Out-of-Scope)
- Multi-cabang / multi-gudang.
- Fitur pengiriman/delivery — pembeli wajib mengambil barang sendiri ke toko.
- Login/hak akses untuk pegawai — pegawai hanya entitas fisik yang dilacak sistem (status idle/sibuk), bukan pengguna sistem.
- Mode perbandingan FIFO vs Priority Queue.
- Mekanisme *aging*/anti-starvation kontinu — keadilan hanya lewat tie-breaking waktu kedatangan saat EWP sama.
- Parameter EWP yang dapat dikonfigurasi admin — waktu pengambilan per jenis barang bersifat **tetap/konstan** hasil observasi lapangan.
- Integrasi payment gateway otomatis, tabel pembayaran terpisah, atau metode transfer/QRIS granular — cukup pencatatan tunai/online pada pesanan.
- Aplikasi mobile native (web responsif saja).
- Integrasi akuntansi/pajak eksternal.

---

## 5. Persona & Peran Pengguna

Sistem memiliki **tiga level pengguna** (bukan empat — pegawai bukan pengguna sistem).

| Peran | Deskripsi | Akses Utama |
|---|---|---|
| **Pembeli (Customer)** | Registrasi & login, melihat katalog dan stok real-time, membuat & mengonfirmasi pesanan digital dari perangkat mobile | Katalog, buat pesanan, pantau status pesanan sendiri secara real-time |
| **Kasir** | Menerima pesanan masuk, memantau dasbor antrian yang sudah terurut prioritas, mencetak struk, mengonfirmasi pembayaran | Dasbor antrian real-time (urutan prioritas, EWP, status idle/sibuk pegawai), cetak struk, konfirmasi pembayaran |
| **Admin** | Pengelola penuh sistem | Kelola data produk & stok, kelola akun pengguna (kasir, pembeli), lihat & unduh laporan penjualan |

**Pegawai (4 orang):** bukan peran login. Entitas ini dilacak lewat tabel `staff` (nama + status idle/sibuk) dan menerima penugasan pesanan secara otomatis dari sistem berdasarkan Min-Heap. Tugasnya murni fisik: menyiapkan barang berdasarkan struk yang dicetak kasir.

---

## 6. Alur Pengguna Utama (User Flows)

### 6.1 Alur Inti: Pesanan → Min-Heap → Distribusi Otomatis → Kasir
1. **Pembeli** memilih produk, menentukan kuantitas per item, dan mengonfirmasi pesanan.
2. Sistem menghitung **estimasi total harga** dan **EWP** (lihat Bagian 8) secara otomatis.
3. Pesanan dimasukkan ke **Min-Heap** dengan kunci prioritas = EWP (nilai terkecil = prioritas tertinggi).
4. Sistem mengecek pegawai yang berstatus **idle**; pesanan dengan EWP terkecil (elemen akar heap) **otomatis didistribusikan** ke pegawai idle tersebut (Single Queue Multiple Server) — status pegawai berubah menjadi **sibuk**.
5. **Kasir** melihat dasbor antrian real-time dan mencetak struk pesanan (berisi item, jumlah, estimasi harga, nama pegawai bertugas) untuk diserahkan ke pegawai.
6. Pegawai menyiapkan barang secara fisik berdasarkan struk.
7. **Kasir** mengonfirmasi pembayaran (tunai/online) setelah barang diserahkan → status pesanan menjadi **selesai**, stok produk diperbarui otomatis, status pegawai kembali menjadi **idle**.
8. **Pembeli** memantau status pesanannya secara real-time di sepanjang alur ini.

### 6.2 Tie-Breaking (Bukan Aging)
Jika dua pesanan atau lebih memiliki nilai EWP yang **sama persis**, sistem menggunakan **waktu kedatangan (`created_at`)** sebagai penyeimbang keadilan — pesanan yang datang lebih dulu diprioritaskan. Tidak ada mekanisme penurunan skor prioritas secara berkala (aging).

### 6.3 Alur Admin
- Mengelola data produk (tambah, ubah, hapus, perbarui stok) dan data pengguna (kasir, pembeli).
- Melihat dan mengunduh laporan penjualan (visualisasi grafik bulanan + produk terlaris).

---

## 7. Kebutuhan Fungsional

Notasi ID mengikuti dokumen skripsi: `F-[NO]`.

| Kode | Deskripsi | Aktor |
|---|---|---|
| **F-01** | Registrasi akun untuk pembeli; login untuk seluruh pengguna (pembeli, kasir, admin) dengan validasi username & password | Pembeli, Kasir, Admin |
| **F-02** | Katalog produk lengkap dengan harga satuan dan ketersediaan stok real-time | Pembeli |
| **F-03** | Pemesanan digital melalui browser di perangkat mobile tanpa harus datang ke toko | Pembeli |
| **F-04** | Perhitungan estimasi total harga pesanan otomatis | Sistem (Otomatis) |
| **F-05** | Perhitungan **EWP** setiap pesanan secara otomatis: EWP = Σ(Qᵢ × Wᵢ) | Sistem (Otomatis) |
| **F-06** | Pengelolaan antrian pesanan menggunakan **Min-Heap** — pesanan EWP terkecil selalu di posisi teratas | Sistem (Otomatis) |
| **F-07** | Distribusi pesanan otomatis ke pegawai idle berdasarkan urutan prioritas Min-Heap (Single Queue Multiple Server, 4 pegawai) | Sistem (Otomatis) |
| **F-08** | Dasbor antrian real-time untuk kasir: urutan prioritas, nilai EWP, status idle/sibuk pegawai | Kasir |
| **F-09** | Pencetakan struk pesanan (item, jumlah, estimasi harga, nama pegawai bertugas) | Kasir |
| **F-10** | Konfirmasi pembayaran (tunai/online); status pesanan → selesai, stok diperbarui, pegawai kembali idle | Kasir |
| **F-11** | Pengelolaan data produk penuh: tambah, ubah (nama/harga/kategori), hapus, perbarui stok | Admin |
| **F-12** | Pengelolaan data pengguna: tambah akun kasir, ubah data pengguna, nonaktifkan/hapus akun pembeli | Admin |
| **F-13** | Lihat & unduh laporan penjualan (visualisasi grafik bulanan, produk terlaris) | Admin |
| **F-14** | Pembaruan stok otomatis saat pesanan dikonfirmasi selesai oleh kasir | Sistem (Otomatis) |

**Kebutuhan fungsional inti (kontribusi utama penelitian):** F-05, F-06, F-07 — memastikan EWP dihitung deterministik dari data observasi lapangan, antrian dikelola dengan Min-Heap O(log n), dan distribusi ke empat pegawai berjalan otomatis tanpa intervensi manual kasir.

---

## 8. Desain Algoritma Priority Queue (Inti Akademik)

### 8.1 Pendekatan
Penelitian ini **tidak mengimplementasikan SJF klasik secara langsung** (yang biasanya memakai *exponential averaging* untuk estimasi *burst time* pada beban kerja berulang). Karena karakteristik pesanan grosir heterogen dan tidak berulang, EWP dihitung **deterministik** berdasarkan data observasi lapangan.

### 8.2 Model Estimasi Waktu Proses (EWP)

$$EWP = \sum_{i=1}^{n} (Q_i \times W_i)$$

| Simbol | Keterangan |
|---|---|
| `EWP` | Estimasi Waktu Proses total pesanan (dalam detik) |
| `n` | Jumlah jenis barang berbeda dalam satu pesanan |
| `Qᵢ` | Kuantitas dari jenis barang ke-i |
| `Wᵢ` | Waktu pengambilan spesifik jenis barang ke-i, hasil observasi langsung di Grosir Jasa (dalam detik) |

`Wᵢ` **bersifat tetap/konstan** selama sistem berjalan (nilai hasil observasi lapangan, bukan parameter yang dikonfigurasi admin melalui UI).

### 8.3 Struktur Data: Min-Heap
Priority Queue diimplementasikan sebagai **binary min-heap** (representasi array) di lapisan aplikasi:

| Operasi | Kompleksitas | Keterangan |
|---|---|---|
| `insert` (heapify-up) | O(log n) | Tambah elemen baru ke posisi terakhir, lalu *bubble up* |
| `extract-min` (heapify-down) | O(log n) | Ambil elemen akar (EWP terkecil), lalu *trickle down* |
| `peek` | O(1) | Lihat elemen prioritas tertinggi tanpa menghapus |

Kunci prioritas = nilai `EWP`. Nilai terkecil keluar (didistribusikan) lebih dulu.

### 8.4 Tie-Breaking (Bukan Anti-Starvation/Aging)
Jika dua pesanan memiliki `EWP` yang identik, `created_at` (waktu kedatangan) menjadi faktor penyeimbang: pesanan yang datang lebih dulu diproses lebih dulu. **Tidak ada** mekanisme penurunan skor prioritas seiring waktu tunggu (aging).

### 8.5 Distribusi: Single Queue Multiple Server (SQMS)
Satu antrian terpusat (Min-Heap) melayani **empat pegawai** sebagai *server*. Begitu ada pegawai berstatus idle, sistem mengambil elemen akar heap (EWP terkecil) dan menugaskannya ke pegawai tersebut secara otomatis — tanpa intervensi manual kasir.

---

## 9. Model Data (Supabase / PostgreSQL)

Skema mengikuti implementasi produksi aktual — **8 tabel inti** (kolom audit `created_at`/`updated_at` diasumsikan ada kecuali disebutkan lain):

### `profiles`
| Kolom | Tipe | Keterangan |
|---|---|---|
| id (PK) | uuid | referensi `auth.users` |
| full_name | text | |
| role | enum | `pembeli` \| `kasir` \| `admin` |
| is_active | bool | |

### `categories`
| Kolom | Tipe | Keterangan |
|---|---|---|
| id (PK) | uuid | |
| name | text | |

### `products`
| Kolom | Tipe | Keterangan |
|---|---|---|
| id (PK) | uuid | |
| category_id (FK) | uuid | → categories |
| name | text | |
| price | numeric | harga grosir |
| stock_qty | int | |
| image_url | text | Supabase Storage |

### `product_units`
| Kolom | Tipe | Keterangan |
|---|---|---|
| id (PK) | uuid | |
| product_id (FK) | uuid | → products |
| unit_name | text | variasi satuan penjualan (mis. karung, bungkus) |
| pickup_time_seconds | numeric | Wᵢ — waktu pengambilan spesifik per jenis barang (konstan, hasil observasi) |

### `orders`
| Kolom | Tipe | Keterangan |
|---|---|---|
| id (PK) | uuid | |
| customer_id (FK) | uuid | → profiles |
| staff_id (FK, nullable) | uuid | → staff yang ditugaskan |
| status | enum | `antri` \| `diproses` \| `selesai` \| `batal` |
| total_amount | numeric | |
| ewp | numeric | kunci prioritas Min-Heap (detik) |
| payment_method | enum | `tunai` \| `online` |
| created_at | timestamptz | waktu kedatangan — dipakai sebagai tie-breaker |
| completed_at | timestamptz | selesai |

### `order_items`
| Kolom | Tipe | Keterangan |
|---|---|---|
| id (PK) | uuid | |
| order_id (FK) | uuid | |
| product_id (FK) | uuid | |
| qty | int | Qᵢ |
| unit_price | numeric | harga saat order |

### `staff`
| Kolom | Tipe | Keterangan |
|---|---|---|
| id (PK) | uuid | |
| name | text | nama pegawai (bukan akun login) |
| status | enum | `idle` \| `sibuk` |

### `notifications`
| Kolom | Tipe | Keterangan |
|---|---|---|
| id (PK) | uuid | |
| user_id (FK) | uuid | → profiles |
| order_id (FK, nullable) | uuid | → orders |
| message | text | |
| is_read | bool | |

> Tidak ada tabel `inventory` terpisah (stok melekat pada `products`), tidak ada `payments` (metode & status pembayaran melekat pada `orders`), tidak ada `stock_movements`, `queue_logs`, atau `system_settings` — laporan penjualan dihasilkan secara dinamis dari `orders`/`order_items`, bukan disimpan sebagai tabel tersendiri.

---

## 10. Arsitektur Sistem & Teknologi

| Lapisan | Teknologi | Peran |
|---|---|---|
| Frontend | Next.js 15+ (App Router), TypeScript, Tailwind CSS, shadcn/ui | UI seluruh peran, responsif (mobile untuk pembeli; tablet/desktop untuk kasir & admin) |
| Logika Server | Next.js Route Handlers / Server Actions | Validasi, perhitungan EWP, modul Min-Heap |
| Basis Data | Supabase PostgreSQL | Persistensi data |
| Auth | Supabase Auth | Login, sesi, RBAC (pembeli/kasir/admin) |
| Realtime | Supabase Realtime | Dasbor antrian & status pesanan/pegawai live (latensi < 1 detik) |
| Storage | Supabase Storage | Foto produk |
| State Management | React Context / Zustand | Manajemen state aplikasi sisi klien |
| Library Pendukung | Tabler Icons, TanStack Table | Ikon antarmuka, manajemen tabel data |

**Catatan implementasi Min-Heap:** heap dipelihara sebagai modul layanan di sisi server; Postgres tetap menjadi sumber kebenaran (`orders.ewp` + `orders.created_at`), heap dibangun ulang dari pesanan berstatus `antri` saat diperlukan.

---

## 11. Kebutuhan Non-Fungsional (NFR)

| ID | Aspek | Kebutuhan |
|---|---|---|
| **NF-01** | Keamanan (Security) | Autentikasi terenkripsi (Supabase Auth) + Role-Based Access Control (RBAC) membatasi akses antara pembeli, kasir, dan admin |
| **NF-02** | Performa (Performance) | Pembaruan status antrian real-time dengan latensi < 1 detik (Supabase Realtime) |
| **NF-03** | Usabilitas (Usability) | UI responsif di berbagai ukuran layar (mobile, tablet, desktop) via Tailwind CSS + shadcn/ui |
| **NF-04** | Keandalan (Reliability) | Mekanisme fallback & pencatatan error agar transaksi tidak hilang saat gangguan jaringan |

---

## 12. Keamanan & RBAC (Ringkasan Kebijakan)

| Peran | Kebijakan akses |
|---|---|
| Pembeli | Baca katalog publik & stok; buat & pantau pesanan miliknya sendiri |
| Kasir | Baca dasbor antrian (semua pesanan aktif); cetak struk; konfirmasi pembayaran |
| Admin | Akses penuh: produk, stok, pengguna, laporan penjualan |

---

## 13. Rencana Pengembangan (Roadmap Bertahap)

| Fase | Fokus | Output |
|---|---|---|
| **Fase 0** | Setup proyek | Next.js + shadcn + Supabase, skema DB (8 tabel), Auth & RBAC dasar |
| **Fase 1** | Katalog & stok | CRUD produk (admin), katalog & stok real-time (pembeli) |
| **Fase 2** | Self-order & EWP | Keranjang, pembuatan pesanan, perhitungan estimasi harga & EWP |
| **Fase 3** | Priority Queue & distribusi | Min-Heap, insert/extract-min, tie-breaking waktu kedatangan, distribusi otomatis ke pegawai idle (SQMS) |
| **Fase 4** | Kasir | Dasbor antrian real-time, cetak struk, konfirmasi pembayaran |
| **Fase 5** | Laporan | Dashboard admin, visualisasi laporan bulanan & produk terlaris |
| **Fase 6** | Pengujian & polish | Black Box Testing seluruh fitur, verifikasi manual algoritma Min-Heap/EWP, perbaikan UX |

---

## 14. Rencana Pengujian (Pendukung Skripsi)

1. **Black Box Testing** — definisikan skenario uji berdasarkan F-01–F-14, verifikasi keluaran sistem sesuai spesifikasi tanpa memeriksa struktur kode internal.
2. **Verifikasi manual algoritma Min-Heap** — telusuri langkah insert (heapify-up) dan extract-min (heapify-down) pada beberapa kasus pesanan untuk membuktikan urutan prioritas benar.
3. **Verifikasi manual EWP** — bandingkan hasil perhitungan sistem `Σ(Qᵢ × Wᵢ)` dengan perhitungan manual untuk beberapa kombinasi item.
4. **Uji tie-breaking** — pastikan dua pesanan dengan EWP identik diurutkan sesuai `created_at`.
5. **Uji distribusi SQMS** — pastikan pesanan hanya ditugaskan ke pegawai berstatus idle, dan status berubah idle↔sibuk dengan benar di setiap siklus.

---

## 15. Risiko & Mitigasi

| Risiko | Dampak | Mitigasi |
|---|---|---|
| Nilai `Wᵢ` (waktu pengambilan per jenis barang) tidak representatif | Urutan prioritas kurang akurat | Nilai diambil dari observasi langsung dan berulang di Grosir Jasa sebelum sistem berjalan |
| Konsistensi heap vs DB | Urutan tidak sinkron | Postgres sebagai sumber kebenaran (`orders.ewp`); heap dibangun ulang dari `orders` berstatus `antri` |
| Semua pegawai sibuk bersamaan | Pesanan menunggu di Min-Heap | Sesuai desain SQMS — pesanan tetap berada di heap dan diproses begitu ada pegawai idle |
| Lonjakan pesanan bersamaan | Kinerja menurun | Operasi Min-Heap O(log n) |
| EWP identik pada banyak pesanan | Ambiguitas urutan | Tie-breaking berbasis `created_at` |

---

## 16. Asumsi & Batasan (Sesuai BAB I Skripsi)

**Asumsi:**
- Toko memiliki tepat **empat pegawai** yang berperan sebagai *server* dalam model SQMS.
- Waktu pengambilan per jenis barang (`Wᵢ`) bersifat tetap/konstan hasil observasi lapangan, tidak dikonfigurasi ulang oleh admin melalui aplikasi.
- Pembeli sudah terdaftar (registrasi) untuk dapat self-order.
- Pembeli mengambil barang sendiri ke toko — tidak ada fitur pengiriman.

**Batasan Masalah:**
1. Sistem hanya diperuntukkan bagi Grosir Jasa di Aceh Timur sebagai objek penelitian.
2. Priority Queue menggunakan Min-Heap dengan dua kriteria: EWP dan waktu kedatangan (tie-breaker) — bukan mekanisme aging kontinu.
3. Pembayaran mendukung tunai dan online saja, tanpa fitur pengiriman.
4. Tiga level pengguna: pembeli, kasir, admin. Pegawai tidak memiliki hak akses ke sistem.
5. Pengujian menggunakan Black Box Testing, tanpa studi simulasi komparatif FIFO vs Priority Queue.

---

*Dokumen ini bersifat hidup dan akan diperbarui seiring keputusan desain dan temuan pengujian. Direvisi agar konsisten dengan isi PROPOSALKU.docx.*