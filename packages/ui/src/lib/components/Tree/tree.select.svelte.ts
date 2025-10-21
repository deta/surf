import type { TreeStore } from './tree.store.svelte'
import type { BaseTreeNode } from './tree.types'
import { ViewType } from '@deta/types'

/**
 * Return type for createTabSelection
 */
export interface TabSelection {
  /** The currently selected node ID based on active tab */
  readonly selectedNodeId: string | null
  /** Whether we're currently updating selection from tab change (to prevent infinite loops) */
  readonly isUpdatingFromTab: boolean
  /** Notify that manual selection occurred - pauses tab-based selection temporarily */
  notifyManualSelection(): void
}

/**
 * Configuration for tab-based selection sync
 */
export interface TabSelectionConfig {
  /** Function to get the current active tab */
  getActiveTab: () => any | null
  /** Function to extract node ID from tab for selection matching */
  getNodeIdFromTab: (tab: any) => string | null
  /** Optional function to determine if tab should trigger selection */
  shouldSelectForTab?: (tab: any) => boolean
  /** Optional function to check if selection should be active (e.g., tree initialized) */
  isReady?: () => boolean
}

/**
 * Creates a reactive tab selection sync system for tree components
 */
export function createTabSelection<T extends BaseTreeNode>(
  treeStore: TreeStore<T>,
  config: TabSelectionConfig
): TabSelection {
  // Flag to prevent infinite loops when we programmatically select
  let isUpdatingFromTab = false
  // Timestamp of last manual selection to pause tab-based selection temporarily
  let lastManualSelectionTime = 0
  const MANUAL_SELECTION_PAUSE_MS = 500 // Pause tab sync for 0.5 second after manual selection
  // Track the selected node ID based on active tab
  let selectedNodeId = $derived.by(() => {

    if (window.location.pathname.startsWith("/resource/")) {
      return window.location.pathname.split("/resource/").at(1) || null
    } else if (window.location.pathname.startsWith("/notebook/")) {
      return window.location.pathname.split("/notebook/").at(1) || null
    }
    return null;

    //try {
    //  config.shouldSelectForTab?.(new URL(window.location.href));
    //} catch (e) { }

    //const activeTab = config.getActiveTab()
    //if (!activeTab) return null

    //// Check if we should select for this tab
    //if (config.shouldSelectForTab && !config.shouldSelectForTab(activeTab)) {
    //  return null
    //}

    //const nodeId = //config.getNodeIdFromTab(activeTab)
    //return nodeId
  })

  // Effect to sync tree selection with derived selection
  $effect(() => {
    // Ensure we access selectedNodeId to maintain reactivity
    const nodeId = selectedNodeId

    // Check if we should be syncing (e.g., tree initialized)
    if (config.isReady && !config.isReady()) {
      return
    }

    // Check if we should pause due to recent manual selection
    const timeSinceManualSelection = Date.now() - lastManualSelectionTime
    if (lastManualSelectionTime > 0 && timeSinceManualSelection < MANUAL_SELECTION_PAUSE_MS) {
      return
    }

    // Use silent selection to avoid triggering select events and infinite loops
    const currentState = treeStore.state
    const newSelectionIds = nodeId ? [nodeId] : []

    if (selectedNodeId == null) {
      treeStore.clearSelections()
      return
    }

    // Only update if selection actually changed to avoid unnecessary reactivity
    const currentSelectionArray = Array.from(currentState.selected).sort()
    const newSelectionArray = newSelectionIds.sort()

    if (JSON.stringify(currentSelectionArray) !== JSON.stringify(newSelectionArray)) {
      treeStore.setSelectionSilent(newSelectionIds)
    }
  })

  return {
    /** The currently selected node ID based on active tab */
    get selectedNodeId() { return selectedNodeId },
    /** Whether we're currently updating selection from tab change (to prevent infinite loops) */
    get isUpdatingFromTab() { return isUpdatingFromTab },
    /** Notify that manual selection occurred - pauses tab-based selection temporarily */
    notifyManualSelection() {
      lastManualSelectionTime = Date.now()
    }
  }
}

/**
 * Default notebook/resource tab selection configuration
 * Handles ViewType.Resource and ViewType.Notebook selection
 */
export function createNotebookTabSelectionConfig(tabsManager: any): TabSelectionConfig {
  return {
    getActiveTab: () => tabsManager.activeTabValue,

    getNodeIdFromTab: (tab: any) => {
      const viewType = tab.view.typeValue
      const viewTypeData = tab.view.typeDataValue

      // Handle different view types
      switch (viewType) {
        case ViewType.Resource:
          if (viewTypeData?.id) {
            return viewTypeData.id
          }
          break

        case ViewType.Notebook:
          if (viewTypeData?.id) {
            return viewTypeData.id
          }
          break

        case ViewType.NotebookHome:
          return null

        case ViewType.Page:
        case ViewType.Internal:
        default:
          return null
      }

      return null
    },

    shouldSelectForTab: (url: URL) => {
      const viewType = tab.view.typeValue
      // Only sync selection for notebook-related view types
      return viewType === ViewType.Resource ||
        viewType === ViewType.Notebook ||
        viewType === ViewType.NotebookHome
    }
  }
}
