export class MinHeap<T> {
  private heap: T[] = []
  private compare: (a: T, b: T) => number

  constructor(compare: (a: T, b: T) => number) {
    this.compare = compare
  }

  public size(): number {
    return this.heap.length
  }

  public isEmpty(): boolean {
    return this.heap.length === 0
  }

  public peek(): T | undefined {
    return this.heap[0]
  }

  public clear(): void {
    this.heap = []
  }

  public getValues(): T[] {
    return [...this.heap]
  }

  public insert(item: T): void {
    this.heap.push(item)
    this.heapifyUp(this.heap.length - 1)
  }

  public extractMin(): T | undefined {
    if (this.heap.length === 0) return undefined
    if (this.heap.length === 1) return this.heap.pop()

    const min = this.heap[0]
    this.heap[0] = this.heap.pop()!
    this.heapifyDown(0)

    return min
  }

  private heapifyUp(index: number): void {
    let currentIndex = index
    while (currentIndex > 0) {
      const parentIndex = Math.floor((currentIndex - 1) / 2)
      if (this.compare(this.heap[currentIndex], this.heap[parentIndex]) >= 0) {
        break
      }
      this.swap(currentIndex, parentIndex)
      currentIndex = parentIndex
    }
  }

  private heapifyDown(index: number): void {
    let currentIndex = index
    const length = this.heap.length

    while (2 * currentIndex + 1 < length) {
      const leftChildIndex = 2 * currentIndex + 1
      const rightChildIndex = 2 * currentIndex + 2
      let smallerChildIndex = leftChildIndex

      if (
        rightChildIndex < length &&
        this.compare(this.heap[rightChildIndex], this.heap[leftChildIndex]) < 0
      ) {
        smallerChildIndex = rightChildIndex
      }

      if (this.compare(this.heap[currentIndex], this.heap[smallerChildIndex]) <= 0) {
        break
      }

      this.swap(currentIndex, smallerChildIndex)
      currentIndex = smallerChildIndex
    }
  }

  private swap(i: number, j: number): void {
    const temp = this.heap[i]
    this.heap[i] = this.heap[j]
    this.heap[j] = temp
  }
}
