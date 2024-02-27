import type { JSONContent } from '@horizon/editor'

export interface SFFSResourceMetadata {
  name: string
  sourceURI: string
  alt: string
}

export interface SFFSResourceTag {
  id: string
  name: string
  value: string
}

export enum ResourceTypes {
  NOTE = 'text/space-notes',
  LINK = 'application/space-bookmark'
}

export interface ResourceTagsBuiltIn {
  savedWithAction: 'download' | 'drag/browser' | 'drag/local' | 'paste'
}

export type ResourceType = ResourceTypes.NOTE | ResourceTypes.LINK | string

export interface SFFSResource {
  id: string
  type: ResourceType
  path: string
  createdAt: string
  updatedAt: string
  deleted: boolean
  metadata?: SFFSResourceMetadata
  tags?: SFFSResourceTag[]
}

export type SFFSResourceDataNote = string
export type SFFSResourceDataBookmark = {
  title: string
  description: string
  icon: string
  image: string
  keywords: string[]
  language: string
  type: string
  url: string
  provider: string
  author: string
  published: string
  modified: string
}
