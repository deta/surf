<script lang="ts">
  import { writable } from 'svelte/store'
  import { Icon } from '@deta/icons'
  import { useBrowser } from '@deta/services/browser'
  import { useNotebookManager } from '@deta/services/notebooks'
  import { useResourceManager, type Resource } from '@deta/services/resources'
  import type { TabItem } from '@deta/services/tabs'
  import { constructBreadcrumbs } from './breadcrumbs'
  import { isWebResourceType, ResourceTypes, ViewType, type Option } from '@deta/types'
  import {
    Button,
    closeContextMenu,
    CONTEXT_MENU_KEY,
    openContextMenu,
    type CtxItem
  } from '@deta/ui'
  import { conditionalArrayItem, isMac, useLogScope } from '@deta/utils'
  import type { WebContentsView } from '@deta/services/views'

  let {
    resource,
    tab,
    view
  }: { resource?: Resource; tab: Option<TabItem>; view: WebContentsView } = $props()

  const log = useLogScope('NoteMenu')
  const browser = useBrowser()
  const resourceManager = useResourceManager()
  const notebookManager = useNotebookManager()
  const activeLocation = $derived(view.url ?? writable(''))
  const viewType = $derived(view.type)

  const activeHistory = $derived(view.navigationHistory)
  const activeHistoryIndex = $derived(view.navigationHistoryIndex)

  let buttonTrigger

  // TODO: is there a better way to get breadcrumbs??
  let breadcrumbs = $state([])
  $effect(
    async () =>
      (breadcrumbs = await constructBreadcrumbs(
        notebookManager,
        [...$activeHistory, { title: 'active', url: $activeLocation }],
        $activeHistoryIndex,
        view
      ))
  )

  const onDeleteResource = async () => {
    // TODO: we need to make dialogs overlay everything and communicate
    //const { closeType: confirmed } = await openDialog({
    //  title: `Delete <i>${truncate(resource.metadata.name, 26)}</i>`,
    //  message: `This can't be undone.`,
    //  actions: [
    //    { title: 'Cancel', type: 'reset' },
    //    { title: 'Delete', type: 'submit', kind: 'danger' }
    //  ]
    //})
    //if (!confirmed) return
    log.debug('current breadcrumbs', breadcrumbs)
    try {
      // TODO: don't know yet why the current note is not part of the breadcrumb?
      let breadcrumbIndex = breadcrumbs.length - 1
      const targetBreadcrumb = breadcrumbs[breadcrumbIndex]
      await resourceManager.deleteResource(resource.id)

      log.debug('targetBreadcrumb', targetBreadcrumb)
      if (targetBreadcrumb) {
        view.webContents.loadURL(targetBreadcrumb.url)
      } else {
        view.webContents.loadURL('surf://surf/notebook')
      }
    } catch (err) {
      log.error('Failed to delete resource', err)
    }
  }

  const handleOpenAsFile = () => {
    // @ts-ignore
    window.api.openResourceLocally(resource.id)
  }

  const handleExport = () => {
    // @ts-ignore
    window.api.exportResource(resource.id)
  }

  const handleOpenResource = (offline: boolean) => {
    browser.openResource(resource.id, { offline, target: tab ? 'active_tab' : 'sidebar' })
  }

  const CTX_MENU_ITEMS: CtxItem[] = [
    tab !== undefined
      ? {
          type: 'action',
          text: 'Open in Sidebar',
          icon: 'sidebar.right',
          action: () => browser.moveTabToSidebar(tab)
        }
      : {
          type: 'action',
          text: 'Open as Tab',
          icon: 'arrow.up.right',
          action: () => browser.moveSidebarViewToTab()
        },

    {
      type: 'action',
      text: 'Copy URL',
      icon: 'copy',
      action: () => (tab ? tab.copyURL() : view.copyURL())
    },

    ...conditionalArrayItem<CtxItem>(!tab, [
      { type: 'separator' },
      {
        type: 'action',
        text: 'Reload Page',
        icon: 'reload',
        action: () => view.webContents.reload()
      },
      {
        type: 'action',
        text: 'Go Back',
        icon: 'arrow.left',
        action: () => view.webContents.goBack()
      },
      {
        type: 'action',
        text: 'Go Forward',
        icon: 'arrow.right',
        action: () => view.webContents.goForward()
      }
    ]),

    ...conditionalArrayItem<CtxItem>(!!resource, { type: 'separator' }),

    ...conditionalArrayItem<CtxItem>(resource && isWebResourceType(resource.type), [
      $viewType === ViewType.Resource
        ? {
            type: 'action',
            text: 'View Live Version',
            icon: 'world',
            action: () => handleOpenResource(false)
          }
        : {
            type: 'action',
            text: 'View Offline Version',
            icon: 'save',
            action: () => handleOpenResource(true)
          }
    ]),

    ...conditionalArrayItem<CtxItem>(!!resource, {
      type: 'action',
      text: isMac() ? 'Reveal in Finder' : 'Show in Explorer',
      icon: 'folder.open',
      action: () => handleOpenAsFile()
    }),

    ...conditionalArrayItem<CtxItem>(resource?.type === ResourceTypes.DOCUMENT_SPACE_NOTE, {
      type: 'action',
      text: 'Export as Markdown',
      icon: 'save',
      action: () => handleExport()
    }),

    ...conditionalArrayItem<CtxItem>(!!resource, [
      {
        type: 'action',
        kind: 'danger',
        text: 'Delete from Surf',
        icon: 'trash',
        action: onDeleteResource
      }
    ])
  ]
</script>

<!-- TODO: Maxu we should have proper overlay menu component -->
<Button
  bind:ref={buttonTrigger}
  size="md"
  square
  active={$CONTEXT_MENU_KEY === '_note-actions'}
  onclick={() => {
    if ($CONTEXT_MENU_KEY === '_note-actions') closeContextMenu()
    else {
      const rect = (buttonTrigger.ref as HTMLButtonElement).getBoundingClientRect()
      openContextMenu({
        key: '_note-actions',
        useOverlay: true,
        x: rect.right - 185,
        y: rect.bottom,
        targetEl: buttonTrigger.ref,
        items: CTX_MENU_ITEMS
      })
    }
  }}
>
  <Icon name="dots.vertical" size="1.085em" />
</Button>
