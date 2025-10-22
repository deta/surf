<script lang="ts">
  import { Icon } from '@deta/icons'
  import { ViewType, type WebContentsView } from '@deta/services/views'
  import { Button, SearchableList, type SearchableItem, SourceCard } from '@deta/ui'
  import { truncate, useLogScope } from '@deta/utils'
  import OverlayPopover from '../Overlays/OverlayPopover.svelte'
  import { Notebook, NotebookManagerEvents, useNotebookManager } from '@deta/services/notebooks'
  import { useResourceManager, type Resource } from '@deta/services/resources'
  import { writable } from 'svelte/store'
  import { ResourceTypes, SpaceEntryOrigin, type Fn } from '@deta/types'

  let {
    view
  }: {
    view: WebContentsView
  } = $props()

  const log = useLogScope('SaveState')
  const resourceManager = useResourceManager()
  const notebookManager = useNotebookManager()

  const notebooks = notebookManager.sortedNotebooks

  let searchableList: SearchableList
  let unsubResourceDeleted: Fn | null = null

  let isMenuOpen = $state(false)
  let resource = $state<Resource | null>(null)
  let searchValue = $state('')

  const activeViewType = $derived(view.type ?? writable(''))
  const activeViewTypeData = $derived(view.typeData ?? writable({ id: null }))

  let extractedResourceId = $derived(
    $activeViewType === ViewType.Page ? view.extractedResourceId : writable($activeViewTypeData.id)
  )
  let isSaved = $derived(
    $activeViewType === ViewType.Page
      ? view.extractedResourceId && view.resourceCreatedByUser
      : writable(true)
  )
  let spaceIds = $derived(resource?.spaceIds ?? writable([]))

  let notebookItems = $derived(
    notebooks
      .sort((a, b) => {
        // Sort notebooks in spaceIds to the top
        const aInSpace = $spaceIds.includes(a.id)
        const bInSpace = $spaceIds.includes(b.id)
        if (aInSpace && !bInSpace) return -1
        if (!aInSpace && bInSpace) return 1
        return 0
      })
      .map(
        (notebook) =>
          ({
            id: notebook.id,
            label: truncate(notebook.nameValue, 28),
            icon: $spaceIds.includes(notebook.id) ? 'check' : 'circle',
            data: notebook
          }) as SearchableItem<Notebook>
      )
  )

  $effect(() => {
    if ($extractedResourceId) {
      resourceManager.getResource($extractedResourceId).then((res) => {
        log.debug('Retrieved resource:', res)
        resource = res
      })

      unsubResourceDeleted = notebookManager.on(
        NotebookManagerEvents.DeletedResource,
        (deletedResourceId) => {
          if (deletedResourceId === $extractedResourceId) {
            view.setExtractedResourceId(null, false)
            resource = null
          }
        }
      )
    }

    return () => {
      if (unsubResourceDeleted) {
        unsubResourceDeleted()
        unsubResourceDeleted = null
      }
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
    // isMenuOpen = false
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

    if ($spaceIds.includes(notebookId)) {
      await notebookManager.removeResourcesFromNotebook(notebookId, [resource.id], true)
    } else {
      await notebookManager.addResourcesToNotebook(
        notebookId,
        [resource.id],
        SpaceEntryOrigin.ManuallyAdded,
        true
      )
    }

    searchValue = ''
    searchableList?.focus()
    // isMenuOpen = false
  }
</script>

<OverlayPopover bind:open={isMenuOpen} position="bottom" autofocus>
  {#snippet trigger()}
    <div class="wrapper">
      <Button size="fill" square>
        {#if $isSaved}
          <Icon name="notebook.saved" size="22px" />
        {:else}
          <Icon name="notebook.unsaved" size="22px" />
        {/if}
      </Button>
    </div>
  {/snippet}

  <div class="list">
    <!-- Save to Surf option -->
    <div class="save-section">
      {#if $isSaved}
        {#if resource.url}
          <SourceCard
            --width={'5rem'}
            --max-width={''}
            {resource}
            text
            showSaved
            permanentlyTilted
            interactive={false}
          />
        {:else if resource.type !== ResourceTypes.DOCUMENT_SPACE_NOTE}
          <button class="list-item save-to-surf" disabled>
            <Icon name="check" size="19px" color="rgb(6, 158, 54)" />
            <div class="list-item-label">Added to Surf!</div>
          </button>
        {/if}
      {:else}
        <button class="list-item save-to-surf" onclick={saveToSurf}>
          <Icon name="save" />
          <div class="list-item-label">Add to Surf</div>
        </button>
      {/if}
    </div>

    {#if !resource || resource.type !== ResourceTypes.DOCUMENT_SPACE_NOTE}
      <hr class="divider" />
    {/if}

    <!-- Notebooks section -->
    <div class="notebooks-section">
      <SearchableList
        bind:this={searchableList}
        bind:value={searchValue}
        items={notebookItems}
        searchPlaceholder="Search notebooks to add to..."
        autofocus={true}
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
    --ctx-border: light-dark(
      var(--border-subtle, rgba(0, 0, 0, 0.175)),
      var(--border-subtle-dark, rgba(71, 85, 105, 0.4))
    );
    --ctx-shadow-color: light-dark(
      var(--shadow-soft, rgba(0, 0, 0, 0.12)),
      var(--shadow-soft-dark, rgba(15, 23, 42, 0.45))
    );
    --ctx-item-hover: light-dark(
      var(--accent-background, #f3f5ff),
      var(--accent-background-dark, #1e2639)
    );
    --ctx-item-text: light-dark(
      var(--on-surface-accent, #330988),
      var(--on-surface-accent-dark, #a5b4ff)
    );
    --ctx-item-text-hover: light-dark(
      var(--on-surface-accent, #330988),
      var(--on-surface-accent-dark, #c7d2ff)
    );

    padding: 0;
    margin: 0;
    height: fit-content;
    max-height: 400px;
    list-style: none;
    padding: 0.225rem;
    border-radius: 12px;
    border: 0.5px solid var(--ctx-border);
    box-shadow: 0 2px 10px var(--ctx-shadow-color);
    background: light-dark(var(--surface-elevated, #fff), var(--surface-elevated-dark, #1b2435));
    color: light-dark(rgba(0, 0, 0, 0.9), rgba(255, 255, 255, 0.9));
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
      color: light-dark(rgba(0, 0, 0, 0.85), rgba(255, 255, 255, 0.85));

      &:hover {
        background: var(--ctx-item-hover);
        color: var(--ctx-item-text-hover);
      }

      &:disabled {
        color: light-dark(rgba(0, 0, 0, 0.6), rgba(255, 255, 255, 0.6));
      }

      &.save-to-surf {
        background: light-dark(
          color-mix(in srgb, var(--accent, #3b82f6) 10%, transparent),
          color-mix(in srgb, var(--accent-dark, #82a2ff) 20%, transparent)
        );
        border: 1px solid
          light-dark(
            color-mix(in srgb, var(--accent, #3b82f6) 20%, transparent),
            color-mix(in srgb, var(--accent-dark, #82a2ff) 35%, transparent)
          );
        color: light-dark(rgba(0, 0, 0, 0.85), rgba(255, 255, 255, 0.9));

        &:hover {
          background: light-dark(
            color-mix(in srgb, var(--accent, #3b82f6) 15%, transparent),
            color-mix(in srgb, var(--accent-dark, #82a2ff) 30%, transparent)
          );
          border-color: light-dark(
            color-mix(in srgb, var(--accent, #3b82f6) 30%, transparent),
            color-mix(in srgb, var(--accent-dark, #82a2ff) 45%, transparent)
          );
        }
      }
    }

    .list-item-label {
      font-size: 0.9em;
      color: inherit;
    }
  }

  .wrapper {
    margin: 0 4px;
  }

  .save-section {
    padding: 0.25rem;
    padding-left: 0.5rem;
    padding-top: 0.5rem;
    user-select: none;
  }

  .divider {
    height: 1px;
    background: light-dark(
      var(--border-subtle, rgba(0, 0, 0, 0.1)),
      var(--border-subtle-dark, rgba(71, 85, 105, 0.4))
    );
    margin: 0.5rem 0;
  }

  .notebooks-section {
    flex: 1;
    min-height: 0;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }
</style>
