<script lang="ts">
  import { onMount } from 'svelte'
  import {
    Tree,
    type BaseTreeNode,
    type TreeConfig,
    type TreeEvents,
    type TreeNodeAction,
    type TreeDragConfig,
    contextMenu,
    type CtxItem,
    openDialog
  } from '@deta/ui'
  import { ResourceLoader, NotebookCover } from '@deta/ui'
  import { Icon } from '@deta/icons'
  import { useNotebookManager } from '@deta/services/notebooks'
  import { ResourceTypes, SpaceEntryOrigin, type OpenTarget } from '@deta/types'
  import { useResourceManager, type Resource, getResourceCtxItems } from '@deta/services/resources'
  import { NotebookManagerEvents } from '@deta/services/notebooks'
  import {
    openResource,
    openNotebook,
    determineClickOpenTarget
  } from '../../handlers/notebookOpenHandlers'
  import { isModKeyPressed, truncate, conditionalArrayItem, useDebounce } from '@deta/utils'

  import { createTreeStore } from '@deta/ui'
  import { createNotebookTreeDragAndDrop, type NotebookTreeNode } from './notebookTreeDnd.svelte'

  // Props
  let { isVisible = $bindable(true), onCustomizeNotebook } = $props()

  // Initialize services
  const notebookManager = useNotebookManager()
  const resourceManager = useResourceManager()

  // Context Menu Functions
  const handleDeleteNotebook = async (notebook: any) => {
    const { closeType: confirmed } = await openDialog({
      title: `Delete <i>${truncate(notebook.nameValue, 26)}</i>`,
      message: `This can't be undone. <br>Your resources won't be deleted.`,
      actions: [
        { title: 'Cancel', type: 'reset' },
        { title: 'Delete', type: 'submit', kind: 'danger' }
      ]
    })
    if (!confirmed) return
    notebookManager.deleteNotebook(notebook.id, true)
  }

  const handlePinNotebook = (notebookId: string) => {
    notebookManager.updateNotebookData(notebookId, { pinned: true })
  }

  const handleUnPinNotebook = (notebookId: string) => {
    notebookManager.updateNotebookData(notebookId, { pinned: false })
  }

  const handleAddToNotebook = (notebookId: string, resourceId: string) => {
    notebookManager.addResourcesToNotebook(
      notebookId,
      [resourceId],
      SpaceEntryOrigin.ManuallyAdded,
      true
    )
  }

  const handleRemoveFromNotebook = (notebookId: string, resourceId: string) => {
    notebookManager.removeResourcesFromNotebook(notebookId, [resourceId], true)
  }

  const handleDeleteResource = async (resource: Resource) => {
    const { closeType: confirmed } = await openDialog({
      title: `Delete Note?`,
      message: `This can't be undone.`,
      actions: [
        { title: 'Cancel', type: 'reset' },
        { title: 'Delete', type: 'submit', kind: 'danger' }
      ]
    })
    if (!confirmed) return
    notebookManager.deleteResourcesFromSurf(resource.id, true)
  }

  // Get context menu items for notebooks
  const getNotebookCtxItems = (node: NotebookTreeNode): CtxItem[] => {
    const notebook = node.meta.notebook

    // Special handling for Drafts notebook
    if (node.id === 'drafts') {
      return [
        {
          type: 'action',
          text: 'Open',
          icon: 'eye',
          action: () => openNotebook('drafts', { target: 'auto', from_notebook_tree_sidebar: true })
        },
        {
          type: 'action',
          text: 'Open in Background',
          icon: 'arrow.up.right',
          action: () =>
            openNotebook('drafts', { target: 'background_tab', from_notebook_tree_sidebar: true })
        }
      ]
    }

    if (!notebook) return []

    return [
      {
        type: 'action',
        text: 'Open',
        icon: 'eye',
        action: () =>
          openNotebook(notebook.id, { target: 'auto', from_notebook_tree_sidebar: true })
      },
      {
        type: 'action',
        text: 'Open in Background',
        icon: 'arrow.up.right',
        action: () =>
          openNotebook(notebook.id, { target: 'background_tab', from_notebook_tree_sidebar: true })
      },
      {
        type: 'action',
        text: 'Customize',
        icon: 'edit',
        action: () => onCustomizeNotebook?.(notebook)
      },

      { type: 'separator' },
      {
        type: 'action',
        text: notebook.data?.pinned ? 'Unpin' : 'Pin',
        icon: 'pin',
        action: () =>
          notebook.data?.pinned ? handleUnPinNotebook(notebook.id) : handlePinNotebook(notebook.id)
      },
      { type: 'separator' },
      {
        type: 'action',
        kind: 'danger',
        text: 'Delete',
        icon: 'trash',
        action: () => handleDeleteNotebook(notebook)
      }
    ]
  }

  // Get context menu items for notes
  const getNoteCtxItems = (node: NotebookTreeNode): CtxItem[] => {
    const entryId = node.meta.entryId
    const notebook = node.meta.notebook
    if (!entryId) return []

    // We need to get the resource from the resource manager
    const resource = resourceManager.resources.get(entryId)
    if (!resource) return []

    return getResourceCtxItems({
      resource,
      sortedNotebooks: notebookManager.sortedNotebooks,
      onOpen: (target: OpenTarget) =>
        openResource(entryId, { target, offline: false, from_notebook_tree_sidebar: true }),
      onAddToNotebook: (notebookId) => handleAddToNotebook(notebookId, resource.id),
      onOpenOffline: (resourceId: string) =>
        openResource(resourceId, {
          offline: true,
          target: 'tab',
          from_notebook_tree_sidebar: true
        }),
      onDeleteResource: () => handleDeleteResource(resource),
      onRemove:
        notebook?.id && notebook.id !== 'drafts'
          ? () => handleRemoveFromNotebook(notebook.id, resource.id)
          : undefined
    })
  }

  async function handleCreateNoteInNotebook(node: NotebookTreeNode) {
    if (node.meta.type !== 'notebook') return

    try {
      // Expand the notebook to show the new note
      treeStore.setExpanded(node.id, true)

      // Create the note directly using resource manager
      const resource = await resourceManager.createResourceNote(
        '', // empty content
        {
          name: 'Untitled Note'
        }
      )

      // Add the note to the notebook (unless it's drafts)
      if (node.id !== 'drafts' && node.meta.notebook) {
        await notebookManager.addResourcesToNotebook(
          node.meta.notebook.id,
          [resource.id],
          SpaceEntryOrigin.ManuallyAdded,
          true
        )

        // Refresh the notebook contents to show the new note
        const notebook = notebookManager.notebooks.get(node.meta.notebook.id)
        if (notebook) {
          await notebook.fetchContents()
        }
      }

      // Open the note in the current tab
      openResource(resource.id, { target: 'active_tab', offline: false })
    } catch (error) {
      console.error('[NotebookTreeView] Failed to create note in notebook:', error)
    }
  }

  // DND Configuration with declarative hierarchy rules
  const dragConfig: TreeDragConfig = {
    enabled: true,
    allowReorder: true,
    allowCrossNodeDrag: true,
    allowParentChildDrag: true,
    axis: 'vertical',
    showDropIndicator: true,
    hierarchyRules: {
      notebook: {
        allowAsChildOf: [], // Notebooks cannot be nested inside other notebooks
        allowAsSiblingOf: ['notebook'], // Notebooks can be reordered with other notebooks
        canAcceptChildren: ['note'] // Notebooks can accept notes as children
      },
      note: {
        allowAsChildOf: ['notebook'], // Notes can be children of notebooks
        allowAsSiblingOf: ['note'], // Notes can be reordered with other notes
        canAcceptChildren: [] // Notes cannot accept children
      }
    }
  }

  // TreeView-specific click handler that always opens in active tab
  function handleTreeViewClick(e: MouseEvent): OpenTarget {
    const backgroundTab = isModKeyPressed(e) && !e.shiftKey
    const sidebarTab = e.shiftKey

    if (e.type === 'auxclick' && e.button === 1) {
      return 'background_tab'
    }

    return backgroundTab
      ? 'background_tab'
      : isModKeyPressed(e)
        ? 'tab'
        : sidebarTab
          ? 'sidebar'
          : 'active_tab' // Always open in active tab for tree navigation
  }

  // Initialize DND system
  let dndHandlers = $state<ReturnType<typeof createNotebookTreeDragAndDrop> | null>(null)

  // Tree events
  const events: Partial<TreeEvents<NotebookTreeNode>> = {
    select: (node, event) => {
      if (event) {
        const target = determineClickOpenTarget(event)
        if (node.meta.type === 'notebook') {
          // Handle drafts notebook (which has no notebook object)
          if (node.id === 'drafts') {
            openNotebook('drafts', { target, from_notebook_tree_sidebar: true })
          } else if (node.meta.notebook) {
            openNotebook(node.meta.notebook.id, { target, from_notebook_tree_sidebar: true })
          }
        } else if (node.meta.type === 'note' && node.meta.entryId) {
          openResource(node.meta.entryId, { target, from_notebook_tree_sidebar: true })
        }
      }
    },

    expand: async (node) => {
      // Check if this is a notebook that needs fresh contents
      if (node.meta.type === 'notebook' && node.meta.notebook) {
        try {
          const notebook = node.meta.notebook
          // Ensure contents are fresh when expanding
          await notebook.fetchContents()
        } catch (error) {
          console.warn('[NotebookTreeView] Failed to refresh notebook:', node.id, error)
        }
      }
    },

    // DND event handlers delegate to the DND system
    drop: (operation) => {
      if (dndHandlers) {
        dndHandlers.handleDrop(operation)
      }
    }
  }

  // Create tree store with persistence - must be at component initialization
  // Note: Selection state is managed externally via active tab sync
  const treeStore = createTreeStore<NotebookTreeNode>(
    [], // Will be populated after data loads
    {
      persistState: true,
      persistenceKey: 'notebook-tree',
      showCount: true,
      allowRename: false,
      allowMultiSelect: false,
      drag: dragConfig
    },
    events
  )

  let isInitialized = $state(false)

  // Reactive tree data that automatically updates when notebooks change
  // No longer waits for contents to load - just builds with whatever data is available
  let treeData = $derived.by(() => {
    // React to notebooks SetMap changes
    const notebooks = notebookManager.notebooks.values().toArray()

    if (!isInitialized || notebooks.length === 0) {
      return []
    }

    return buildTreeData()
  })

  // Note: Tab selection sync is disabled in Resource renderer context
  // since we don't have access to the tabsManager service

  // PERF: This is not the fix, but it fixes freezing the renderer for 3-4 seconds
  // still not instant but better
  const setTreeNodes = useDebounce((treeData) => treeStore.setNodes(treeData), 0)
  // Effect to update tree store when reactive data changes
  $effect(() => {
    if (isInitialized && treeData) {
      setTreeNodes(treeData)
    }
  })

  // Define actions for tree nodes
  const actions: TreeNodeAction[] = [
    {
      label: 'Add Note',
      icon: 'add',
      action: handleCreateNoteInNotebook,
      disabled: (node) => node.meta.type !== 'notebook'
    }
  ]

  // Tree config - selection is managed externally via activeTab sync
  const config: TreeConfig<NotebookTreeNode> = {
    persistenceKey: 'notebook-tree',
    showCount: true,
    allowRename: false,
    allowMultiSelect: false,
    // Enable DND with our configuration
    drag: dragConfig
  }

  // Build tree data with persisted ordering - now reactive!
  function buildTreeData(): NotebookTreeNode[] {
    const nodes: NotebookTreeNode[] = []

    // Get persisted orders from tree store custom data
    const customData = treeStore.getCustomData()
    const persistedNotebookOrder = customData.notebookOrder || []
    const persistedNoteOrders = customData.noteOrders || {}

    // Add Drafts notebook as first node
    const draftsNode: NotebookTreeNode = {
      id: 'drafts',
      label: 'Drafts',
      meta: {
        type: 'notebook' as const,
        notebook: null // Special virtual notebook
      },
      count: 0, // Will be updated if we fetch drafts contents
      children: undefined,
      expanded: false,
      draggable: false, // Drafts cannot be reordered
      droppable: true, // Can accept notes
      dragData: {
        notebookId: 'drafts',
        originalIndex: 0,
        type: 'notebook'
      }
    }
    nodes.push(draftsNode)

    // Use reactive sortedNotebooks from NotebookManager
    const notebooks = notebookManager.sortedNotebooks

    // Apply persisted notebook order
    const orderedNotebooks = applyPersistedNotebookOrder(notebooks, persistedNotebookOrder)

    // Add notebooks
    orderedNotebooks.forEach((notebook, notebookIndex) => {
      // Filter note entries from notebook contents
      const noteEntries = notebook.contents.filter(
        (entry: any) => entry.resource_type === ResourceTypes.DOCUMENT_SPACE_NOTE
      )

      // Apply persisted note order if available
      const persistedNoteOrder = persistedNoteOrders[notebook.id] || []
      const orderedNoteEntries = applyPersistedNoteOrder(noteEntries, persistedNoteOrder)

      // Create child nodes for notes
      let children: NotebookTreeNode[] | undefined = undefined

      if (orderedNoteEntries.length > 0) {
        children = createNoteNodesFromEntries(orderedNoteEntries, notebook)
      }

      const node: NotebookTreeNode = {
        id: notebook.id,
        label: notebook.nameValue, // This is reactive!
        meta: { type: 'notebook' as const, notebook },
        count: orderedNoteEntries.length,
        children,
        expanded: false, // Let persistence control expansion
        draggable: true,
        droppable: true,
        dragData: {
          notebookId: notebook.id,
          originalIndex: notebookIndex,
          type: 'notebook'
        }
      }

      nodes.push(node)
    })

    return nodes
  }

  //// well idk anymorej
  //$effect(() => {
  //  treeStore.clearSelections()
  //})

  // Initialize notebooks on mount
  onMount(() => {
    async function initialize() {
      await notebookManager.loadNotebooks()

      // Initialize DND system
      dndHandlers = createNotebookTreeDragAndDrop(notebookManager, treeStore)

      // Fetch all notebook contents in background (don't await - let it happen async)
      // Tree will reactively update as contents load
      const notebooks = notebookManager.notebooks.values().toArray()
      notebooks.forEach((notebook) => {
        notebook
          .fetchContents()
          .catch((e) =>
            console.error('[NotebookTreeView] Failed to load contents for:', notebook.nameValue, e)
          )
      })

      isInitialized = true
      treeStore.clearSelections()
    }

    initialize()

    // Still listen to events for operations that need immediate response
    const unsubscribers = [
      // Listen to resource creation from other renderers to refresh contents
      notebookManager.on(NotebookManagerEvents.CreatedResource, async (resourceId: string) => {
        // Force refresh of all notebook contents to pick up new resources
        const notebooks = notebookManager.notebooks.values().toArray()
        notebooks.forEach((notebook) => {
          notebook
            .fetchContents()
            .catch((e) =>
              console.error(
                '[NotebookTreeView] Failed to load contents for:',
                notebook.nameValue,
                e
              )
            )
        })
      })
    ]

    // Cleanup event listeners on component destroy
    return () => {
      unsubscribers.forEach((unsub) => unsub())
    }
  })

  // Helper to create note nodes from notebook entries with persisted order
  function createNoteNodesFromEntries(noteEntries: any[], notebook: any): NotebookTreeNode[] {
    return noteEntries.map((entry, index) => ({
      id: entry.entry_id,
      label: 'Loading...', // Will be replaced by ResourceLoader
      meta: {
        type: 'note' as const,
        entryId: entry.entry_id,
        notebook // Store notebook reference for easy access
      },
      // Enable DND for notes
      draggable: true,
      droppable: true,
      dragData: {
        entryId: entry.entry_id,
        notebookId: notebook.id,
        originalIndex: index
      }
    }))
  }

  // Apply persisted order to note entries
  function applyPersistedNoteOrder(noteEntries: any[], persistedOrder: string[]): any[] {
    if (persistedOrder.length === 0) return noteEntries

    const entryMap = new Map(noteEntries.map((entry) => [entry.entry_id, entry]))
    const orderedEntries: any[] = []
    const usedIds = new Set<string>()

    // Add entries in persisted order
    for (const noteId of persistedOrder) {
      const entry = entryMap.get(noteId)
      if (entry) {
        orderedEntries.push(entry)
        usedIds.add(noteId)
      }
    }

    // Add any remaining entries that weren't in the persisted order
    for (const entry of noteEntries) {
      if (!usedIds.has(entry.entry_id)) {
        orderedEntries.push(entry)
      }
    }

    return orderedEntries
  }

  // Apply persisted notebook order
  function applyPersistedNotebookOrder(notebooks: any[], persistedOrder: string[]): any[] {
    if (persistedOrder.length === 0) return notebooks

    const notebookMap = new Map(notebooks.map((nb) => [nb.id, nb]))
    const orderedNotebooks: any[] = []
    const usedIds = new Set<string>()

    // Add notebooks in persisted order
    for (const notebookId of persistedOrder) {
      const notebook = notebookMap.get(notebookId)
      if (notebook) {
        orderedNotebooks.push(notebook)
        usedIds.add(notebookId)
      }
    }

    // Add any remaining notebooks that weren't in the persisted order
    for (const notebook of notebooks) {
      if (!usedIds.has(notebook.id)) {
        orderedNotebooks.push(notebook)
      }
    }

    return orderedNotebooks
  }
