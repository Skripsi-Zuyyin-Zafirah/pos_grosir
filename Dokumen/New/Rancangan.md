# Rancangan Sistem (Designs & Blueprints)
## Rancang Bangun Sistem Point of Sale Grosir dengan Penerapan Priority Queue pada Antrian Pesanan
**Studi Kasus: Grosir Jasa**

Dokumen ini memuat seluruh rancangan teknis (*designs and blueprints*) dari sistem Point of Sale (POS) Grosir Jasa, mencakup arsitektur sistem, rancangan basis data relasional, diagram UML (Use Case, Sequence, ERD), wireframe antarmuka pengguna, serta skenario pengujian Black Box.

---

## 1. Arsitektur Sistem

Arsitektur sistem dibangun dalam 5 lapisan (*5-tier architecture*) untuk memisahkan tanggung jawab antara interaksi pengguna, pemrosesan logika antrian prioritas, penyimpanan data, dan keluaran yang dihasilkan.

```mermaid
graph LR
    subgraph Aktor [1. Aktor]
        direction TB
        Customer["Pembeli (Customer)"]
        Cashier["Kasir"]
        Admin["Admin"]
    end
    subgraph Input [2. Input]
        direction TB
        InCust["Login, Keranjang, Pesanan"]
        InCash["Struk, Pembayaran"]
        InAdmin["CRUD Produk, Stok, Pengguna"]
    end
    subgraph Proses [3. Proses]
        direction TB
        EWP["Hitung EWP: sum(Q x W)"]
        MinHeap["Min-Heap Priority Queue"]
        Heapify["Heapify-Up & Heapify-Down"]
        Dist["Distribusi Tugas (Single Queue Multiple Server)"]
    end
    subgraph Database [4. Database]
        direction TB
        profiles["Profiles Table (RBAC)"]
        products["Products & Categories"]
        orders["Orders & Items"]
        staff["Staff Status Table"]
    end
    subgraph Output [5. Output]
        direction TB
        QueueDash["Dasbor Antrian Realtime"]
        StatusLive["Status Live Pembeli"]
        Receipt["Struk Kasir & Pembayaran"]
        Report["Grafik Laporan Penjualan"]
    end
    Aktor --> Input
    Input --> Proses
    Proses --> Database
    Database --> Output
```

---

## 2. Diagram UML (Unified Modelling Language)

### 2.1 Use Case Diagram
Use case diagram berikut menjelaskan hubungan interaksi antara 3 aktor (Pembeli, Kasir, Admin) dengan 10 fungsi utama dalam sistem POS Grosir Jasa.

```mermaid
leftToRightDirection
graph TD
    pembeli((Pembeli))
    kasir((Kasir))
    admin((Admin))
    
    subgraph Sistem POS Grosir
        UC1[Login]
        UC2[Registrasi Akun]
        UC3[Melihat Katalog & Stok Real-Time]
        UC4[Membuat Pesanan Digital]
        UC5[Memantau Dasbor Antrian]
        UC6[Mencetak Struk Pesanan]
        UC7[Konfirmasi Pembayaran]
        UC8[Kelola Data Produk & Stok]
        UC9[Kelola Data Pengguna]
        UC10[Lihat Laporan Penjualan]
    end
    
    pembeli --> UC1
    pembeli --> UC2
    pembeli --> UC3
    pembeli --> UC4
    
    kasir --> UC1
    kasir --> UC5
    kasir --> UC6
    kasir --> UC7
    
    admin --> UC1
    admin --> UC8
    admin --> UC9
    admin --> UC10
```

### 2.2 Sequence Diagram: Proses Checkout dan Distribusi Pesanan
Sequence diagram di bawah ini menjelaskan alur pengolahan antrian pesanan baru menggunakan algoritma Priority Queue berbasis Min-Heap, dilanjutkan dengan alur penugasan otomatis ke pegawai idle (*Single Queue Multiple Server*).

