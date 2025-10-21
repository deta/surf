import { useKVTable, type BaseKVItem } from '@deta/services'
import type { TreeState, BaseTreeNode, ExtendedTreeViewState } from './tree.types'

export interface TreeViewStateItem extends BaseKVItem {
  treeId: string
  expanded: string[]
  selected: string[]
  customData?: Record<string, any>
}

export class TreePersistence {
  private kvStore = useKVTable<TreeViewStateItem>('tree_view_states')
  private treeId: string

  constructor(treeId: string) {
    this.treeId = treeId
    console.log('[TreePersistence] Initialized for treeId:', treeId)
  }

  async waitForReady(): Promise<void> {
    await this.kvStore.ready
    console.log('[TreePersistence] KV store is ready')
  }

  async saveState<T extends BaseTreeNode>(state: TreeState<T>, customData?: Record<string, any>): Promise<void> {
    await this.kvStore.ready

    console.log('[TreePersistence] Saving state:', {
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
      console.log('[TreePersistence] Updated existing state')
    } else {
      // Create new
      await this.kvStore.create(stateData)
      console.log('[TreePersistence] Created new state')
    }
  }

  async restoreState<T extends BaseTreeNode>(): Promise<{ state: TreeState<T>; customData?: Record<string, any> } | null> {
    await this.kvStore.ready

    console.log('[TreePersistence] Loading state for treeId:', this.treeId)

    const persistedState = await this.kvStore.read(this.treeId)

    if (!persistedState) {
      console.log('[TreePersistence] No persisted state found')
      return null
    }

    console.log('[TreePersistence] Restored state:', {
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

    console.log('[TreePersistence] Saving custom data:', { treeId: this.treeId, customData })

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
    console.log('[TreePersistence] Clearing state for treeId:', this.treeId)
    await this.kvStore.delete(this.treeId)
  }
}

export function createTreePersistence(treeId: string): TreePersistence {
  return new TreePersistence(treeId)
}