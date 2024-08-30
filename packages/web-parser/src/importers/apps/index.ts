import { BatchFetcher } from '../batcher'
import { DetectedResource } from '../../types'

export abstract class AppImporter {
  abstract getBatchFetcher(size: number): BatchFetcher<DetectedResource>

  async fetchJSON(input: string | URL | Request, init?: RequestInit | undefined): Promise<any> {
    if (
      typeof window !== 'undefined' &&
      // @ts-expect-error
      typeof window.api !== 'undefined' &&
      // @ts-expect-error
      typeof window.api.fetchJSON === 'function'
    ) {
      console.log('Using window.api')
      // @ts-expect-error
      return window.api.fetchJSON(input, init)
    } else {
      console.log('Using fetch API')
      const res = await fetch(input, init)
      return res.json()
    }
  }
}
