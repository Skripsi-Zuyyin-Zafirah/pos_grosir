# Planning: Tampilan Dashboard untuk Role Customer

## 📋 Deskripsi & Latar Belakang

Saat ini, halaman Customer (khususnya `/customer/orders`) menggunakan layout sederhana berupa **header sticky + main content** yang terpisah dari layout Dashboard milik Admin/Staff. Tujuan dari perencanaan ini adalah menyesuaikan semua halaman Customer agar memiliki tampilan Dashboard yang konsisten — lengkap dengan **Sidebar navigasi**, **Site Header dengan breadcrumb**, dan **konten utama** — persis seperti yang dimiliki Admin di `/dashboard`.

Selain itu, dokumen ini dilengkapi dengan perencanaan **Alur Belanja (Fitur Inti)** terintegrasi untuk pelanggan agar bisa berbelanja langsung dari dalam area Dashboard Customer.

---

## 🎯 Tujuan

- Semua halaman untuk role **Customer** menggunakan layout Dashboard (Sidebar + SiteHeader + SidebarInset).
- Membuat **Sidebar khusus Customer** (`CustomerSidebar`) dengan navigasi yang relevan untuk pelanggan.
- Membuat **halaman Dashboard Customer** (`/customer`) sebagai halaman utama/beranda pelanggan, menampilkan ringkasan pesanan aktif dan statistik belanja.
- Menambahkan rute navigasi **Alur Belanja**: Katalog Produk (`/customer/shop`), Keranjang Belanja (`/customer/cart`), status pesanan aktif (`/customer/orders`), riwayat transaksi (`/customer/transactions`), dan profil pengguna (`/customer/profile`).
- **Tidak mengubah** sidebar Admin (`app-sidebar.tsx`) maupun halaman Dashboard Admin.

---

## 🗺️ Struktur Route Customer (Setelah Perubahan)

```
/customer                       → Dashboard Customer (halaman utama)
/customer/shop                  → Katalog / Shop — belanja produk & stok real-time (halaman baru)
/customer/cart                  → Keranjang / Cart — kelola item & checkout (halaman baru)
/customer/orders                → Pesanan Saya — status aktif & real-time tracking (diperbarui layout)
/customer/transactions          → Riwayat Transaksi — pesanan selesai & batal (halaman baru)
/customer/profile               → Profil Customer (halaman baru)
```

---

## 🧭 Menu Navigasi Customer Sidebar

| No | Ikon | Label | Route | Keterangan |
|----|------|-------|-------|------------|
| 1 | `IconHome` | Dashboard | `/customer` | Halaman utama & ringkasan belanja |
| 2 | `IconBuildingStore` | Katalog Belanja | `/customer/shop` | Belanja produk & stok real-time |
| 3 | `IconShoppingCart` | Keranjang Saya | `/customer/cart` | Kelola keranjang belanja |
| 4 | `IconPackage` | Pesanan Saya | `/customer/orders` | Pesanan aktif & real-time tracking |
| 5 | `IconReceipt` | Riwayat Transaksi | `/customer/transactions` | Pesanan selesai & dibatalkan |
| 6 | `IconUser` | Profil Saya | `/customer/profile` | Edit data profil pengguna |

---

## 🏗️ Pola Layout yang Digunakan

Mengikuti pola **persis sama** dengan Dashboard Admin:

```tsx
// app/customer/layout.tsx
<SidebarProvider style={{
  "--sidebar-width": "calc(var(--spacing) * 72)",
  "--header-height": "calc(var(--spacing) * 12)"
}}>
  <CustomerSidebar variant="inset" />
  <SidebarInset>
    <CustomerSiteHeader />
    {children}
  </SidebarInset>
</SidebarProvider>
```

Setiap `page.tsx` cukup merender konten:
```tsx
<div className="flex flex-1 flex-col py-6 space-y-6 px-4 lg:px-6">
  {/* konten halaman */}
</div>
```

---

## 🔄 Alur Navigasi Customer

```
Login → (role === "customer") → redirect ke /customer/shop

/customer              → Dashboard (Summary Cards + Tabel Pesanan Terbaru)
/customer/shop         → Katalog Belanja (Pilih Produk + Stok Real-Time + Tambah ke Keranjang)
/customer/cart         → Keranjang Saya (Review Item + Edit Qty + Hapus + Checkout Validasi Stok)
/customer/orders       → Pesanan Aktif (waiting/processing/ready + real-time status + cancel)
/customer/transactions → Riwayat Transaksi (done/cancelled + detail modal)
/customer/profile      → Edit Profil

NavUser Footer:
  ├── Profil Saya  → /customer/profile
  └── Keluar       → sign out → redirect ke /login
```

