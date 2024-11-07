import type { Writable } from 'svelte/store'
import type { Space, Tab } from '.'
import type { Resource } from '../service/resources'
import type { BentoItem } from '../components/Oasis/homescreen/BentoController'

export enum DragTypeNames {
  SURF_TAB = 'vnd/surf/tab',

  SURF_RESOURCE = 'vnd/surf/resource',
  SURF_RESOURCE_ID = 'vnd/surf/resource/id',
  ASYNC_SURF_RESOURCE = 'vnd/async/surf/resource',

  SURF_SPACE = 'vnd/surf/space',

  BENTO_ITEM = 'vnd/surf/bentoItem'
}

export interface DragTypes extends Record<DragTypeNames, unknown> {
  'vnd/surf/tab': Tab

  'vnd/surf/resource': Resource
  'vnd/surf/resource/id': string
  'vnd/async/surf/resource': () => Promise<Resource | null>

  'vnd/surf/space': Space

  /// Used for homescreen
  'vnd/surf/bentoItem': Writable<BentoItem>
}
