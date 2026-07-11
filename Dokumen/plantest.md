# TASK: Audit dan Perbaiki Masalah Login Supabase

## Permasalahan

Saat login menggunakan email dan password yang benar:

- Login berhasil.
- Tidak diarahkan ke halaman dashboard/customer.
- Halaman berubah menjadi putih (blank).
- Loading sangat lama.
- Muncul pesan:
  "Gagal memuat profil pengguna"

Saya ingin mencari akar penyebab sebenarnya, bukan hanya menebak.

---

## Yang harus dilakukan

Lakukan audit menyeluruh terhadap proses login.

Periksa secara berurutan:

### 1. Login Flow

Telusuri alur berikut:

Login Form

↓

supabase.auth.signInWithPassword()

↓

mengambil data dari tabel profiles

↓

membaca role

↓

redirect sesuai role

↓

middleware/proxy

↓

dashboard/customer

Cari titik mana yang gagal.

---

### 2. Audit Query Profiles

Cari semua kode yang melakukan:

.from("profiles")

Periksa:

- apakah menggunakan .single()
- apakah menangani error
- apakah profile bisa bernilai null
- apakah ada infinite loading ketika profile gagal

Tambahkan logging yang jelas.

Contoh:

- user.id
- hasil query
- error Supabase
- role yang didapat

---

### 3. Audit Middleware (proxy.ts)

Periksa apakah middleware:

- berhasil membaca auth user
- berhasil mengambil profile
- gagal karena RLS
- gagal karena profile tidak ada
- melakukan redirect berulang (redirect loop)

Tambahkan logging pada setiap langkah.

---

### 4. Audit Register

Periksa apakah saat register:

- user berhasil dibuat di auth.users
- profile juga dibuat di tabel profiles

Jika menggunakan trigger,
pastikan trigger benar-benar ada.

Jika menggunakan insert manual,
pastikan insert berhasil.

---

### 5. Audit Database

Periksa tabel profiles.

Pastikan:

- id UUID
- primary key
- foreign key ke auth.users
- role tidak null
- tidak ada duplicate row

---

### 6. Audit RLS

Periksa apakah RLS pada tabel profiles menyebabkan query gagal.

Periksa policy:

SELECT

INSERT

UPDATE

Pastikan authenticated user dapat membaca profil miliknya sendiri.

---

### 7. Audit Role

Pastikan role yang ada di database sama dengan role yang digunakan pada kode.

Cari jika ada ketidaksesuaian seperti:

admin

cashier

customer

staff

warehouse

Pastikan semua konsisten.

---

### 8. Audit Redirect

Cari apakah terjadi redirect loop antara:

login

dashboard

customer

middleware

Jika ada loop, jelaskan penyebabnya.

---

### 9. Audit Loading

Cari apakah ada:

- await yang tidak selesai
- router.refresh()
- Suspense
- Promise yang tidak resolve
- state loading yang tidak pernah berubah

---

### 10. Hasil Akhir

Setelah audit selesai, jangan langsung mengubah kode.

Berikan laporan:

- penyebab utama
- file yang bermasalah
- baris kode yang bermasalah
- alasan teknis

Kemudian buat perbaikan seminimal mungkin tanpa mengubah arsitektur aplikasi.

Jangan melakukan refactor besar.

Fokus hanya menyelesaikan masalah login.