</script>

{#if isInitialized}
  <Tree
    nodes={treeStore.nodes}
    {config}
    {events}
    {actions}
    store={treeStore}
    class="notebook-tree-sidebar"
    data-tree-id="notebook-tree"
  >
    {#snippet decorator(node: NotebookTreeNode)}
      {#if node.meta.type === 'notebook'}
        <div class="notebook-cover-mini">
          {#if node.id === 'drafts'}
            <NotebookCover
              title="Drafts"
              height="0.9rem"
              fontSize="0.09rem"
              readonly={true}
              tilt={false}
              --round-base="2px"
              --round-diff="-1px"
              color={[
                ['#5d5d62', '5d5d62'],
                ['#2e2f34', '#2e2f34'],
                ['#efefef', '#efefef']
              ]}
              textured={false}
            />
          {:else if node.meta.notebook}
            <NotebookCover
              notebook={node.meta.notebook}
              height="0.9rem"
              fontSize="0.09rem"
              readonly={true}
              tilt={false}
              --round-base="2px"
              --round-diff="-1px"
              textured={false}
            />
          {/if}
        </div>
      {/if}
    {/snippet}

    {#snippet children(node: NotebookTreeNode)}
      {#if node.meta.type === 'note' && node.meta.entryId}
        <!-- Use ResourceLoader for reactive note display -->
        <ResourceLoader resource={node.meta.entryId}>
          {#snippet loading()}
            <button type="button" class="node-content loading" aria-label="Loading note...">
              <Icon name="file-text" size="14" />
              <span class="node-label">Loading...</span>
            </button>
          {/snippet}
          {#snippet children(resource: Resource)}
            <button
              type="button"
              class="node-content note-content"
              aria-label={`Note: ${resource.metadata.name || 'Untitled Note'}`}
              {@attach contextMenu({
                canOpen: true,
                items: getNoteCtxItems(node)
              })}
            >
              <Icon name="file-text" size="14" />
              <span class="node-label">{resource.metadata.name || 'Untitled Note'}</span>
            </button>
          {/snippet}
        </ResourceLoader>
      {:else if node.meta.type === 'notebook'}
        <div
          class="node-content notebook-content"
          role="button"
          tabindex="0"
          aria-label={`${node.meta.type}: ${node.label}${node.count ? ` (${node.count} items)` : ''}`}
          onkeydown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              // Handle notebook click here if needed
            }
          }}
          {@attach contextMenu({
            canOpen: true,
            items: getNotebookCtxItems(node)
          })}
        >
          <span class="node-label">{node.label}</span>
        </div>
      {:else}
        <!-- Regular node display for other types -->
        <button
          type="button"
          class="node-content"
          aria-label={`${node.meta.type}: ${node.label}${node.count ? ` (${node.count} items)` : ''}`}
        >
          <span class="node-label">{node.label}</span>
        </button>
      {/if}
    {/snippet}
  </Tree>
{:else}
  <div class="loading-placeholder">
    <span>Loading notebooks...</span>
  </div>
{/if}

<style lang="scss">
  :global(.notebook-tree-sidebar) {
    height: 100%;
    padding: 0.5rem;
    --tree-indent-size: 0.125rem;
    --tree-hover-bg: light-dark(rgba(88, 104, 132, 0.08), rgba(148, 163, 184, 0.1));
    --tree-selected-bg: light-dark(rgba(88, 104, 132, 0.12), rgba(148, 163, 184, 0.15));
    --tree-selected-border: light-dark(rgba(88, 104, 132, 0.2), rgba(148, 163, 184, 0.3));
    --tree-drop-indicator-color: light-dark(#3765ee, #8192ff);
    --tree-drag-over-bg: light-dark(rgba(59, 130, 246, 0.1), rgba(129, 146, 255, 0.15));
    background: transparent;
    overflow-y: auto;
    overflow-x: hidden;

    /* Transparent scrollbar background with visible scroll indicator */
    &::-webkit-scrollbar {
      width: 8px;
    }

    &::-webkit-scrollbar-track {
      background: transparent;
    }

    &::-webkit-scrollbar-thumb {
      background: light-dark(rgba(0, 0, 0, 0.2), rgba(255, 255, 255, 0.2));
      border-radius: 8px;
    }

    &::-webkit-scrollbar-thumb:hover {
      background: light-dark(rgba(0, 0, 0, 0.4), rgba(255, 255, 255, 0.3));
    }
  }

  .notebook-cover-mini {
    display: flex;
    align-items: center;
    pointer-events: none;
    flex-shrink: 0;
  }

  .node-content {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    color: light-dark(rgba(0, 0, 0, 0.85), rgba(255, 255, 255, 0.85));
    width: 100%;
    padding: 0.08rem 0;
    border-radius: 6px;
    transition:
      background-color 123ms ease-out,
      opacity 150ms ease-out,
      transform 150ms ease-out;
    background: transparent;
    border: none;
    font: inherit;
    cursor: default;
    text-align: left;

    &.loading {
      opacity: 0.6;
      cursor: default;

      .node-label {
        animation: pulse 1.5s ease-in-out infinite;
      }
    }

    &.note-content {
      cursor: default;
    }

    &.notebook-content {
      cursor: default;
    }
  }

  .node-label {
    font-size: 0.825rem;
    font-weight: 433;
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: light-dark(rgba(0, 0, 0, 0.85), rgba(255, 255, 255, 0.85));
    transition: opacity 150ms ease-out;
  }

  // Style drafts differently
  :global(.notebook-tree-sidebar [data-tree-node-id='drafts']) .node-label {
    font-style: italic;
    opacity: 0.8;
  }

  // Smooth loading transitions for ResourceLoader
  :global(.notebook-tree-sidebar) {
    // Add a subtle fade-in animation for new content
    .node-content {
      animation: fadeIn 200ms ease-out;
    }
  }

  @keyframes fadeIn {
    from {
      opacity: 0.7;
    }
    to {
      opacity: 1;
    }
  }

  @keyframes pulse {
    0%,
    100% {
      opacity: 0.6;
    }
    50% {
      opacity: 0.3;
    }
  }

  // Enhanced drag and drop styles provided by Tree component
  :global([data-dragging-item]) {
    opacity: 0.5;
    transform: scale(0.95);
  }

  // Hide drag previews for notebook tree
  :global([data-drag-preview]) {
    display: none !important;
  }

  // Loading placeholder
  .loading-placeholder {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 2rem;
    color: light-dark(rgba(0, 0, 0, 0.5), rgba(255, 255, 255, 0.5));
    font-style: italic;
    font-size: 0.825rem;
  }
</style>
