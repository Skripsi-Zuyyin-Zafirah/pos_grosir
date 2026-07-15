Proses dan Langkah Implementasi Untuk mengimplementasikan mekanisme ini ke dalam sistem, Anda harus membangun alur kerja berurutan sebagai berikut:
Input Pesanan (Order Entry): Sistem menerima pesanan baru yang berisi informasi jenis barang dan kuantitas (Qᵢ) dari pembeli
.
Kalkulasi Prioritas: Sistem menghitung nilai EWP pesanan tersebut menggunakan rumus EWP = ∑ (Qᵢ × Wᵢ)
. Nilai EWP ini akan menjadi key atau kunci penentu posisi di dalam antrian
.
Penyisipan ke Antrian (Operasi INSERT & Heapify-Up):
Masukkan pesanan beserta nilai EWP-nya ke posisi paling akhir pada array Min-Heap
.
Lakukan proses Heapify-Up: Bandingkan nilai EWP pesanan baru tersebut dengan nilai EWP elemen induknya (parent). Jika EWP baru < EWP induk, tukar posisinya ke atas
.
Lakukan perulangan (looping) proses tukar ini hingga EWP baru ≥ EWP induk atau elemen tersebut berhasil mencapai posisi puncak/akar (root)
.
Pengecekan Ketersediaan Pegawai: Sistem melakukan query ke tabel staff untuk mengecek apakah ada pegawai yang berstatus idle (tersedia)
. Jika tidak ada pegawai yang idle, pesanan tetap mengantri di Min-Heap dan sistem terus mengecek secara berkala
.
Pengambilan Pesanan (Operasi EXTRACT-MIN & Heapify-Down):
Jika ada pegawai idle, sistem otomatis mencabut pesanan yang ada di puncak/akar Min-Heap (karena pasti memiliki EWP terkecil/prioritas tertinggi)
.
Pindahkan elemen dari posisi paling akhir di array ke posisi akar yang baru saja kosong
.
Lakukan proses Heapify-Down: Bandingkan nilai EWP akar baru dengan anak-anaknya (children). Jika EWP akar > EWP anak terkecil, tukar posisi akar dengan anak terkecil tersebut untuk menurunkannya
.
Lakukan perulangan hingga EWP akar ≤ EWP anak terkecil sehingga properti Min-Heap kembali valid
.
Distribusi Pesanan (Single Queue Multiple Server): Tugaskan pesanan yang baru saja dicabut dari akar Min-Heap kepada pegawai yang idle, lalu ubah status pegawai tersebut di database menjadi sibuk
.