```mermaid
sequenceDiagram
    autonumber
    actor Pembeli
    participant Sistem as Sistem POS (Next.js)
    participant DB as Supabase PostgreSQL
    actor Pegawai
    
    Pembeli->>Sistem: Kirim Keranjang Belanja (Checkout)
    Note over Sistem: Hitung EWP = sum(Q_i * W_i)
    Sistem->>DB: Insert Order (EWP, created_at, status='ANTRI')
    Note over Sistem: Heapify-Up berdasarkan EWP & created_at
    Sistem->>DB: Cek status 4 pegawai di tabel staff (idle?)
    alt Ada pegawai idle
        Sistem->>DB: Extract-Min dari akar Min-Heap (Heapify-Down)
        Sistem->>DB: Set status pegawai = busy & hubungkan order
        Sistem->>Sistem: Broadcast update antrian (Supabase Realtime)
        Pegawai->>Pegawai: Ambil barang secara fisik
    else Semua pegawai sibuk
        Sistem->>Sistem: Pertahankan order di antrian Min-Heap
    end
```

---

## 3. Skema Database & Entity Relationship Diagram (ERD)

Sistem menggunakan basis data relasional PostgreSQL (melalui Supabase) yang terdiri dari 9 tabel utama untuk mendukung integritas data transaksi, inventori, dan log antrian.

```mermaid
erjiagram
    profiles ||--o{ orders : "membuat"
    categories ||--o{ products : "memiliki"
    products ||--o{ product_units : "memiliki"
    products ||--o{ order_items : "terdapat"
    orders ||--o{ order_items : "memiliki"
    orders ||--o| payments : "dibayar"
    orders ||--o{ notifications : "memicu"
    staff ||--o{ orders : "diproses"
    
    profiles {
        uuid id PK
        text full_name
        enum role "pelanggan, kasir, admin"
        boolean is_active
    }
    categories {
        uuid id PK
        text name
    }
    products {
        uuid id PK
        text sku
        text name
        uuid category_id FK
        numeric price
        text unit
        int stock
    }
    product_units {
        uuid id PK
        uuid product_id FK
        text unit_name
        numeric conversion_factor
    }
    orders {
        uuid id PK
        uuid customer_id FK
        numeric total_amount
        numeric ewp "Estimasi Waktu Proses"
        numeric priority_score
        enum status "ANTRI, DIPROSES, SIAP, SELESAI, BATAL"
        uuid staff_id FK
        timestamptz created_at
    }
    order_items {
        uuid id PK
        uuid order_id FK
        uuid product_id FK
        int qty
        numeric unit_price
    }
    staff {
        uuid id PK
        text name
        enum status "idle, busy"
    }
    payments {
        uuid id PK
        uuid order_id FK
        uuid cashier_id FK
        enum method "tunai, transfer, qris"
        numeric amount
        timestamptz paid_at
    }
    notifications {
        uuid id PK
        uuid user_id FK
        text message
        boolean is_read
        timestamptz created_at
    }
```

### 3.1 Detail Kamus Data & Relasi Tabel

1. **Tabel `profiles`**: Menyimpan kredensial pengguna yang terintegrasi dengan tabel `auth.users` Supabase. Pembatasan akses berbasis peran (*Role-Based Access Control*) diterapkan pada level tabel melalui PostgreSQL Row Level Security (RLS) policies.
2. **Tabel `products` & `categories`**: Menyimpan data barang dagangan grosir. Kolom `stock` menyimpan kuantitas stok ter-update secara real-time.
3. **Tabel `product_units`**: Mendukung variasi satuan penjualan grosir (eceran, lusin, karton).
4. **Tabel `orders` & `order_items`**: Tabel transaksi inti. Kolom `ewp` menyimpan nilai Estimasi Waktu Proses pesanan, yang bertindak sebagai kunci prioritas Min-Heap.
5. **Tabel `staff`**: Menyimpan identitas 4 orang pegawai toko. Kolom `status` (`idle` / `busy`) menentukan alur distribusi penugasan otomatis *Extract-Min*.
6. **Tabel `payments`**: Menyimpan transaksi pembayaran kasir lunas dengan metode tunai atau online.

---

## 4. Rancangan Antarmuka Pengguna (UI Wireframe)

### 4.1 Modul Pembeli: Halaman Katalog & Keranjang Belanja
Halaman katalog dirancang responsif untuk browser mobile agar mempermudah pembeli menyusun daftar belanja digital.

