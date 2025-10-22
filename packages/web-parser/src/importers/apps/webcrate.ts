/*
SAMPLE LINK:
{
    "addedAt": "2024-05-05T20:17:16.547Z",
    "addedWith": "web",
    "crate": "null",
    "id": "xKMANuJucTnzLT48",
    "key": "8638285059763454-ku-gc62wf6",
    "meta": {
        "description": "Experience a calmer, more human Internet",
        "icon": "https://sublime.app/apple-touch-icon.png?v=2",
        "image": "https://sublime.app/preview-landing.png",
        "title": "Sublime"
    },
    "public": false,
    "url": "https://sublime.app/"
}
*/

import { type ResourceDataLink, ResourceTypes } from '@deta/types'
import { BatchFetcher } from '../batcher'
import { AppImporter } from './index'
import { type DetectedResource } from '../../types'

export type WebCrateLink = {
  addedAt: string
  addedWith: string
  crate: string
  id: string
  key: string
  meta: {
    description: string
    icon: string
    image: string
    title: string
  }
  public: boolean
  url: string
}

export type WebCrateLinkResponse = {
  status: number
  message: string
  last: string
  data: WebCrateLink[]
}

export class WebCrateImporter extends AppImporter {
  domain: string
  apiKey: string

  constructor(domain: string, apiKey: string) {
    super()
    this.domain = domain
    this.apiKey = apiKey
  }

  normalizeLink(link: WebCrateLink) {
    return {
      source_id: link.id,
      title: link.meta.title,
      description: link.meta.description,
      image: link.meta.image,
      icon: link.meta.icon,
      url: link.url
    } as ResourceDataLink
  }

  parseLinks(links: WebCrateLink[]) {
    return links.map((link) => this.normalizeLink(link))
  }

  async fetchLinks(limit: number = 100, last?: string) {
    const url = `https://${this.domain}/api/link?limit=${limit}` + (last ? `&last=${last}` : '')
    const json = await this.fetchJSON(url, {
      headers: {
        'X-Space-App-Key': this.apiKey
      }
    })
    console.log('response', json)
    return json as WebCrateLinkResponse
  }

  async fetchAndProcessLinks() {
    const limit = 100

    // fetch all links in 100 link batches
    let last: string | undefined
    let links: WebCrateLink[] = []

    do {
      const response = await this.fetchLinks(limit, last)
      links = links.concat(response.data)
      last = response.last
    } while (last)

    return this.parseLinks(links)
  }

  getBatchFetcher(size: number) {
    const batcher = new BatchFetcher<DetectedResource>(size, async (limit, offset) => {
      const json = await this.fetchLinks(limit, offset as string)

      return {
        data: this.parseLinks(json.data).map((item) => ({ type: ResourceTypes.LINK, data: item })),
        nextOffset: json.last
      }
    })

    return batcher
  }
}
