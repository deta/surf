import { ResourceData } from '@horizon/types'

export type WebServiceActionInput = {
  type: string
  description: string
}

export type WebServiceActionOutput = {
  type: string
  description: string
}

export type WebServiceActionInputs = Record<string, any>

export type WebServiceAction = {
  id: string
  name: string
  description: string
  default: boolean // Wether this action is the default action for the service which gets called when saving it as a resource
  inputs: Record<string, WebServiceActionInput>
  output: WebServiceActionOutput | null
}

export type WebService = {
  id: string
  name: string
  matchHostname: RegExp
  url?: string
  supportedResources: string[]

  actions?: WebServiceAction[]

  // Browser card shortcuts
  showBrowserAction?: boolean // true -> shows in browser card
  browserActionUrl?: string
  browserActionTitle?: string
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

export type ResourceContent = {
  html: string | null
  plain: string | null
}
