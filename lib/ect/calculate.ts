export type ECTParams = {
  t_base: number
  t_pick: number
  t_pack: number
}

export function computeECT(
  items: Array<{ quantity: number; weight: number }>,
  params: ECTParams
): number {
  const distinctSKUs = items.length
  const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0)
  const totalWeight = items.reduce((sum, item) => sum + (item.quantity * item.weight), 0)

  // Weight factor: heavy/bulky orders have 1.5x packing factor
  const weightFactor = totalWeight > 20 ? 1.5 : 1.0

  const ect =
    params.t_base +
    (params.t_pick * distinctSKUs) +
    (params.t_pack * totalQuantity * weightFactor)

  return parseFloat(ect.toFixed(1))
}
