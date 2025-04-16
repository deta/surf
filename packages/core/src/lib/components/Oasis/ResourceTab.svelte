<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte'
  import { Resource, useResourceManager } from '../../service/resources'
  import { ResourceTypes, type TabResource } from '../../types'
  import { mimeTypeToCodeLanguage, useDebounce } from '@horizon/utils'
  import FilePreview from '../Resources/Previews/File/FilePreview.svelte'
  import TextResource from '../Resources/Previews/Text/TextResource.svelte'
  import CodeRenderer from '@horizon/core/src/lib/components/Chat/CodeRenderer.svelte'
  import { isGeneratedResource } from '@horizon/core/src/lib/utils/resourcePreview'

  export let tab: TabResource

  const resourceManager = useResourceManager()
  const dispatch = createEventDispatcher<{ 'update-tab': Partial<TabResource> }>()

  $: resourceId = tab.resourceId

  let resource: Resource | null = null

  const loadResource = async () => {
    if (!resourceId || resourceId === 'onboarding') {
      return
    }
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
        similaritySearch
        on:update-title={handleUpdateTitle}
        on:highlightWebviewText
        on:seekToTimestamp
      />
    {:else if isGeneratedResource(resource)}
      <CodeRenderer
        {resource}
        {tab}
        language={mimeTypeToCodeLanguage(resource.type)}
        showPreview
        fullSize
        initialCollapsed={false}
        collapsable={false}
      />
    {:else}
      <FilePreview {resource} preview={false} />
    {/if}
  {:else if resourceId === 'onboarding'}
    <TextResource
      {resourceId}
      showOnboarding
      similaritySearch
      on:update-title={handleUpdateTitle}
      on:highlightWebviewText
      on:seekToTimestamp
    />
  {:else if resourceId === 'onboarding-codegen'}
    <TextResource
      {resourceId}
      showCodegenOnboarding
      similaritySearch
      on:update-title={handleUpdateTitle}
      on:highlightWebviewText
      on:seekToTimestamp
      autofocus={false}
    />
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
