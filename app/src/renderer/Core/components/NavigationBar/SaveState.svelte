<script lang="ts">
  import { Icon } from '@deta/icons'
  import { type WebContentsView } from '@deta/services/views'
  import { Button, SearchableList, type SearchableItem } from '@deta/ui'
  import { truncate, useLogScope } from '@deta/utils'
  import OverlayPopover from '../Overlays/OverlayPopover.svelte'
  import { Notebook, useNotebookManager } from '@deta/services/notebooks'
  import { useResourceManager, type Resource } from '@deta/services/resources'
  import { writable } from 'svelte/store'
  import { SpaceEntryOrigin } from '@deta/types'

  let {
    view
  }: {
    view: WebContentsView
  } = $props()

  const log = useLogScope('SaveState')
  const resourceManager = useResourceManager()
  const notebookManager = useNotebookManager()

  const notebooks = notebookManager.sortedNotebooks

  let isMenuOpen = $state(false)
  let resource = $state<Resource | null>(null)

  let extractedResourceId = $derived(view.extractedResourceId)
  let isSaved = $derived(view.extractedResourceId && view.resourceCreatedByUser)
  let spaceIds = $derived(resource?.spaceIds ?? writable([]))

  let notebookItems = $derived(
    notebooks.map(
      (notebook) =>
        ({
          id: notebook.id,
          label: truncate(notebook.nameValue, 28),
          icon: $spaceIds.includes(notebook.id) ? 'check' : 'circle',
          data: notebook
        }) as SearchableItem<Notebook>
    )
  )

  $inspect(resource)

  $effect(() => {
    if ($extractedResourceId) {
      resourceManager.getResource($extractedResourceId).then((res) => {
        log.debug('Retrieved resource:', res)
        resource = res
      })
    }
  })

  async function saveToSurf() {
    if (!$isSaved || !resource) {
      log.debug('Bookmarking page to Surf')
      resource = await view.bookmarkPage()
    }

    if (!resource) {
      log.error('Failed to retrieve resource')
      return
    }

    log.debug('Resource saved to Surf:', resource.id)
    isMenuOpen = false
  }

  async function selectNotebook(notebookId: string) {
    if (!$isSaved || !resource) {
      log.debug('Bookmarking page')
      resource = await view.bookmarkPage()
    }

    if (!resource) {
      log.error('Failed to retrieve resource')
      return
    }

    await notebookManager.addResourcesToNotebook(
      notebookId,
      [resource.id],
      SpaceEntryOrigin.ManuallyAdded,
      true
    )

    isMenuOpen = false
  }
</script>

<OverlayPopover bind:open={isMenuOpen} position="bottom">
  {#snippet trigger()}
    <Button size="md" square>
      {#if $isSaved}
        <Icon name="bookmarkFilled" size="1.085em" />
      {:else}
        <Icon name="bookmark" size="1.085em" />
      {/if}
    </Button>
  {/snippet}

  <div class="list">
    <!-- Save to Surf option -->
    <div class="save-section">
      {#if $isSaved}
        <button class="list-item save-to-surf" disabled>
          <Icon name="bookmarkFilled" />
          <div class="list-item-label">Added to Surf!</div>
        </button>
      {:else}
        <button class="list-item save-to-surf" onclick={saveToSurf}>
          <Icon name="bookmark" />
          <div class="list-item-label">Add to Surf</div>
        </button>
      {/if}
    </div>

    <!-- Notebooks section -->
    <div class="notebooks-section">
      <SearchableList
        items={notebookItems}
        searchPlaceholder="Search notebooks..."
        autofocus={false}
      >
        {#snippet itemRenderer(item)}
          <button class="list-item" onclick={() => selectNotebook(item.id)}>
            {#if $spaceIds.includes(item.id)}
              <Icon name="check" />
            {:else}
              <Icon name="circle" />
            {/if}

            <div class="list-item-label">
              {item.label}
            </div>
          </button>
        {/snippet}
      </SearchableList>
    </div>
  </div>
</OverlayPopover>

<style lang="scss">
  .list {
    --ctx-border: rgba(0, 0, 0, 0.175);
    --ctx-shadow-color: rgba(0, 0, 0, 0.12);
    --ctx-item-hover: var(--accent-background);
    --ctx-item-text: var(--on-surface-accent);
    --ctx-item-text-hover: var(--on-surface-accent);

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

    &.save-to-surf {
      background: rgba(59, 130, 246, 0.1);
      border: 1px solid rgba(59, 130, 246, 0.2);

      &:hover {
        background: rgba(59, 130, 246, 0.15);
        border-color: rgba(59, 130, 246, 0.3);
      }
    }
  }

  .save-section {
    padding: 0.25rem;
  }

  .divider {
    height: 1px;
    background: rgba(0, 0, 0, 0.1);
    margin: 0.5rem 0;
  }

  .notebooks-section {
    flex: 1;
    min-height: 0;
  }
</style>
