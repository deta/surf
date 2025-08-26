<script lang="ts">
  import { DynamicIcon } from '@deta/icons'
    import { useResourceManager } from '@deta/services/resources';
    import type { Fn } from '@deta/types';
  import { onMount, tick } from 'svelte'

  let {text, resourceId, icon, active, onclick, ...restProps}: {
          text?: string
          resourceId?:string, icon?:string, active?: boolean, onclick?: Fn
  } = $props()

  const resourceManager = useResourceManager()

  //export let text: string = 'Page Title'
  //export let icon: string = 'document'
  //export let active: boolean = false
  //export let resourceId: string | undefined = undefined
  //export let spaceId: string | undefined = undefined

  let displayText = $state(text ?? '')

  let isRenaming = false
  let renameInput: HTMLInputElement
  let originalText = text
  let tempText = text
  let mentionPageElement: HTMLSpanElement

  async function startRename() {
    isRenaming = true
    originalText = text
    tempText = text
    await tick()
    if (renameInput) {
      renameInput.focus()
      renameInput.select()
    }
  }

  //function confirmRename() {
  //  if (tempText.trim() && tempText !== originalText) {
  //    dispatch('rename', {
  //      oldText: originalText,
  //      newText: tempText.trim(),
  //      resourceId,
  //      spaceId
  //    })
  //    text = tempText.trim()
  //  }
  //  isRenaming = false
  //}

  //function cancelRename() {
  //  tempText = originalText
  //  isRenaming = false
  //}

  function handleRenameKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      event.preventDefault()
      confirmRename()
    } else if (event.key === 'Escape') {
      event.preventDefault()
      cancelRename()
    }
  }

  async function showDeleteConfirmation() {
    const result = await openDialog({
      icon: 'trash',
      title: 'Delete Page',
      message: `Are you sure you want to delete "${text}"? This action cannot be undone.`,
      actions: [
        { title: 'Cancel', type: 'reset' },
        { title: 'Delete', type: 'submit', kind: 'danger' }
      ]
    })

    if (result.closeType) {
      // Get the bounding rectangle and pass it with the delete event
      const rect = mentionPageElement?.getBoundingClientRect()

      dispatch('delete', {
        text,
        resourceId,
        spaceId,
        rect
      })
    }
  }

  onMount(async () => {
    if (resourceId && !text) {
      const resource = await resourceManager.getResource(resourceId)
      displayText = resource?.metadata.name
    }
  })
</script>

<span
  bind:this={mentionPageElement}
  class="mention-page"
  class:active
  class:renaming={isRenaming}
        {onclick}
  role="none"
  {...restProps}
>
  {#if icon}<DynamicIcon name={icon} size="19px" />{/if}
  {#if isRenaming}
    <input
      bind:this={renameInput}
      bind:value={tempText}
      onkeydown={handleRenameKeydown}
      onblur={confirmRename}
      class="rename-input"
      type="text"
    />
  {:else if text?.length === 0}
    <span class="text">null</span>
  {:else}
    <span class="text">{displayText}</span>
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

    font-family: 'Inter';
    font-weight: 500;

    user-select: none;
    color: inherit;
    padding: 2px 6px;
    border-radius: 8px;
    -electron-corner-smoothing: 60%;

    &:hover,
    &.active {
      background: rgba(0, 0, 0, 0.05);
    }

    &.renaming {
      background: rgba(0, 0, 0, 0.05);
    }

    > .text {
      text-decoration: underline;
      text-decoration-color: rgba(0, 0, 0, 0.1);
      text-underline-offset: 2px;
    }

    .rename-input {
      background: transparent;
      border: none;
      outline: none;
      font-family: inherit;
      font-weight: inherit;
      font-size: inherit;
      color: inherit;
      text-decoration: underline;
      text-decoration-color: rgba(0, 0, 0, 0.1);
      text-underline-offset: 2px;
      padding: 0;
      margin: 0;
      min-width: 50px;
      width: auto;
    }
  }
</style>
