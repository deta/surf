import type { SFFSResource, Tab } from '.'
import type { Resource } from '../service/resources'

export enum DragTypeNames {
  SURF_TAB = 'vnd/surf/tab',
  SURF_RESOURCE = 'vnd/surf/resource',
  ASYNC_SURF_RESOURCE = 'vnd/async/surf/resource'
}

export interface DragTypes extends Record<DragTypeNames, unknown> {
  'vnd/surf/tab': Tab
  'vnd/surf/resource': Resource
  'vnd/async/surf/resource': () => Promise<Resource | null>
  //"vnd/surf/space": Space

  //"vnd/sffs/resource": SFFSResource
}
