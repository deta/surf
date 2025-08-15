import { ResourceTypes, type SFFSResourceTag } from '@deta/types'
import { SearchResourceTags } from '@deta/utils'

export type FilterItem = {
  id: string
  label: string
  tags: SFFSResourceTag[]
}

export const filterSpaceResourcesTags = (op: SFFSResourceTag['op']) => [
  SearchResourceTags.ResourceType('application/vnd.space.', op)
]

export const filterDocumentTags = (op: SFFSResourceTag['op']) => [
  SearchResourceTags.ResourceType(ResourceTypes.DOCUMENT, op),
  SearchResourceTags.ResourceType(ResourceTypes.DOCUMENT_SPACE_NOTE, 'ne')
]

export const filterMediaTags = (op: SFFSResourceTag['op']) => [
  SearchResourceTags.ResourceType('image/', op),
  SearchResourceTags.ResourceType('video/', op),
  SearchResourceTags.ResourceType('audio/', op)
]

export const filterApplicationFileTags = (op: SFFSResourceTag['op']) => [
  SearchResourceTags.ResourceType('application/', op)
]

export const filterOtherFileTags = (op: SFFSResourceTag['op']) => [
  SearchResourceTags.ResourceType('text/', op),
  SearchResourceTags.ResourceType('font/', op)
]

export const filterGeneratedArtifactsTags = () => [SearchResourceTags.SavedWithAction('generated')]

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
    tags: [SearchResourceTags.ResourceType(ResourceTypes.DOCUMENT_SPACE_NOTE, 'eq')]
  },
  // {
  //   id: 'documents',
  //   label: 'Documents',
  //   tags: [...filterDocumentTags('prefix')]
  // },
  {
    id: 'surflets',
    label: 'Surflets',
    tags: [...filterGeneratedArtifactsTags()]
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

export const CONTEXT_FILTERS: FilterItem[] = [
  {
    id: 'contexts',
    label: 'Contexts',
    tags: []
  }
]

export const ALL_FILTERS: FilterItem[] = RESOURCE_FILTERS.concat(CONTEXT_FILTERS)
