import { MinHeap } from "./min-heap"

export interface QueueOrderLike {
  id: string
  ewp: number
  created_at: string
}

export interface QueueStaffLike {
  id: string
  status: "idle" | "sibuk" | null
}

// EWP terkecil = prioritas tertinggi; created_at sebagai tie-breaker (FIFO).
function compareByEwp(a: QueueOrderLike, b: QueueOrderLike): number {
  if (a.ewp !== b.ewp) return a.ewp - b.ewp
  return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
}

export class PriorityQueueService {
  // Bangun Min-Heap dari pesanan yang antri (operasi INSERT + Heapify-Up per item),
  // lalu kembalikan array hasil EXTRACT-MIN berturut-turut (Heapify-Down per pop).
  static getSortedQueue<T extends QueueOrderLike>(orders: T[]): T[] {
    const heap = new MinHeap<T>(compareByEwp)
    orders.forEach((order) => heap.insert(order))

    const sorted: T[] = []
    while (!heap.isEmpty()) {
      sorted.push(heap.extractMin()!)
    }
    return sorted
  }

  // Pesanan di akar Min-Heap (EWP terkecil) tanpa mengubah array asal.
  static peekNext<T extends QueueOrderLike>(orders: T[]): T | null {
    if (orders.length === 0) return null
    const heap = new MinHeap<T>(compareByEwp)
    orders.forEach((order) => heap.insert(order))
    return heap.peek() ?? null
  }

  // Pegawai idle pertama yang tersedia untuk menerima pesanan berikutnya.
  static findIdleStaff<T extends QueueStaffLike>(staff: T[]): T | null {
    return staff.find((s) => s.status === "idle") ?? null
  }
}
