# Product Requirements Document (PRD)
## Rancang Bangun Sistem Point of Sale Grosir dengan Penerapan Priority Queue pada Antrian Pesanan
**Studi Kasus: Grosir Jasa**

| | |
|---|---|
| **Versi** | 2.0 (Sistem Baru) |
| **Tanggal** | Juli 2026 |
| **Penyusun** | Zuyyin Zafirah (NIM: 2022573010058) |
| **Stack** | Next.js 15+ (App Router) + TypeScript + Tailwind CSS + Supabase (PostgreSQL, Auth, Realtime) |
| **Algoritma Inti** | Priority Queue berbasis Min-Heap dengan pendekatan Shortest Job First (SJF) |

---

## 1. Ringkasan Eksekutif

Sistem Point of Sale (POS) Grosir Jasa di Aceh Timur dirancang untuk menggantikan pengelolaan pemesanan manual yang tidak efisien menjadi sistem digital berbasis web yang terstruktur. Usaha grosir ini melayani volume pesanan yang besar dengan karakteristik belanja yang bervariasi. Jika pesanan diproses menggunakan aturan First-In First-Out (FIFO) konvensional, pesanan kecil dengan jumlah item sedikit akan terhambat di belakang pesanan besar, sehingga meningkatkan rata-rata waktu tunggu pelanggan secara keseluruhan.

Sistem ini menerapkan **Priority Queue** menggunakan struktur data **Min-Heap** dengan pendekatan **Shortest Job First (SJF)**. Setiap pesanan baru yang masuk akan dihitung nilai **Estimasi Waktu Proses (EWP)** berdasarkan kuantitas barang dikali waktu pengambilan rata-rata hasil observasi. Pesanan dengan EWP terkecil diprioritaskan di bagian atas antrian. Melalui dashboard kasir, tugas prioritas teratas didelegasikan (baik secara otomatis via aplikasi dengan opsi auto-assign maupun secara manual oleh kasir) kepada pegawai yang sedang dalam kondisi tersedia (*idle*) menggunakan model **Single Queue Multiple Server**.

---

## 2. Latar Belakang & Pernyataan Masalah

Grosir Jasa mengoperasikan usahanya dengan alur manual: pembeli datang, mencatat daftar belanja di kertas, menyerahkannya ke salah satu dari empat pegawai, lalu pegawai mengambil barang secara fisik dan kasir memproses pembayaran tunai. Hal ini menimbulkan beberapa kendala utama:
1. **Ketidakadilan dan Inefisiensi Antrian**: Pesanan dengan jumlah item sedikit harus menunggu pegawai menyelesaikan pesanan berukuran sangat besar. Hal ini meningkatkan waktu tunggu rata-rata.
2. **Distribusi Beban Kerja Pegawai yang Tidak Merata**: Tanpa adanya sistem pembagian tugas formal, beban kerja pegawai tidak merata dan bergantung pada pilihan subjektif pembeli atau pegawai itu sendiri.
3. **Ketiadaan Informasi Real-Time**: Pembeli tidak dapat memantau status pengerjaan pesanan secara langsung dan tidak dapat mengecek stok barang sebelum berkunjung ke toko.
4. **Keterbatasan Metode Pembayaran**: Transaksi pembayaran terbatas pada uang tunai di kasir tanpa adanya pencatatan pembayaran online.

---

## 3. Tujuan & Metrik Keberhasilan

### 3.1 Tujuan Produk
1. Membangun aplikasi POS grosir berbasis web yang mencakup modul Pemesanan Pembeli, Dasbor Antrian Kasir, Manajemen Inventori, dan Laporan Penjualan Admin.
2. Mengotomatisasi pengurutan antrian menggunakan Min-Heap Priority Queue berdasarkan estimasi waktu proses (EWP).
3. Mendistribusikan pesanan ke 4 pegawai berdasarkan status ketersediaan (*idle/sibuk*) baik secara otomatis via dashboard maupun secara manual.
4. Menyediakan antarmuka status pesanan secara real-time untuk pembeli dan kasir menggunakan Supabase Realtime.

