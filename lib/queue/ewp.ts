export type WeightedOrderItem = {
  qty: number
  weight: number
}

// EWP = Σ (Qi x Wi) — lihat Dokumen/Algoritma Antrian.md.
// Qi = kuantitas item pesanan, Wi = bobot waktu (DETIK) per satuan (product_units.time_weight
// / products.time_weight). Hasil EWP juga dalam DETIK, disimpan apa adanya di "orders.ewp".
// Wi jatuh ke 1 jika tidak valid (mis. item keranjang lama yang belum punya timeWeight),
// supaya EWP tidak pernah jadi NaN -> null saat dikirim ke kolom NOT NULL "orders.ewp".
export function computeEWP(items: WeightedOrderItem[]): number {
  const ewp = items.reduce((sum, item) => {
    const qty = Number.isFinite(item.qty) ? item.qty : 0
    const weight = Number.isFinite(item.weight) ? item.weight : 1
    return sum + qty * weight
  }, 0)
  return parseFloat(ewp.toFixed(2))
}

// Format durasi dalam detik menjadi teks yang mudah dibaca ("45 detik", "2 menit 5 detik").
export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds))
  if (s <= 0) return "Segera"
  if (s < 60) return `${s} detik`
  const minutes = Math.floor(s / 60)
  const seconds = s % 60
  return seconds === 0 ? `${minutes} menit` : `${minutes} menit ${seconds} detik`
}
