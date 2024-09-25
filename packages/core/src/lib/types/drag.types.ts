import type { SFFSResource, Space, Tab } from '.'
import type { Resource } from '../service/resources'

export enum DragTypeNames {
  SURF_TAB = 'vnd/surf/tab',

  SURF_RESOURCE = 'vnd/surf/resource',
  SURF_RESOURCE_ID = 'vnd/surf/resource/id',
  ASYNC_SURF_RESOURCE = 'vnd/async/surf/resource',

  SURF_SPACE = 'vnd/surf/space'
}

export interface DragTypes extends Record<DragTypeNames, unknown> {
  'vnd/surf/tab': Tab
  'vnd/surf/resource': Resource
  'vnd/surf/resource/id': string
  'vnd/async/surf/resource': () => Promise<Resource | null>
  'vnd/surf/space': Space

  //"vnd/sffs/resource": SFFSResource
}
