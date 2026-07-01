# Planning: Tampilan Dashboard untuk Role Customer

## 📋 Deskripsi & Latar Belakang

Saat ini, halaman Customer (khususnya `/customer/orders`) menggunakan layout sederhana berupa **header sticky + main content** yang terpisah dari layout Dashboard milik Admin/Staff. Tujuan dari perencanaan ini adalah menyesuaikan semua halaman Customer agar memiliki tampilan Dashboard yang konsisten — lengkap dengan **Sidebar navigasi**, **Site Header dengan breadcrumb**, dan **konten utama** — persis seperti yang dimiliki Admin di `/dashboard`.

---

## 🎯 Tujuan

- Semua halaman untuk role **Customer** menggunakan layout Dashboard (Sidebar + SiteHeader + SidebarInset).
- Membuat **Sidebar khusus Customer** (`CustomerSidebar`) dengan navigasi yang relevan untuk pelanggan.
- Membuat **halaman Dashboard Customer** (`/customer`) sebagai halaman utama/beranda pelanggan, menampilkan ringkasan pesanan aktif dan statistik belanja.
- Menambahkan route `/customer/orders` (diperbarui layoutnya), `/customer/transactions` (Riwayat Transaksi), dan `/customer/profile`.
- **Tidak mengubah** sidebar Admin (`app-sidebar.tsx`) maupun halaman Dashboard Admin.

---

## 🗺️ Struktur Route Customer (Setelah Perubahan)

```
/customer                       → Dashboard Customer (halaman baru)
/customer/orders                → Pesanan Saya — status real-time (diperbarui layout)
/customer/transactions          → Riwayat Transaksi — pesanan selesai & dibatalkan (halaman baru)
/customer/profile               → Profil Customer (halaman baru)
```

---

## 🧭 Menu Navigasi Customer Sidebar

| No | Ikon | Label | Route | Keterangan |
|----|------|-------|-------|------------|
| 1 | `IconHome` | Dashboard | `/customer` | Halaman utama & ringkasan |
| 2 | `IconPackage` | Pesanan Saya | `/customer/orders` | Pesanan aktif & real-time tracking |
| 3 | `IconReceipt` | Riwayat Transaksi | `/customer/transactions` | Pesanan selesai & dibatalkan |
| 4 | `IconUser` | Profil Saya | `/customer/profile` | Edit data profil pengguna |

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
Login → (role === "customer") → redirect ke /customer

/customer              → Dashboard (Summary Cards + Tabel Pesanan Terbaru)
/customer/orders       → Pesanan Aktif (waiting/processing/ready + cancel)
/customer/transactions → Riwayat Transaksi (done/cancelled + detail modal)
/customer/profile      → Edit Profil

NavUser Footer:
  ├── Profil Saya  → /customer/profile
  └── Keluar       → sign out → redirect ke /login
