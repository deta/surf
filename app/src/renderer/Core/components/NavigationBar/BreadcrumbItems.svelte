<script lang="ts">
  import { constructBreadcrumbs } from './breadcrumbs'
  import { useNotebookManager } from '@deta/services/notebooks'
  import Breadcrumb from './Breadcrumb.svelte'
  import { truncate } from '@deta/utils'
  import { writable } from 'svelte/store'
  import type { WebContentsView } from '@deta/services/views'

  let {
    view
  }: {
    view: WebContentsView
  } = $props()

  const notebookManager = useNotebookManager()

  const activeLocation = $derived(view.url ?? writable(''))
  const activeHistory = $derived(view.navigationHistory)
  const activeHistoryIndex = $derived(view.navigationHistoryIndex)
  const extractedResourceId = $derived(view.extractedResourceId)
  const resourceCreatedByUser = $derived(view.resourceCreatedByUser)

  let breadcrumbs = $state([])
  $effect(
    async () =>
      (breadcrumbs = await constructBreadcrumbs(
        notebookManager,
        [...$activeHistory, { title: 'active', url: $activeLocation }],
        $activeHistoryIndex,
        view,
        $extractedResourceId,
        $resourceCreatedByUser
      ))
  )
</script>

{#each breadcrumbs as item, i}
  <Breadcrumb
    onclick={() => {
      //activeTab.view.webContents.loadURL($activeHistory.at(item.navigationIdx)?.url)
      //activeHistoryIndex.set(item.navigationIdx)
      view.webContents.loadURL(item.url)
    }}>{truncate(item.title, 28)}</Breadcrumb
  >
  {#if i < breadcrumbs.length}
    <Breadcrumb muted separator>›</Breadcrumb>
  {/if}
{/each}

<style lang="scss">
</style>
