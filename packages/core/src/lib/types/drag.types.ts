import type { Writable } from 'svelte/store'

import { type DragTypeNames } from '@deta/types'

import type { HistoryEntry, Tab } from '.'
import type { Resource } from '../service/resources'
import type { OasisSpace } from '../service/oasis'
import type { DesktopItemData } from './desktop.types'

export interface DragTypes extends Record<DragTypeNames, unknown> {
  'vnd/surf/tab': Tab

  'vnd/surf/resource': Resource
  'vnd/surf/resource/id': string
  'vnd/async/surf/resource': () => Promise<Resource | null>

  'vnd/surf/space': OasisSpace

  'vnd/surf/desktop_item': Writable<DesktopItemData>

  [DragTypeNames.SURF_HISTORY_ENTRY]: HistoryEntry
  [DragTypeNames.SURF_HISTORY_ENTRY_ID]: string
}

export { DragTypeNames } from '@deta/types'