```

---

## 🚀 Milestones

---

### 🏁 Milestone 1 — Fondasi Layout & Komponen Dasar
**Tujuan**: Membangun kerangka layout Dashboard Customer yang akan dipakai oleh semua halaman.

#### File yang Dibuat:

**`components/customer-sidebar.tsx`** — **[BARU]**
- Sidebar khusus Customer: Logo + navigasi menu (Dashboard, Pesanan, Riwayat Transaksi, Profil) + NavUser footer
- Logo dan brand identik dengan Admin Sidebar
- NavUser footer: link "Profil Saya" → `/customer/profile`, logout → redirect `/login`

**`components/customer-site-header.tsx`** — **[BARU]**
- Header dengan Sidebar Trigger + Breadcrumb
- Mapping rute Customer:
  - `customer` → "Customer Area"
  - `orders` → "Pesanan Saya"
  - `transactions` → "Riwayat Transaksi"
  - `profile` → "Profil Saya"

**`app/customer/layout.tsx`** — **[BARU]**
- Layout wrapper `"use client"` yang membungkus seluruh halaman Customer
- Berisi `SidebarProvider` + `CustomerSidebar` + `SidebarInset` + `CustomerSiteHeader` + `{children}`
- Otomatis berlaku untuk **semua** halaman dalam `/app/customer/`

#### Checklist Milestone 1:
- [ ] Buat `components/customer-sidebar.tsx`
- [ ] Buat `components/customer-site-header.tsx`
- [ ] Buat `app/customer/layout.tsx`
- [ ] Verifikasi layout tampil benar (sidebar muncul, header muncul, breadcrumb berjalan)

---

### 🏁 Milestone 2 — Halaman Dashboard Customer
**Tujuan**: Membuat halaman beranda Customer (`/customer`) yang informatif dengan statistik pesanan.

#### File yang Dibuat:

**`app/customer/page.tsx`** — **[BARU]**

Konten halaman:
- **Judul & sub-judul** halaman
- **4 Summary Cards** (statistik pesanan milik user yang sedang login):

| Kartu | Data | Query |
|-------|------|-------|
| 🛒 Total Pesanan | COUNT semua pesanan | `orders` WHERE `user_id = session.user.id` |
| ⏳ Pesanan Aktif | COUNT status in [waiting, processing, ready] | filter status |
| ✅ Pesanan Selesai | COUNT status = done | filter status = done |
| 💰 Total Pengeluaran | SUM(total_price) status = done | filter status = done |

- **Tabel Pesanan Terbaru** (5 pesanan terbaru, semua status):
  - Kolom: No. Pesanan, Tanggal, Total Harga, Status, Status Bayar
  - Footer card: tombol "Lihat Semua Pesanan" → `/customer/orders`

#### Checklist Milestone 2:
- [ ] Buat `app/customer/page.tsx`
- [ ] Fetch data summary cards dari Supabase (filter `user_id`)
- [ ] Fetch 5 pesanan terbaru
- [ ] Tampilkan loading state (spinner)
- [ ] Verifikasi data hanya milik user yang login

---

### 🏁 Milestone 3 — Halaman Pesanan Saya (Refactor Layout)
**Tujuan**: Memindahkan `orders/page.tsx` dari layout lama ke dalam layout Dashboard baru.

#### File yang Dimodifikasi:

**`app/customer/orders/page.tsx`** — **[DIMODIFIKASI]**

Perubahan yang dilakukan:
- ❌ Hapus wrapper `<div className="min-h-svh bg-muted/30 flex flex-col">`
- ❌ Hapus `<header>` custom (sticky header dengan tombol "Kembali ke Katalog")
- ✅ Ganti `<main>` menjadi `<div className="flex flex-1 flex-col py-6 space-y-6 px-4 lg:px-6">`
- ✅ Semua logika bisnis **tetap sama**: fetch pesanan, real-time subscription, modal detail, batalkan pesanan

Fokus halaman ini: pesanan dengan status **aktif** (waiting, processing, ready) — bisa ditambahkan filter tab.

#### Checklist Milestone 3:
- [ ] Hapus layout lama dari `orders/page.tsx`
- [ ] Sesuaikan wrapper dan padding konten ke standar Dashboard
- [ ] Pastikan real-time subscription Supabase tetap berjalan
- [ ] Pastikan modal detail dan tombol batal masih berfungsi

---

### 🏁 Milestone 4 — Halaman Riwayat Transaksi
**Tujuan**: Membuat halaman baru `/customer/transactions` untuk menampilkan pesanan yang sudah selesai atau dibatalkan.

#### File yang Dibuat:

**`app/customer/transactions/page.tsx`** — **[BARU]**

Konten halaman:
- **Judul & sub-judul**: "Riwayat Transaksi" — daftar semua pesanan yang sudah selesai atau dibatalkan
- **Filter/Tab**: Semua | Selesai | Dibatalkan
- **Tabel / List Pesanan**:
  - Kolom: No. Pesanan, Tanggal, Total Item, Total Harga, Status, Status Bayar
  - Status badge yang relevan: SELESAI (hijau), BATAL (merah)
- **Modal Detail**: Klik baris → tampilkan detail item pesanan (tabel produk + qty + subtotal + grand total)
- **Empty state**: tampilkan pesan jika belum ada riwayat transaksi

Data source: `orders` JOIN `order_items` JOIN `products`, filter `user_id = session.user.id` AND `status IN ('done', 'cancelled')`

#### Checklist Milestone 4:
- [ ] Buat `app/customer/transactions/page.tsx`
- [ ] Fetch data riwayat dari Supabase (filter user_id + status done/cancelled)
- [ ] Implementasi filter tab (Semua / Selesai / Dibatalkan)
- [ ] Buat modal detail transaksi
- [ ] Tambahkan empty state
- [ ] Verifikasi data hanya milik user yang login

---

### 🏁 Milestone 5 — Halaman Profil Customer
**Tujuan**: Membuat halaman profil Customer yang bisa mengedit data dirinya.

#### File yang Dibuat:

**`app/customer/profile/page.tsx`** — **[BARU]**

Konten halaman:
- **Avatar** pengguna (inisial nama, karena belum ada upload foto)
- **Form Edit Profil**:
  - Nama Lengkap (`full_name`) — bisa diedit
  - Email — read-only (dari auth)
  - Role — read-only, tampil sebagai Badge "Customer"
- **Tombol "Simpan Perubahan"** → update tabel `profiles` di Supabase
- Toast notifikasi sukses/gagal

#### Checklist Milestone 5:
- [ ] Buat `app/customer/profile/page.tsx`
- [ ] Fetch data profil dari Supabase (`profiles` WHERE `id = session.user.id`)
- [ ] Implementasi form edit dengan validasi
- [ ] Handle submit update profil ke Supabase
- [ ] Toast sukses/error
- [ ] Verifikasi perubahan nama muncul di sidebar NavUser

---

### 🏁 Milestone 6 — Testing & Polish
**Tujuan**: Memastikan semua halaman berjalan dengan baik, responsif, dan konsisten secara visual.

#### Checklist Milestone 6:
- [ ] Test navigasi antar halaman Customer (sidebar link aktif highlight)
- [ ] Test responsivitas mobile (sidebar collapsible offcanvas)
- [ ] Test proteksi route: user non-customer tidak bisa akses `/customer/*`
- [ ] Test real-time update di `/customer/orders`
- [ ] Test logout dari NavUser Customer → redirect ke `/login`
- [ ] Pastikan breadcrumb tampil benar di setiap halaman
- [ ] Cek konsistensi warna, spacing, dan tipografi antar halaman

---

## ⚠️ Catatan Penting

1. **Tidak ada perubahan** pada halaman Admin (`/dashboard/*`) dan `app-sidebar.tsx`.
2. **`app/customer/layout.tsx`** perlu `"use client"` karena `SidebarProvider` butuh client-side state.
3. **Proteksi route**: Setiap halaman Customer harus memverifikasi session dan role = "customer". Jika tidak login atau bukan customer, redirect ke `/login`.
4. **Real-time update** pada `/customer/orders` tetap dipertahankan (Supabase channel subscription).
5. **Responsif**: Sidebar Customer menggunakan `collapsible="offcanvas"` — otomatis mobile-friendly.
6. **NavUser** di Customer Sidebar: link "Profil Saya" diarahkan ke `/customer/profile`, bukan `/dashboard/profile`.
7. **Perbedaan Pesanan vs Transaksi**: `/customer/orders` fokus pada pesanan **aktif** (bisa dibatalkan), `/customer/transactions` fokus pada riwayat **final** (done/cancelled, read-only).
