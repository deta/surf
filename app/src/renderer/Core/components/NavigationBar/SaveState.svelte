<script lang="ts">
  import { Icon } from '@deta/icons'
  import { type WebContentsView } from '@deta/services/views'
  import { Button } from '@deta/ui'
  import { truncate, useLogScope } from '@deta/utils'
  import OverlayPopover from '../Overlays/OverlayPopover.svelte'
  import { Notebook, useNotebookManager } from '@deta/services/notebooks'
  import { MaskedScroll } from '@deta/ui'
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
    <Button size="md" square>
      {#if $isSaved}
        <Icon name="bookmarkFilled" size="1.085em" />
        <!--Saved-->
      {:else}
        <Icon name="bookmark" size="1.085em" />
        <!-- Save-->
      {/if}
    </Button>
  {/snippet}

  <div class="list">
    <MaskedScroll>
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
            {truncate(notebook.dataValue.folderName || notebook.dataValue.name, 28)}
          </div>
        </button>
      {/each}
    </MaskedScroll>
  </div>
</OverlayPopover>

<style lang="scss">
  .list {
    --ctx-border: rgba(0, 0, 0, 0.175);
    --ctx-shadow-color: rgba(0, 0, 0, 0.12);
    --ctx-item-hover: rgba(0, 0, 0, 0.06);
    --ctx-item-text: #210e1f;
    --ctx-item-text-hover: #000;

    padding: 0;
    margin: 0;
    height: fit-content;
    max-height: 400px;
    list-style: none;
    padding: 0.225rem;
    border-radius: 12px;
    border: 0.5px solid var(--ctx-border);
    box-shadow: 0 2px 10px var(--ctx-shadow-color);
    background: #fff;
    font-size: 0.95rem;
    display: flex;
    flex-direction: column;

    .list-item {
      display: flex;
      align-items: center;
      gap: 0.25rem;
      padding: 0.4em 0.55em;
      padding-bottom: 0.385rem;
      border-radius: 9px;
      width: 100%;

      &:hover {
        background: var(--ctx-item-hover);
        color: var(--ctx-item-text-hover);
      }
    }

    .list-item-label {
      font-size: 0.9em;
    }
  }
</style>
