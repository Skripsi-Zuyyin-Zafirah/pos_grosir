export type WeightedOrderItem = {
  qty: number
  weight: number
}

// EWP = Σ (Qi x Wi) — lihat Dokumen/Algoritma Antrian.md.
// Qi = kuantitas item pesanan, Wi = bobot waktu per satuan (product_units.time_weight).
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
