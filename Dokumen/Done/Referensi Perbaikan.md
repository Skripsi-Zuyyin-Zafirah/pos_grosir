Fitur Pengaturan di hapus
Di tabel Daftar Produk, hapus kolom "Berat" dan tambahkan kolom "Stok"
Tambahkan pagination di bawah tabel Daftar Produk
Tambahkan Dropdown Filter Kategori di sebelah Search Bar.
Tambahkan tombol "Update Stok" di kolom Aksi. Update Stok: (Tombol khusus). Ketika diklik, muncul modal kecil/quick-edit yang hanya meminta input "Jumlah Stok Baru" atau "Tambah/Kurangi Stok".
Gabungkan menu "Kelola Produk" dan "Kelola Stok" menjadi satu menjadi "Kelola Produk dan Stok"
Jadi di SKU buat fitur Generate
Di satuan buat select option
Tambahkan Stok di Modal Tambah Produk Baru dan buat select option
Di Modal Tambah Produk Baru tambahkan untuk foto produk itu bisa menggunakan kamera yang berfungsi ketika kita mengakses web di hp maka kameranya bisa berfungsi begitu juga kalau kita buka di laptop ataupun tablet kameranya bisa berfungsi. Supaya di Foto Produk itu bisa menggunakan kamera secara langsung di hp ketika menginput foto produk itu tersebut
Untuk Produk Multi-Unit (Indomie):
┌─────────────────────────────────┐
│ [Gambar Produk]                 │
│                                  │
│ Kategori: Makanan               │
│ PRD-458414                      │
│ **Indomie**                     │
│                                  │
│ Pilih Kemasan Grosir:            │
│ [Pack (Rp 24.000) ▼]            │
│                                  │
│ Rp 24.000 / Pack                │
│ Stok: 2 Pack (10 pcs) ⚠️        │
│                                  │
│ [+ - 1 -+]                      │
│ [🛒 Tambah ke Keranjang]        │
└─────────────────────────────────┘
Untuk Produk Single-Unit (Air Clean):
┌─────────────────────────────────┐
│ [Gambar Produk]                 │
│                                  │
│ Kategori: Minuman               │
│ PRD-366621                      │
│ **Air Clean**                   │
│                                  │
│ Rp 17.000 / dus                 │
│ Stok: 15 dus ✅                 │
│                                  │
│ [+ - 1 -+]                      │
│ [🛒 Tambah ke Keranjang]        │
─────────────────────────────────┘
Penanganan Stok Habis di Dropdown
Untuk kasus seperti Dus Indomie yang stoknya 0:
Opsi A: Tampilkan tapi Disabled (RECOMMENDED)
Pilih Kemasan Grosir:
✓ Pcs (Rp 5.000) - Stok: 9
✓ Pack (Rp 24.000) - Stok: 2
✗ Dus (Rp 50.000) - **Habis** (disabled)
Tambahkan checkbox untuk toggle single/multiple unit di modal Tambah Produk Baru / Modal Tambah Produk untuk Multiple/Single Unit
Fitur Kelola Pengguna
Tambahkan tombol "📦 History" di kolom Aksi
Buat tabel stock_mutations di database untuk track history. Otomatis catat setiap perubahan stok (dari pesanan, restok, manual)
Hapus menu "Kelola Stok" dari sidebar Admin
Hapus Evaluasi Antrian di halaman /dashboard/reports
Tambahkan field "Waktu Pengambilan (detik/menit)" di form tambah/edit produk di halaman admin.
Tambah Menu Kelola Waktu Pengambilan
Hybrid. Jadi di form produk ada field "Waktu Pengambilan", tapi bisa di-edit massal di halaman terpisah
Fitur Profil di admin
Tambah filter Hari Ini, Minggu Ini, Bulan Ini di halaman reports.
Tambahkan bentuk visualisasi grafik bulanan dan produk terlaris di halaman Dashboard Admin.
No. Telepon ganti jadi Nomor Telepon
Yang di halaman registrasi yang kembali ke login ganti cukup Sudah memiliki akun? Masuk
Pas saya klik tombol Keluar dia tidak ada konfirmasi dialog
Masuk ke Akun di Landing Page belum berfungsi
Tidak ada toast saat si akun berhasil daftar, dan begitu juga ketika login tidak ada toast, jadi saya mau ke semua fitur itu ada toast
Ubah redirect setelah login customer dari / (home) → /customer/katalog