### 3.2 Metrik Keberhasilan
- **Fungsionalitas**: Tingkat keberhasilan pengujian fungsionalitas utama menggunakan Black Box Testing mencapai 100%.
- **Kebenaran Algoritma**: Hasil pengurutan Min-Heap dan ekstraksi prioritas 100% konsisten dengan perhitungan manual.
- **Tie-Breaking**: Keadilan antrian terjamin, di mana pesanan dengan EWP sama otomatis diurutkan berdasarkan waktu kedatangan (`created_at` paling awal).
- **Sinkronisasi Real-Time**: Status pesanan dan antrian diperbarui di dasbor dalam waktu < 1 detik setelah perubahan status.

---

## 4. Lingkup (Scope)

### 4.1 Fitur Utama (In-Scope)
- **Modul Pembeli**:
  - Registrasi dan login akun pembeli.
  - Katalog produk dengan harga grosir dan informasi stok real-time.
  - Keranjang belanja dan pembuatan pesanan digital via perangkat mobile.
  - Pelacakan status pesanan real-time (`antri` -> `diproses` -> `selesai`).
- **Modul Kasir**:
  - Dasbor antrian Priority Queue terurut EWP real-time.
  - Informasi status ketersediaan 4 pegawai (`idle` / `sibuk`).
  - Pembuatan transaksi penjualan langsung di toko (POS Walk-in).
  - Pencarian, penyaringan, paginasi, dan pencetakan ulang struk dari riwayat transaksi.
  - Pencetakan struk transaksi untuk pegawai.
  - Konfirmasi pembayaran tunai maupun online.
- **Modul Admin**:
  - CRUD produk, kategori, satuan barang (unit), dan stok barang.
  - Manajemen data pengguna (customer, cashier, admin) dan ketersediaan pegawai (staff).
  - Pengaturan bobot waktu proses produk (`time_weight` per item dan satuan multi-unit) untuk keperluan kalkulasi EWP antrian.
  - Visualisasi laporan penjualan bulanan dan produk terlaris dalam bentuk grafik.
- **Logika Sistem (Otomatis)**:
  - Perhitungan EWP otomatis saat pesanan dibuat.
  - Operasi insert Min-Heap (heapify-up) dan extract-min (heapify-down) pada tingkat aplikasi.
  - Mekanisme pembagian tugas ke pegawai idle (otomatis via aplikasi/manual via kasir).

### 4.2 Diluar Lingkup (Out-of-Scope)
- Fitur pengiriman barang ke rumah (pembeli mengambil barang sendiri ke toko).
- Integrasi otomatis payment gateway pihak ketiga (kasir mencatat status pembayaran tunai/online secara manual).

---

## 5. Peran Pengguna (User Roles)

| Peran | Deskripsi | Akses Utama |
|---|---|---|
| **Pembeli (Customer)** | Pelanggan Grosir Jasa | Melakukan pendaftaran, melihat katalog produk, membuat pesanan digital, memantau status antrian |
| **Kasir (Cashier)** | Pegawai kasir yang mengelola transaksi | Memantau dasbor antrian prioritas, mencetak struk pesanan, melayani pembelian langsung (POS Walk-in), memproses pembayaran tunai/online, serta melihat riwayat transaksi dan mencetak ulang invoice |
| **Admin** | Pemilik toko atau pengelola penuh | Mengelola stok, produk, kategori, satuan, pegawai (staff), membuat akun pengguna baru, memantau grafik laporan penjualan, riwayat transaksi, serta mengatur bobot waktu proses produk |

---

## 6. Alur Kerja Sistem (System Workflows)

### 6.1 Alur Pembuatan dan Penugasan Pesanan
1. Pembeli menyusun keranjang belanja dan mengirimkan pesanan.
2. Sistem menghitung EWP pesanan dengan rumus:
   $$EWP = \sum_{i=1}^{n} (Q_i \times W_i)$$
