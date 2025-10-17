<script lang="ts">
  import { useResourceManager, getResourceCtxItems, type Resource } from '@deta/services/resources'
  import { useNotebookManager } from '@deta/services/notebooks'
  import { DynamicIcon } from '@deta/icons'
  import { contextMenu, openDialog, type CtxItem} from "@deta/ui"
  import { SpaceEntryOrigin, type Fn } from '@deta/types';
  import { clickOutside, truncate } from '@deta/utils'
  import { onMount } from 'svelte'

  let {
    resource,
    sourceNotebookId,
    text = $bindable(),
    placeholder = '',
    icon, 
    editing = false,
    active, 
    onclick, 
    oncancel,
    onclose,
    onchange, 
    onrename,
    ...restProps
  }: {
    resource?: Resource;
    sourceNotebookId?: string
    text?: string
    placeholder?: string
    icon?: string
    editing: boolean
    active?: boolean
    onclick?: Fn
    oncancel?: Fn
    onclose?: Fn
    onchange?: (value: String) => void
    onrename?: Fn
  } = $props()

    const resourceManager = useResourceManager()
    const notebookManager = useNotebookManager()


  let editorEl: HTMLSpanElement = $state()
  let title = $derived(resource?.metadata?.name ?? text)

  const handleClose = () => {
    onchange?.(editorEl?.textContent)
    onclose?.()
  }

  $effect(() => {
    if (!editorEl) return

    editorEl.focus()
    const range = document.createRange()
    range.selectNodeContents(editorEl)
    const sel = window.getSelection()
    sel!.removeAllRanges()
    sel!.addRange(range)
  })

  const handleDeleteResource = async () => {
    const { closeType: confirmed } = await openDialog({
      title: `Delete <i>${truncate('Note', 26)}</i>`, // note.metadata.name
      message: `This can't be undone.`,
      actions: [
        { title: 'Cancel', type: 'reset' },
        { title: 'Delete', type: 'submit', kind: 'danger' }
      ]
    })
    if (!confirmed) return

    await notebookManager.deleteResourcesFromSurf(resource.id, true)
  }

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

  const CTX_MENU_ITEMS: CtxItem[] = $derived(resource ?
    [
        {
          type: 'action',
          text: 'Rename',
          icon: 'edit',
          action: () => onrename?.()
        },
      ...getResourceCtxItems({
              resource,
              sortedNotebooks: notebookManager.sortedNotebooks,
              onAddToNotebook: handleAddToNotebook,
              onDeleteResource: handleDeleteResource,
              onRemove: !sourceNotebookId ? undefined : () => handleRemoveFromNotebook(sourceNotebookId)
       })
     ] : null
  )

    </script>

<span
  {...restProps}
  class="mention-page"
  class:active
  class:editing
  role="none"
  {onclick}
  {@attach contextMenu({
    canOpen: resource != undefined,
    items: CTX_MENU_ITEMS
  })}
>
  {#if icon}<DynamicIcon name={icon} size="19px" />{/if}

  {#if !editing}
    <span class="text">{title}</span>
  {:else}
    <span
      bind:this={editorEl}
      bind:textContent={title}
      contenteditable="true"
      class="text"
      spellcheck="false"
      role="none"
      {placeholder}
      onkeydown={(e) => {
        if (e.key === 'Escape') {
          e.preventDefault()
          oncancel?.()
        }
        else if (e.key === 'Enter') {
          e.preventDefault()
          handleClose()
        }
      }}
      {@attach clickOutside(() => handleClose())}
    ></span>
  {/if}
</span>

<style lang="scss">
  .mention-page {
    display: inline-block;
    display: flex;
    justify-content: left;
    align-items: center;
    gap: 0.4ch;
    width: max-content;
                  max-width: 100%;
                  white-space: nowrap;

    font-family: 'Inter';
    font-weight: 500;

    user-select: none;
    color: color-mix(in oklch, currentColor, transparent 40%);
    padding: 2px 6px;
    border-radius: 8px;
    -electron-corner-smoothing: system-ui;
    text-overflow: ellipsis;
    overflow:hidden;

          transition-property: background, color;
                  transition-duration: 52ms;
                  transition-timing-function: ease-out;


    &:hover,
    &.active,
    &.editing,
    &:global([data-context-menu-anchor]) {
      background: light-dark(rgba(0, 0, 0, 0.05), rgba(255, 255, 255, 0.08));
    color: color-mix(in oklch, currentColor, transparent 10%);
    }

    > .text {
      text-decoration: underline;
      text-decoration-color: light-dark(rgba(0, 0, 0, 0.1), rgba(255, 255, 255, 0.15));
      text-decoration-color: color-mix(in oklch, currentColor, transparent 90%);
      text-underline-offset: 2px;

      &:empty:before {
        content: attr(placeholder);
        color: light-dark(rgba(0, 0, 0, 0.175), rgba(255, 255, 255, 0.4));
        pointer-events: none;
        user-select: none;
      }


      &:focus, &:focus-within {
        outline: none;
      }
    }

    &.editing > .text {
      text-decoration-style: dashed;
    }
  }
  :global([data-context-menu-anchor] .mention-page) {
    background: light-dark(rgba(0, 0, 0, 0.05), rgba(255, 255, 255, 0.08));
  }
</style>
