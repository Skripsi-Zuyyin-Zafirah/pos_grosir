import { createClient } from "@/lib/supabase/server"
import { MinHeap } from "./min-heap"

export type QueueItem = {
  id: string
  order_number: string | null
  customer_name: string | null
  total_price: number
  total_items: number
  ewp: number
  created_at: string
}

export class PriorityQueueService {
  /**
   * Dequeues (pops) the next order and assigns it to a staff member.
   * Model: Single Queue Multiple Server (SQMS)
   */
  public static async popNextOrder(staffId: string): Promise<string | null> {
    const supabase = await createClient()
    const { data: orderId, error } = await supabase.rpc("pop_next_order", {
      p_staff_id: staffId,
    })

    if (error) {
      console.error("Gagal melakukan dequeue order:", error.message)
      throw error
    }

    return orderId
  }

  /**
   * Loads current waiting orders into an in-memory MinHeap and returns the sorted array.
   * Priority key is EWP (lowest first). Tie-breaker is created_at (earliest first).
   */
  public static async getSortedQueue(): Promise<QueueItem[]> {
    const supabase = await createClient()
    const { data: orders, error } = await supabase
      .from("orders")
      .select("id, order_number, customer_name, total_price, total_items, ewp, created_at")
      .eq("status", "antri")

    if (error) {
      console.error("Gagal memuat antrian:", error.message)
      throw error
    }

    if (!orders || orders.length === 0) return []

    // Instantiate generic binary Min-Heap
    // Priority comparison: ewp ASC, created_at (arrival time) ASC
    const heap = new MinHeap<QueueItem>((a, b) => {
      if (a.ewp !== b.ewp) {
        return a.ewp - b.ewp
      }
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    })

    // Insert items into heap
    orders.forEach((item) => {
      heap.insert({
        id: item.id,
        order_number: item.order_number,
        customer_name: item.customer_name,
        total_price: item.total_price,
        total_items: item.total_items,
        ewp: item.ewp || 0,
        created_at: item.created_at,
      })
    })

    // Extract elements sequentially to return a sorted array
    const sortedList: QueueItem[] = []
    while (!heap.isEmpty()) {
      sortedList.push(heap.extractMin()!)
    }

    return sortedList
  }
}
