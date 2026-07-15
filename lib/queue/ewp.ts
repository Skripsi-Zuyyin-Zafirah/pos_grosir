export type WeightedOrderItem = {
  qty: number
  weight: number
}

// EWP = Σ (Qi x Wi) — lihat Dokumen/Algoritma Antrian.md.
// Qi = kuantitas item pesanan, Wi = bobot waktu per satuan (product_units.time_weight).
export function computeEWP(items: WeightedOrderItem[]): number {
  const ewp = items.reduce((sum, item) => sum + item.qty * item.weight, 0)
  return parseFloat(ewp.toFixed(2))
}
