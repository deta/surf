import { ResourceTypes, type SFFSResourceTag } from '@horizon/types'
import { ResourceManager } from '../service/resources'
import type { FilterItem } from '../components/Oasis/FilterSelector.svelte'

export const filterSpaceResourcesTags = (op: SFFSResourceTag['op']) => [
  ResourceManager.SearchTagResourceType('application/vnd.space.', op)
]

export const filterDocumentTags = (op: SFFSResourceTag['op']) => [
  ResourceManager.SearchTagResourceType(ResourceTypes.DOCUMENT, op),
  ResourceManager.SearchTagResourceType(ResourceTypes.DOCUMENT_SPACE_NOTE, 'ne')
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

export const RESOURCE_FILTERS: FilterItem[] = [
  {
    id: 'links',
    label: 'Links',
    tags: [...filterSpaceResourcesTags('prefix')]
  },
  {
    id: 'media',
    label: 'Media',
    tags: [
      ...filterSpaceResourcesTags('neprefix'),
      ...filterApplicationFileTags('neprefix'),
      ...filterOtherFileTags('neprefix')
    ]
  },
  {
    id: 'notes',
    label: 'Notes',
    tags: [ResourceManager.SearchTagResourceType(ResourceTypes.DOCUMENT_SPACE_NOTE, 'eq')]
  },
  // {
  //   id: 'documents',
  //   label: 'Documents',
  //   tags: [...filterDocumentTags('prefix')]
  // },
  {
    id: 'files',
    label: 'Files',
    tags: [...filterMediaTags('neprefix'), ...filterSpaceResourcesTags('neprefix')]
  }
]
