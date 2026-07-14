-- Tambah kolom is_active untuk toggle aktif/nonaktif pegawai di halaman Kelola Pegawai.
-- Pegawai nonaktif tidak akan muncul sebagai kandidat assign pesanan baru.
ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;