```
+------------------------------------------+
|  [Logo Grosir]                 (Keranjang)|
+------------------------------------------+
|  Cari Produk: [ Rokok                 ]  |
+------------------------------------------+
|  Kategori: [ Semua ] [ Kebutuhan Dapur ]  |
+------------------------------------------+
|  Katalog Produk:                         |
|  +------------------------------------+  |
|  | [Foto] Rokok Surya 16              |  |
|  | Rp 30.000 / Eceran (Stok: 120)     |  |
|  | [ - ] [ 12 ] [ + ]   [ Tambah ]    |  |
|  +------------------------------------+  |
|  | [Foto] Minyak Bimoli 2L            |  |
|  | Rp 38.000 / unit (Stok: Habis)     |  |
|  | [ Stok Habis - Tombol Nonaktif ]   |  |
|  +------------------------------------+  |
+------------------------------------------+
|  [ Katalog ]     [ Transaksi ]    [ Akun ]|
+------------------------------------------+
```

### 4.2 Modul Kasir: Dasbor Antrian Priority Queue (Min-Heap)
Papan antrian real-time yang menyajikan daftar antrian terurut prioritas (EWP terkecil di posisi atas) dan status keempat pegawai secara terpusat.

```
+-----------------------------------------------------------------------------------+
|  DASBOR ANTRIAN PRIORITAS KASIR (REAL-TIME)                          [Admin Area] |
+-----------------------------------------------------------------------------------+
|  [ Antrian Priority Queue ]                                                       |
|  +-----+------------+---------------+------------+--------------+---------------+ |
|  | No. | No. Order  | Nama Pembeli  | Item (Qty) | EWP (Prioritas)| Aksi        | |
|  +-----+------------+---------------+------------+--------------+---------------+ |
|  |  1  | ORD-00342  | Toko Berkah   | 3 jenis(5) | 45 detik     | [Cetak Struk] | |
|  |  2  | ORD-00340  | Zuyyin Zafira | 2 jenis(8) | 70 detik     | [Cetak Struk] | |
|  |  3  | ORD-00341  | Andyka        | 5 jenis(12)| 180 detik    | [Cetak Struk] | |
|  +-----+------------+---------------+------------+--------------+---------------+ |
|                                                                                   |
|  [ Status Pegawai Toko ]                                                          |
|  +-------------------+-------------------+-------------------+------------------+ |
|  | Pegawai 1: BUSY   | Pegawai 2: IDLE   | Pegawai 3: BUSY   | Pegawai 4: IDLE  | |
|  | (ORD-00339)       | (Tersedia)        | (ORD-00338)       | (Tersedia)       | |
|  +-------------------+-------------------+-------------------+------------------+ |
+-----------------------------------------------------------------------------------+
```

---

## 5. Skenario Pengujian Black Box

Pengujian fungsionalitas sistem dirancang menggunakan teknik Black Box Testing untuk memverifikasi kesesuaian antara input pengguna dengan respon yang diberikan sistem.

### 5.1 Skenario Pengujian Login & Registrasi
- **Test Case 1**: Login dengan kredensial terdaftar -> Login berhasil, user diarahkan sesuai *role*.
- **Test Case 2**: Login dengan password salah -> Login gagal, muncul error validasi.
- **Test Case 3**: Registrasi akun pembeli dengan username yang sudah digunakan -> Registrasi ditolak, muncul warning "Username sudah terdaftar".

### 5.2 Skenario Pengujian Katalog & Pemesanan
- **Test Case 1**: Menampilkan stok real-time -> Produk dengan stok = 0 otomatis menampilkan indikator "Stok Habis" dan tombol pemesanan dinonaktifkan.
- **Test Case 2**: Membuat pesanan item melebihi stok -> Transaksi ditolak, muncul pesan "Stok tidak mencukupi".
- **Test Case 3**: Verifikasi kalkulasi EWP -> Memesan 2 unit barang A (W=5 detik) dan 1 unit barang B (W=15 detik) -> EWP terhitung otomatis di database = 25 detik.

### 5.3 Skenario Pengujian Antrian & Distribusi Pegawai
- **Test Case 1**: Memasukkan 3 pesanan baru dengan EWP bervariasi -> Papan antrian kasir memperbarui urutan prioritas terkini secara real-time, menempatkan EWP terkecil di baris paling atas antrian.
- **Test Case 2**: Mengubah status pesanan dari `ANTRI` menjadi `DIPROSES` -> Pegawai yang ditugaskan berubah status menjadi *busy* di dasbor kasir secara real-time.
- **Test Case 3**: Kasir menyelesaikan transaksi pembayaran -> Status pesanan berubah menjadi `SELESAI`, stok produk di database terpotong otomatis sesuai item belanja, dan status pegawai kembali berubah menjadi *idle* (siap menerima pesanan baru).