3. Pesanan dimasukkan ke dalam Min-Heap pada tingkat aplikasi (frontend), kemudian dijalankan proses **Heapify-Up** berdasarkan nilai EWP untuk menempatkan pesanan pada urutan antrian yang tepat.
4. Melalui dashboard kasir, sistem mendeteksi ketersediaan 4 pegawai pada tabel `staff` (status `idle` / `sibuk`).
   - Jika opsi auto-assign aktif dan ada pegawai berstatus `idle`, sistem otomatis memanggil fungsi database `assign_order_to_staff` untuk menugaskan pesanan prioritas teratas (akar Min-Heap) ke pegawai tersebut. Kasir juga dapat menugaskannya secara manual.
   - Pegawai yang ditugaskan akan berubah statusnya menjadi `sibuk`.
   - Sistem secara otomatis membuka dialog struk transaksi agar kasir dapat mencetaknya langsung.
   - Dasbor antrian kasir dan pelacakan status pesanan pembeli diperbarui secara real-time.
   - Jika semua pegawai sibuk, pesanan tetap mengantri di dalam Min-Heap.

### 6.2 Alur Pemrosesan di Toko dan Pembayaran
1. Kasir mencetak struk pesanan yang ditugaskan dan menyerahkannya kepada pegawai.
2. Pegawai mengambil barang secara fisik di rak berdasarkan struk tersebut dan mengemasnya.
3. Setelah pengemasan selesai, kasir menandai selesai mengemas (memanggil fungsi database `complete_packing`):
   - Kolom `packed_at` pada pesanan terisi timestamp saat itu (status pesanan di mata pembeli menjadi siap diambil).
   - Status pegawai kembali diubah menjadi `idle` agar dapat menerima pesanan baru.
4. Pembeli melakukan pembayaran ke kasir (metode `tunai` atau `online`).
5. Kasir mengonfirmasi pembayaran selesai (memanggil fungsi database `finalize_order_payment`):
    - Status pesanan berubah menjadi `selesai`.
    - Informasi pembayaran (metode `'tunai'` / `'online'` dan waktu selesai `'completed_at'`) diperbarui langsung pada baris pesanan di tabel `orders`.
    - *(Catatan: Pemotongan stok produk dan pencatatan mutasi stok jenis 'sale' terjadi secara otomatis di database saat pembeli membuat pesanan / checkout).*

---

## 7. Kebutuhan Fungsional (Functional Requirements)

| Kode | Kebutuhan Fungsional | Aktor |
|---|---|---|
| **F-01** | Registrasi akun pembeli dan login multi-role (customer, cashier, admin) | Pembeli, Kasir, Admin |
| **F-02** | Tampilan katalog produk dengan informasi stok dan harga real-time | Pembeli |
| **F-03** | Pembuatan pesanan digital melalui perangkat mobile | Pembeli |
| **F-04** | Perhitungan total harga belanja secara otomatis | Sistem (Otomatis) |
| **F-05** | Perhitungan nilai Estimasi Waktu Proses (EWP) pesanan | Sistem (Otomatis) |
| **F-06** | Pengelolaan antrian pesanan terurut dengan struktur Min-Heap | Sistem (Otomatis) |
| **F-07** | Mekanisme penugasan (otomatis via dashboard kasir/manual) ke pegawai idle | Sistem (Otomatis) |
| **F-08** | Monitoring dasbor antrian prioritas secara real-time | Kasir |
| **F-09** | Pencetakan struk transaksi berdasarkan nomor prioritas teratas atau cetak ulang dari riwayat | Kasir, Admin |
| **F-10** | Konfirmasi pembayaran, selesai pengemasan (membebaskan status pegawai), dan status pesanan | Kasir |
| **F-11** | CRUD produk, kategori, satuan barang (unit), dan stok barang | Admin |
| **F-12** | CRUD data pengguna (customer, cashier, admin) dan ketersediaan pegawai (staff) | Admin |
| **F-13** | Visualisasi grafik laporan penjualan bulanan dan produk terlaris | Admin |
| **F-14** | Pembaruan stok produk otomatis saat pesanan dibuat (checkout) | Sistem (Otomatis) |
| **F-15** | Pembuatan transaksi pembelian langsung di toko (POS Walk-in) | Kasir, Admin |
| **F-16** | Pencarian, pemfilteran (status/pembayaran/tanggal), dan paginasi riwayat transaksi | Kasir, Admin |
| **F-17** | Pengaturan bobot waktu proses (time_weight) per produk/satuan multi-unit | Admin |

