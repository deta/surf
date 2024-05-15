export type BatchOffset = string | number | null
export type BatchFetchFunctionResponse<T> = {
  data: T[]
  nextOffset: BatchOffset
}
export type BatchFetchFunction<T> = (
  limit: number,
  offset: BatchOffset
) => Promise<BatchFetchFunctionResponse<T>>

export class BatchFetcher<T> {
  batchSize: number
  offset: BatchOffset = null
  done: boolean = false
  fetchFunction: BatchFetchFunction<T>

  constructor(batchSize: number, fetchFunction: BatchFetchFunction<T>) {
    this.batchSize = batchSize
    this.fetchFunction = fetchFunction
  }

  async fetchNextBatch() {
    if (this.done) {
      return []
    }

    const response = await this.fetchFunction(this.batchSize, this.offset)

    this.offset = response.nextOffset

    if (!this.offset) {
      this.done = true
    }

    return response.data
  }
}
