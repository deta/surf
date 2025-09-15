<script lang="ts">
  import { Icon } from '@deta/icons'
  import { useBrowser } from '@deta/services/browser'
  import { useNotebookManager } from '@deta/services/notebooks'
  import { useResourceManager, type Resource } from '@deta/services/resources'
  import type { TabItem } from '@deta/services/tabs'
  import { constructBreadcrumbs } from './breadcrumbs'
  import type { Option } from '@deta/types'
  import {
    Button,
    closeContextMenu,
    CONTEXT_MENU_KEY,
    openContextMenu,
    openDialog,
    type CtxItem
  } from '@deta/ui'
  import { useLogScope } from '@deta/utils'
  import type { WebContentsView } from '@deta/services/views'

  let { resource, tab, view }: { resource: Resource; tab: Option<TabItem>; view: WebContentsView } =
    $props()

  const log = useLogScope('NoteMenu')
  const browser = useBrowser()
  const resourceManager = useResourceManager()
  const notebookManager = useNotebookManager()
  const activeLocation = $derived(view.url ?? writable(''))

  const activeHistory = $derived(view.navigationHistory)
  const activeHistoryIndex = $derived(view.navigationHistoryIndex)

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

  const onDeleteNote = async () => {
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
        view.webContents.loadURL('surf://notebook')
      }
    } catch (err) {
      log.error('Failed to delete note', err)
    }
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
      kind: 'danger',
      text: 'Delete',
      icon: 'trash',
      action: onDeleteNote
    }
  ]
</script>

<!-- TODO: Maxu we should have proper overlay menu component -->
<Button
  size="md"
  square
  active={$CONTEXT_MENU_KEY === '_note-actions'}
  onclick={() => {
    if ($CONTEXT_MENU_KEY === '_note-actions') closeContextMenu()
    else
      openContextMenu({
        key: '_note-actions',
        useOverlay: true,
        x: window.innerWidth - 185,
        y: 82,
        //targetEl: ref,
        items: CTX_MENU_ITEMS
      })
  }}
>
  <Icon name="dots.vertical" size="1.085em" />
</Button>
