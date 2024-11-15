import { ResourceTypes, type SFFSResourceTag } from '@horizon/types'
import { ResourceManager } from '../service/resources'

export const filterSpaceResourcesTags = (op: SFFSResourceTag['op']) => [
  ResourceManager.SearchTagResourceType('application/vnd.space.', op)
]

export const filterDocumentTags = (op: SFFSResourceTag['op']) => [
  ResourceManager.SearchTagResourceType(ResourceTypes.DOCUMENT, op)
]

export const filterMediaTags = (op: SFFSResourceTag['op']) => [
  ResourceManager.SearchTagResourceType('image/', op),
  ResourceManager.SearchTagResourceType('video/', op),
  ResourceManager.SearchTagResourceType('audio/', op)
]

export const filterApplicationFileTags = (op: SFFSResourceTag['op']) => [
  ResourceManager.SearchTagResourceType('application/', op)
]

export const filterOtherFileTags = (op: SFFSResourceTag['op']) => [
  ResourceManager.SearchTagResourceType('text/', op),
  ResourceManager.SearchTagResourceType('font/', op)
]
