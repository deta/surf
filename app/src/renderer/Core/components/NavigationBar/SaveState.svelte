<script lang="ts">
  import { Icon } from '@deta/icons'
  import { type WebContentsView } from '@deta/services/views'
  import { Button } from '@deta/ui'
  import { useLogScope } from '@deta/utils'
  import OverlayPopover from '../Overlays/OverlayPopover.svelte'
  import { Notebook, useNotebookManager } from '@deta/services/notebooks'
  import { useResourceManager, type Resource } from '@deta/services/resources'
  import { writable } from 'svelte/store'

  let {
    view
  }: {
    view: WebContentsView
  } = $props()

  const log = useLogScope('SaveState')
  const resourceManager = useResourceManager()
  const notebookManager = useNotebookManager()

  let notebooks = notebookManager.notebooks

  let isMenuOpen = $state(false)
  let resource = $state<Resource | null>(null)

  let extractedResourceId = $derived(view.extractedResourceId)
  let isSaved = $derived(view.extractedResourceId && view.resourceCreatedByUser)
  let spaceIds = $derived(resource?.spaceIds ?? writable([]))

  $inspect(resource)

  $effect(() => {
    if ($extractedResourceId) {
      resourceManager.getResource($extractedResourceId).then((res) => {
        log.debug('Retrieved resource:', res)
        resource = res
      })
    }
  })

  async function selectNotebook(notebook: Notebook) {
    if (!$isSaved || !resource) {
      log.debug('Bookmarking page')
      resource = await view.bookmarkPage()
    }

    if (!resource) {
      log.error('Failed to retrieve resource')
      return
    }

    await notebookManager.addResourcesToNotebook(notebook.id, [resource.id])

    isMenuOpen = false
  }
</script>

<OverlayPopover bind:open={isMenuOpen} position="bottom">
  {#snippet trigger()}
    <Button size="md" style="padding-block: 6px;padding-inline: 8px;">
      {#if $isSaved}
        <Icon name="bookmarkFilled" size="1.085em" />
        Saved
      {:else}
        <Icon name="bookmark" size="1.085em" />
        Save
      {/if}
    </Button>
  {/snippet}

  <div class="list">
    {#each $notebooks as notebook (notebook.id)}
      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <button class="list-item" onclick={() => selectNotebook(notebook)}>
        {#if $spaceIds.includes(notebook.id)}
          <Icon name="check" />
        {:else}
          <Icon name="circle" />
        {/if}

        <div class="list-item-label">
          {notebook.dataValue.folderName || notebook.dataValue.name}
        </div>
      </button>
    {/each}
  </div>
</OverlayPopover>

<style lang="scss">
  .list {
    padding: 0;
    margin: 0;
    height: 100%;
    overflow-y: auto;
    list-style: none;

    .list-item {
      display: flex;
      align-items: center;
      gap: 0.25rem;
      padding: 8px 12px;
      width: 100%;
      border-bottom: 1px solid #eee;

      &:hover {
        background: darken(#eee, 5%);
      }
    }

    .list-item-label {
      font-size: 0.9em;
    }
  }
</style>
