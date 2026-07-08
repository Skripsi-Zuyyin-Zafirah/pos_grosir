export function computeEWP(
  items: Array<{ quantity: number; pickup_time_seconds: number }>
): number {
  const ewp = items.reduce(
    (sum, item) => sum + item.quantity * (item.pickup_time_seconds || 0),
    0
  )
  return parseFloat(ewp.toFixed(1))
}
