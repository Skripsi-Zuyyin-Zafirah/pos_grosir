import { MinHeap } from "./min-heap"

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`)
  }
}

function runTests() {
  console.log("=== Running Min-Heap Tests ===")

  // Test 1: Invariant Min element extraction
  const minHeap = new MinHeap<number>((a, b) => a - b)
  assert(minHeap.isEmpty(), "Heap should be empty initially")
  assert(minHeap.size() === 0, "Heap size should be 0 initially")

  console.log("1. Memasukkan angka ke Min-Heap:");
  
  console.log("-> Insert 10");
  minHeap.insert(10)
  console.log("Heap state:", minHeap.getValues())

  console.log("-> Insert 5 (Heapify-Up terjadi: 5 ditukar ke atas indeks 0)");
  minHeap.insert(5)
  console.log("Heap state:", minHeap.getValues())

  console.log("-> Insert 15");
  minHeap.insert(15)
  console.log("Heap state:", minHeap.getValues())

  console.log("-> Insert 3 (Heapify-Up terjadi: 3 naik menjadi akar/indeks 0)");
  minHeap.insert(3)
  console.log("Heap state:", minHeap.getValues())

  console.log("-> Insert 8");
  minHeap.insert(8)
  console.log("Heap state:", minHeap.getValues())
 
  assert(!minHeap.isEmpty(), "Heap should not be empty")
  assert(minHeap.size() === 5, "Heap size should be 5")
  assert(minHeap.peek() === 3, "Peek should return the minimum element (3)")
 
  console.log("\n2. Mengeluarkan elemen terkecil satu per satu (Extract-Min & Heapify-Down):")
  
  const ext1 = minHeap.extractMin()
  console.log(`-> Extract-Min: ${ext1}, Heap state setelah Heapify-Down:`, minHeap.getValues())
  assert(ext1 === 3, "First extraction should be 3")
  assert(minHeap.peek() === 5, "Peek after extraction should be 5")
  assert(minHeap.size() === 4, "Size should decrease to 4")
 
  const ext2 = minHeap.extractMin()
  console.log(`-> Extract-Min: ${ext2}, Heap state setelah Heapify-Down:`, minHeap.getValues())
  assert(ext2 === 5, "Second extraction should be 5")
  
  const ext3 = minHeap.extractMin()
  console.log(`-> Extract-Min: ${ext3}, Heap state setelah Heapify-Down:`, minHeap.getValues())
  assert(ext3 === 8, "Third extraction should be 8")
  
  const ext4 = minHeap.extractMin()
  console.log(`-> Extract-Min: ${ext4}, Heap state setelah Heapify-Down:`, minHeap.getValues())
  assert(ext4 === 10, "Fourth extraction should be 10")
  
  const ext5 = minHeap.extractMin()
  console.log(`-> Extract-Min: ${ext5}, Heap state setelah Heapify-Down:`, minHeap.getValues())
  assert(ext5 === 15, "Fifth extraction should be 15")
  
  assert(minHeap.isEmpty(), "Heap should be empty after extracting all elements")
  assert(minHeap.extractMin() === undefined, "Extracting from empty heap should return undefined")

  // Test 2: Complex Objects sorting (SJF Queue Simulations)
  type OrderMock = { id: string; score: number }
  const orderHeap = new MinHeap<OrderMock>((a, b) => a.score - b.score)

  orderHeap.insert({ id: "A", score: 25.5 })
  orderHeap.insert({ id: "B", score: 5.0 })
  orderHeap.insert({ id: "C", score: 12.2 })
  orderHeap.insert({ id: "D", score: -2.5 }) // Highly aged order

  assert(orderHeap.peek()?.id === "D", "Min item should be 'D'")
  assert(orderHeap.extractMin()?.id === "D", "Extracted item should be 'D'")
  assert(orderHeap.extractMin()?.id === "B", "Extracted item should be 'B'")
  assert(orderHeap.extractMin()?.id === "C", "Extracted item should be 'C'")
  assert(orderHeap.extractMin()?.id === "A", "Extracted item should be 'A'")

  console.log("✓ All Min-Heap tests passed successfully!")
}

runTests()
export {}