---

## 8. Kebutuhan Non-Fungsional (Non-Functional Requirements)

| Kode | Aspek | Deskripsi Kebutuhan |
|---|---|---|
| **NF-01** | Keamanan (*Security*) | Autentikasi aman menggunakan Supabase Auth dan pembatasan data via Role-Based Access Control (RBAC) / Row Level Security (RLS). |
| **NF-02** | Performa (*Performance*) | Latensi pembaruan dasbor antrian < 1 detik dengan Supabase Realtime subscription. |
| **NF-03** | Usabilitas (*Usability*) | Antarmuka web responsif untuk perangkat mobile (pembeli) maupun layar monitor/tablet (kasir/admin) menggunakan Tailwind CSS. |
| **NF-04** | Keandalan (*Reliability*) | Sinkronisasi data real-time yang menjamin tidak ada pesanan yang hilang atau terlewat dari antrian database Postgres. |

---

## 9. Desain Algoritma Priority Queue Min-Heap

### 9.1 Rumus Perhitungan EWP (Shortest Job First)
Estimasi Waktu Proses (EWP) total dihitung berdasarkan kuantitas masing-masing item pesanan dikalikan waktu pengambilan rata-rata per item hasil observasi lapangan:
$$EWP = \sum_{i=1}^{n} (Q_i \times W_i)$$

*Contoh Parameter Waktu Ambil ($W_i$):*
- Produk Jajanan (Snack/Permen): 5 detik/unit.
- Kebutuhan Dapur (Minyak/Tepung): 15 detik/unit.
- Produk Rokok/Sembako Berat (Beras/Karton): 30 detik/unit.

### 9.2 Logika Heapify-Up (INSERT)
Ketika pesanan baru masuk dengan nilai $EWP_{baru}$, pesanan disisipkan di indeks terakhir array Min-Heap. Proses Heapify-Up membandingkan pesanan tersebut dengan elemen induknya (`parent` di indeks $\lfloor (i-1)/2 \rfloor$). Jika EWP pesanan baru lebih kecil, maka posisinya ditukar dengan induknya. Proses ini berulang hingga properti Min-Heap terpenuhi atau pesanan berada di akar (indeks 0).

### 9.3 Logika Heapify-Down (EXTRACT-MIN)
Ketika ada pegawai idle, pesanan di akar (indeks 0) diambil. Elemen pada indeks terakhir array dipindahkan ke akar. Proses Heapify-Down membandingkan elemen akar baru ini dengan kedua anaknya (`left` di indeks $2i+1$, `right` di indeks $2i+2$). Akar ditukar dengan anak yang memiliki EWP terkecil jika EWP akar lebih besar dari anak terkecil tersebut. Proses ini diulangi hingga properti Min-Heap terpenuhi kembali.

### 9.4 Tie-Breaking (Keadilan Antrian)
Jika dua pesanan memiliki EWP yang sama, kunci pembanding kedua adalah waktu pembuatan pesanan (`created_at`). Pesanan yang memiliki timestamp lebih awal (datang lebih dulu) akan ditempatkan di atas pesanan yang datang belakangan, sehingga asas keadilan (first-come first-served) tetap terjaga untuk pesanan dengan kompleksitas setara.
