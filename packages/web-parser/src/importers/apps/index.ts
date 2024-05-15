import { ResourceDataLink } from '@horizon/types'
import { BatchFetcher } from '../batcher'

export abstract class AppImporter {
  abstract getBatchFetcher(size: number): BatchFetcher<ResourceDataLink>

  async fetchJSON(input: string | URL | Request, init?: RequestInit | undefined): Promise<any> {
    if (
      typeof window !== 'undefined' &&
      // @ts-ignore
      typeof window.api !== 'undefined' &&
      // @ts-ignore
      typeof window.api.fetchJSON === 'function'
    ) {
      console.log('Using window.api')
      // @ts-ignore
      return window.api.fetchJSON(input, init)
    } else {
      console.log('Using fetch API')
      const res = await fetch(input, init)
      return res.json()
    }
  }
}
