<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte'
  import { Resource, useResourceManager } from '../../service/resources'
  import { ResourceTypes, type TabResource } from '../../types'
  import { getFileType, useDebounce } from '@horizon/utils'
  import FilePreview from '../Resources/Previews/File/FilePreview.svelte'
  import TextResource from '../Resources/Previews/Text/TextResource.svelte'

  export let tab: TabResource

  const resourceManager = useResourceManager()
  const dispatch = createEventDispatcher<{ 'update-tab': Partial<TabResource> }>()

  $: resourceId = tab.resourceId

  let resource: Resource | null = null

  const loadResource = async () => {
    resource = await resourceManager.getResource(resourceId)
  }

  const handleUpdateTitle = useDebounce((e: CustomEvent<string>) => {
    dispatch('update-tab', { title: e.detail })
  }, 500)

  onMount(async () => {
    await loadResource()
  })
</script>

<div class="wrapper bg-[#f8f7f2] dark:bg-[#181818]">
  {#if resource}
    {#if resource.type === ResourceTypes.DOCUMENT_SPACE_NOTE}
      <TextResource
        {resourceId}
        on:update-title={handleUpdateTitle}
        on:highlightWebviewText
        on:seekToTimestamp
      />
    {:else}
      <FilePreview {resource} preview={false} />
    {/if}
  {:else}
    <div class="loading">Loading...</div>
  {/if}
</div>

<style lang="scss">
  .wrapper {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    justify-content: center;
    border-radius: 0.5rem;
  }
</style>
