import { ResourceData } from '@horizon/types'

export type WebApp = {
  id: string
  name: string
  matchHostname: RegExp
  supportedResources: string[]
}

export type DetectedWebApp = {
  appId: string | null
  appName: string | null
  hostname: string
  resourceType: string | null
  appResourceIdentifier: string | null // e.g. tweet ID
  resourceNeedsPicking: boolean
}

export type WebMetadata = {
  title: string
  description: string
  image: string | null
  icon: string
  keywords: string[]
  language: string | null
  provider: string | null
  author: string | null
  date_published: string | null
  date_modified: string | null
  type: string | null
}

export type DetectedResource = {
  data: ResourceData
  type: string
}