---

## 🛒 Alur Belanja & Fitur Inti (Spesifikasi Teknis)

### 1. Halaman Katalog / Shop (`/customer/shop`)
- **Fungsi Utama**: Menampilkan daftar produk beserta ketersediaan stok real-time.
- **Fitur**:
  - Grid/List kartu produk yang menarik dilengkapi gambar, harga, unit (misal: kg, pack, pcs), dan sisa stok.
  - Pencarian produk instan dan filter berdasarkan kategori.
  - Tombol **"Tambah ke Keranjang"** yang otomatis memvalidasi sisa stok sebelum dimasukkan.
  - Subscription real-time menggunakan Supabase channel untuk melacak perubahan stok di tabel `inventory`/`products` secara langsung saat admin melakukan update atau kasir bertransaksi.

### 2. Halaman Keranjang / Cart (`/customer/cart`)
- **Fungsi Utama**: Tempat menampung, meninjau, mengedit, dan menghapus item sebelum checkout.
- **Fitur**:
  - Daftar tabel/list item keranjang (nama produk, harga satuan, quantity, subtotal).
  - Tombol inkremen/dekremen kuantitas barang dengan validasi real-time agar tidak melebihi stok yang tersedia.
  - Tombol hapus item dari keranjang.
  - Ringkasan kalkulasi otomatis: subtotal, estimasi total berat, dan total harga.
  - Tombol **"Checkout Pesanan"** yang memicu proses pembuatan pesanan.

### 3. Fitur Checkout & Integrasi Sistem
- **Fungsi Utama**: Menyelesaikan belanja dan mengirimkan pesanan ke database utama.
- **Proses Transaksi**:
  - **Validasi Stok Akhir**: Sistem melakukan pengecekan ulang (melalui database lock atau RPC transaction) untuk memastikan stok produk di gudang masih mencukupi tepat sebelum pesanan dibuat.
  - **Kalkulasi Total Otomatis**: Menghitung grand total harga, total unit barang, dan total berat.
  - **Pembuatan Pesanan**: Memasukkan record baru ke tabel `orders` dan `order_items` dengan status default `waiting`.
  - **Memicu Mesin Antrean**: Pembuatan pesanan secara otomatis akan memicu perhitungan estimasi waktu tunggu (EWP) & estimasi waktu proses (ECT) yang disinkronkan ke dalam antrian berbasis algoritma **Min-Heap (SJF dengan aging)** untuk diproses oleh staff gudang di `/dashboard/picking`.
  - **Pembersihan Keranjang**: Mengosongkan keranjang setelah checkout berhasil dan mengarahkan pelanggan ke halaman `/customer/orders` untuk pelacakan real-time.

### 4. Fitur Pembatalan Pesanan
- **Fungsi Utama**: Tombol untuk membatalkan pesanan oleh customer (berlaku hanya jika status pesanan masih waiting/antri).
- **Fitur**:
  - Tombol "Batalkan Pesanan" hanya ditampilkan pada kartu pesanan dengan status `waiting` (antri) di halaman `/customer/orders` dan di dalam modal detail.
  - Memanggil RPC `cancel_order_transaction` di database Supabase untuk membatalkan pesanan secara aman dan mengembalikan stok barang yang dipesan.
  - Mengubah status pesanan menjadi `cancelled` dan memperbarui antrean gudang secara real-time.

---

## 🚀 Milestones

---

### 🏁 Milestone 1 — Fondasi Layout & Komponen Dasar
**Tujuan**: Membangun kerangka layout Dashboard Customer yang akan dipakai oleh semua halaman.

- [x] Buat `components/customer-sidebar.tsx`
- [x] Buat `components/customer-site-header.tsx`
- [x] Buat `app/customer/layout.tsx`
- [x] Verifikasi layout tampil benar (TypeScript: 0 error, dev server: ready ✅)

---

### 🏁 Milestone 2 — Halaman Dashboard Customer
**Tujuan**: Membuat halaman beranda Customer (`/customer`) yang informatif dengan statistik pesanan.

- [x] Buat `app/customer/page.tsx`
- [x] Fetch data summary cards dari Supabase (filter `user_id`)
- [x] Fetch 5 pesanan terbaru
- [x] Tampilkan loading state (spinner)
- [x] Verifikasi data hanya milik user yang login

---

### 🏁 Milestone 3 — Halaman Pesanan Saya (Refactor Layout)
**Tujuan**: Memindahkan `orders/page.tsx` dari layout lama ke dalam layout Dashboard baru.

