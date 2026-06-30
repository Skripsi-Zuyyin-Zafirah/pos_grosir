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

  minHeap.insert(10)
  minHeap.insert(5)
  minHeap.insert(15)
  minHeap.insert(3)
  minHeap.insert(8)

  assert(!minHeap.isEmpty(), "Heap should not be empty")
  assert(minHeap.size() === 5, "Heap size should be 5")
  assert(minHeap.peek() === 3, "Peek should return the minimum element (3)")

  assert(minHeap.extractMin() === 3, "First extraction should be 3")
  assert(minHeap.peek() === 5, "Peek after extraction should be 5")
  assert(minHeap.size() === 4, "Size should decrease to 4")

  assert(minHeap.extractMin() === 5, "Second extraction should be 5")
  assert(minHeap.extractMin() === 8, "Third extraction should be 8")
  assert(minHeap.extractMin() === 10, "Fourth extraction should be 10")
  assert(minHeap.extractMin() === 15, "Fifth extraction should be 15")
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
