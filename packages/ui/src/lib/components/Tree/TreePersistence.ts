import { useKVTable, type BaseKVItem } from '@deta/services'
import type { TreeState, BaseTreeNode, ExtendedTreeViewState } from './tree.types'
import { ScopedLogger, useLogScope } from '@deta/utils'

export interface TreeViewStateItem extends BaseKVItem {
  treeId: string
  expanded: string[]
  selected: string[]
  customData?: Record<string, any>
}

export class TreePersistence {
  private kvStore = useKVTable<TreeViewStateItem>('tree_view_states')
  private treeId: string
  private log: ScopedLogger

  constructor(treeId: string) {
    this.treeId = treeId
    this.log = useLogScope('TreePersistence')
    this.log.debug('Initialized for treeId:', treeId)
  }

  async waitForReady(): Promise<void> {
    await this.kvStore.ready
    this.log.debug('KV store is ready')
  }

  async saveState<T extends BaseTreeNode>(state: TreeState<T>, customData?: Record<string, any>): Promise<void> {
    await this.kvStore.ready

    this.log.debug('Saving state:', {
      treeId: this.treeId,
      expanded: Array.from(state.expanded),
      selected: Array.from(state.selected),
      customData
    })

    const stateData: TreeViewStateItem = {
      id: this.treeId,
      treeId: this.treeId,
      expanded: Array.from(state.expanded),
      selected: Array.from(state.selected),
      customData,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }

    // Try to read existing state first
    const existingState = await this.kvStore.read(this.treeId)

    if (existingState) {
      // Update existing
      await this.kvStore.update(this.treeId, {
        expanded: stateData.expanded,
        selected: stateData.selected,
        customData: stateData.customData,
        updatedAt: stateData.updatedAt
      })
      this.log.debug('Updated existing state')
    } else {
      // Create new
      await this.kvStore.create(stateData)
      this.log.debug('Created new state')
    }
  }

  async restoreState<T extends BaseTreeNode>(): Promise<{ state: TreeState<T>; customData?: Record<string, any> } | null> {
    await this.kvStore.ready

    this.log.debug('Loading state for treeId:', this.treeId)

    const persistedState = await this.kvStore.read(this.treeId)

    if (!persistedState) {
      this.log.debug('No persisted state found')
      return null
    }

    this.log.debug('Restored state:', {
      expanded: persistedState.expanded,
      selected: persistedState.selected,
      customData: persistedState.customData,
      fullState: persistedState
    })

    return {
      state: {
        expanded: new Set(persistedState.expanded || []),
        selected: new Set(persistedState.selected || []),
        loading: new Set<string>()
      },
      customData: persistedState.customData
    }
  }

  async saveCustomData(customData: Record<string, any>): Promise<void> {
    await this.kvStore.ready

    this.log.debug('Saving custom data:', { treeId: this.treeId, customData })

    const existingState = await this.kvStore.read(this.treeId)

    if (existingState) {
      await this.kvStore.update(this.treeId, {
        customData,
        updatedAt: new Date().toISOString()
      })
    } else {
      // Create new state with just custom data
      await this.kvStore.create({
        id: this.treeId,
        treeId: this.treeId,
        expanded: [],
        selected: [],
        customData,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      })
    }
  }

  async getCustomData(): Promise<Record<string, any> | undefined> {
    await this.kvStore.ready
    const persistedState = await this.kvStore.read(this.treeId)
    return persistedState?.customData
  }

  async clearState(): Promise<void> {
    this.log.debug('Clearing state for treeId:', this.treeId)
    await this.kvStore.delete(this.treeId)
  }
}

export function createTreePersistence(treeId: string): TreePersistence {
  return new TreePersistence(treeId)
}