- [x] Hapus layout lama dari `orders/page.tsx`
- [x] Sesuaikan wrapper dan padding konten ke standar Dashboard
- [x] Pastikan real-time subscription Supabase tetap berjalan
- [x] Pastikan modal detail dan tombol batal masih berfungsi

---

### 🏁 Milestone 4 — Halaman Riwayat Transaksi
**Tujuan**: Membuat halaman baru `/customer/transactions` untuk menampilkan pesanan yang sudah selesai atau dibatalkan.

- [x] Buat `app/customer/transactions/page.tsx`
- [x] Fetch data riwayat dari Supabase (filter user_id + status done/cancelled)
- [x] Implementasi filter tab (Semua / Selesai / Dibatalkan)
- [x] Buat modal detail transaksi
- [x] Tambahkan empty state
- [x] Verifikasi data hanya milik user yang login

---

### 🏁 Milestone 5 — Halaman Profil Customer
**Tujuan**: Membuat halaman profil Customer yang bisa mengedit data dirinya.

- [x] Buat `app/customer/profile/page.tsx`
- [x] Fetch data profil dari Supabase (`profiles` WHERE `id = session.user.id`)
- [x] Implementasi form edit dengan validasi
- [x] Handle submit update profil ke Supabase
- [x] Toast sukses/error
- [x] Verifikasi perubahan nama muncul di sidebar NavUser

---

### 🏁 Milestone 6 — Testing & Polish
**Tujuan**: Memastikan semua halaman berjalan dengan baik, responsif, dan konsisten secara visual.

- [x] Test navigasi antar halaman Customer (sidebar link aktif highlight)
- [x] Test responsivitas mobile (sidebar collapsible offcanvas)
- [x] Test proteksi route: user non-customer tidak bisa akses `/customer/*`
- [x] Test real-time update di `/customer/orders`
- [x] Test logout dari NavUser Customer → redirect ke `/login`
- [x] Pastikan breadcrumb tampil benar di setiap halaman
- [x] Cek konsistensi warna, spacing, dan tipografi antar halaman

---

### 🏁 Milestone 7 — Halaman Katalog (`/customer/shop`) & Keranjang (`/customer/cart`)
**Tujuan**: Membangun halaman katalog belanja interaktif dan tempat penampungan item (keranjang belanja).

- [x] Buat rute baru `app/customer/shop/page.tsx` (Katalog)
- [x] Tampilkan produk dengan stok real-time (Supabase postgres realtime channel)
- [x] Buat rute baru `app/customer/cart/page.tsx` (Keranjang)
- [x] Implementasikan penyimpanan keranjang belanja (lokal via `localStorage` atau tabel database state)
- [x] Tambahkan fitur tambah barang, ubah kuantitas, validasi batas stok, dan hapus item

---

### ✅ Milestone 8 — Fitur Checkout & Integrasi Antrean
**Tujuan**: Menyambungkan keranjang belanja dengan sistem antrean inti POS (memicu Min-Heap & EWP).

- [x] Implementasikan transaksi aman di `/customer/cart` (validasi sisa stok gudang sebelum input database)
- [x] Buat trigger/proses insert ke tabel `orders` dan `order_items` dengan data dari keranjang
- [x] Pastikan checkout memicu kalkulasi EWP (Estimated Waiting Time) & pendaftaran antrean
- [x] Kosongkan keranjang belanja setelah checkout sukses dan redirect ke `/customer/orders`
- [x] Lakukan testing transaksi end-to-end dari Katalog -> Keranjang -> Checkout -> Terpantau di Dashboard Staff

---

## ⚠️ Catatan Penting

1. **Tidak ada perubahan** pada halaman Admin (`/dashboard/*`) dan `app-sidebar.tsx`.
2. **`app/customer/layout.tsx`** perlu `"use client"` karena `SidebarProvider` butuh client-side state.
3. **Proteksi route**: Setiap halaman Customer harus memverifikasi session dan role = "customer". Jika tidak login atau bukan customer, redirect ke `/login`.
4. **Real-time update** pada `/customer/orders` tetap dipertahankan (Supabase channel subscription).
5. **Responsif**: Sidebar Customer menggunakan `collapsible="offcanvas"` — otomatis mobile-friendly.
6. **NavUser** di Customer Sidebar: link "Profil Saya" diarahkan ke `/customer/profile`, bukan `/dashboard/profile`.
7. **Perbedaan Pesanan vs Transaksi**: `/customer/orders` fokus pada pesanan **aktif** (bisa dibatalkan), `/customer/transactions` fokus pada riwayat **final** (done/cancelled, read-only).
