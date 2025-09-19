<script lang="ts">
  import { onMount } from 'svelte'
  import { useResourceManager, type Resource, getResourceCtxItems } from '@deta/services/resources'
  import { contextMenu, openDialog, type CtxItem } from '@deta/ui'
  import { useNotebookManager } from '@deta/services/notebooks'
  import { truncate } from '@deta/utils'
  import { type OpenTarget, SpaceEntryOrigin } from '@deta/types'
  import { handleResourceClick, openResource } from '../../handlers/notebookOpenHandlers'

  let { resource, sourceNotebookId }: { resource: Resource; sourceNotebookId?: string } = $props()

  const resourceManager = useResourceManager()
  const notebookManager = useNotebookManager()

  const handleAddToNotebook = (notebookId: string) => {
    notebookManager.addResourcesToNotebook(
      notebookId,
      [resource.id],
      SpaceEntryOrigin.ManuallyAdded,
      true
    )
  }

  const handleRemoveFromNotebook = (notebookId: string) => {
    notebookManager.removeResourcesFromNotebook(notebookId, [resource.id], true)
  }

  const CTX_MENU_ITEMS: CtxItem[] = $derived(
    getResourceCtxItems({
      resource,
      sortedNotebooks: notebookManager.sortedNotebooks,
      onOpen: (target: OpenTarget) => openResource(resource.id, { target, offline: false }),
      onAddToNotebook: (id: string) => handleAddToNotebook(id),
      onDeleteResource: async (resourceId: string) => {
        const { closeType: confirmed } = await openDialog({
          title: `Delete Note?</i>`,
          message: `This can't be undone..`,
          actions: [
            { title: 'Cancel', type: 'reset' },
            { title: 'Delete', type: 'submit', kind: 'danger' }
          ]
        })
        if (!confirmed) return

        notebookManager.removeResources(resourceId, sourceNotebookId ?? undefined, true)
      },
      onRemove: !sourceNotebookId ? undefined : () => handleRemoveFromNotebook(sourceNotebookId)
    })
  )
</script>

<li
  {@attach contextMenu({
    canOpen: true,
    items: CTX_MENU_ITEMS
  })}
  onclick={(e) => handleResourceClick(resource.id, e)}
>
  <span>{resource.metadata.name}</span>
</li>

<style lang="scss">
  li {
    padding: 0.5em;
    border-radius: 8px;
    overflow: hidden;

    &:hover,
    &:global([data-context-menu-anchor]) {
      background: rgba(0, 0, 0, 0.05);
    }

    span {
      //display: -webkit-box;
      -webkit-box-orient: vertical;
      -webkit-line-clamp: 1;
      overflow: hidden;
      leading-trim: both;
      text-edge: cap;
      text-overflow: ellipsis;
      font-family: Inter;
      font-style: normal;
      font-weight: 400;
      line-height: 0.9355rem; /* 106.916% */

      overflow: hidden;
      display: -webkit-box;
      -webkit-line-clamp: 1;
      -webkit-box-orient: vertical;

      &:not(.active) {
        opacity: 0.5;
      }
    }
  }
</style>
