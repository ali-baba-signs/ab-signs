export type PurchasedCartLine = { lineId: string; quantity: number }

export function removePurchasedCartLines<T extends { lineId: string; quantity: number }>(
  items: T[],
  purchasedLines: PurchasedCartLine[],
) {
  const purchasedByLine = new Map<string, number>()
  for (const line of purchasedLines) {
    if (!line || typeof line.lineId !== 'string' || !line.lineId || !Number.isInteger(line.quantity) || line.quantity <= 0) continue
    purchasedByLine.set(line.lineId, (purchasedByLine.get(line.lineId) || 0) + line.quantity)
  }

  return items.flatMap((item) => {
    const purchasedQuantity = purchasedByLine.get(item.lineId) || 0
    if (!purchasedQuantity) return [item]
    const remainingQuantity = item.quantity - purchasedQuantity
    return remainingQuantity > 0 ? [{ ...item, quantity: remainingQuantity } as T] : []
  })
}
