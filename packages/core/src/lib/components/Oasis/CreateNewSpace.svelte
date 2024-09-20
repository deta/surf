<script lang="ts">
  import { Icon } from '@horizon/icons'
  import { useLogScope, useDebounce } from '@horizon/utils'
  import { useResourceManager } from '../../service/resources'
  import SpaceIcon from '../Atoms/SpaceIcon.svelte'
  import { writable, derived } from 'svelte/store'
  import { createEventDispatcher, tick } from 'svelte'
  import { Editor } from '@horizon/editor'
  import { fly, scale } from 'svelte/transition'
  import { quartOut } from 'svelte/easing'
  import { superPrompt } from './prompt'

  import { colorPairs } from '../../service/oasis'
  import ResourceOverlay from '../Core/ResourceOverlay.svelte'
  import SpacePreview from './SpacePreview.svelte'
  import LoadingParticles from '../Effects/LoadingParticles.svelte'
  import OasisResourcesViewSearchResult from '../Oasis/OasisResourcesViewSearchResult.svelte'

  import { type Space } from '../../types'

  interface PromptConfig {
    name: string
    prompt: string
    pill?: {
      placeholder: string
      position: 'after'
    }
  }

  interface PreviewID {
    id: string
    blacklisted: boolean
  }

  const aiEnabled = writable(false)
  const name = writable('')
  const userPrompt = writable('<p></p>')
  const colors = writable(colorPairs[Math.floor(Math.random() * colorPairs.length)])
  const dispatch = createEventDispatcher()
  const userEnteredName = writable(false)
  const previewIDs = writable<PreviewID[]>([])
  const previewResources = writable<any[]>([])
  const fineTuneEnabled = writable(false)
  const isLoading = writable(false)
  const pillContent = writable('')
  const clickedPill = writable(0)
  const activePillConfig = writable<PromptConfig['pill'] | null>(null)
  const semanticSearchThreshold = writable(0.4)
  const semanticInputValue = writable(0.4)
  const resultHasSemanticSearch = writable(false)
  let editor: Editor

  const log = useLogScope('OasisSpace')
  const resourceManager = useResourceManager()

  export let space: Space

  const templatePrompts: PromptConfig[] = [
    { name: 'Images', prompt: 'All my Images' },
    { name: 'Notion Documents', prompt: 'All my Notion Documents' },
    { name: 'YouTube Videos', prompt: 'Youtube Videos' },
    {
      name: 'Articles',
      prompt: 'Articles about',
      pill: {
        placeholder: 'Enter topic',
        position: 'after'
      }
    },
    {
      name: 'PDFs',
      prompt: 'Every PDF'
    }
  ]

  $: {
    if ($previewIDs.length > 0) {
      fineTuneEnabled.set(true)
    } else {
      if ($userPrompt === '<p></p>') {
        fineTuneEnabled.set(false)
      }
    }
  }

  $: aiEnabled.set($userPrompt !== '<p></p>')

  const newSpace = () => {
    const now = new Date().toISOString()
    return {
      id: 'new',
      name: {
        folderName: 'New Space',
        colors: $colors,
        showInSidebar: true,
        sources: [],
        liveModeEnabled: false,
        hideViewed: false,
        smartFilterQuery: null,
        sortBy: 'created_at'
      },
      created_at: now,
      updated_at: now,
      deleted: 0
    }
  }

  const handleAbortSpaceCreation = () => {
    dispatch('abort-space-creation', space.id)
  }

  const handleColorChange = async (event: CustomEvent<[string, string]>) => {
    colors.set(event.detail)
  }

  const handleSubmit = () => {
    const sanitizedUserPrompt = $userPrompt.replace(/<\/?[^>]+(>|$)/g, '')
    const spaceName = $name || sanitizedUserPrompt

    dispatch('update-existing-space', {
      name: spaceName,
      space: $space,
      processNaturalLanguage: $aiEnabled,
      userPrompt: sanitizedUserPrompt,

      blacklistedResourceIds: $previewIDs.filter((id) => id.blacklisted).map((id) => id.id),
      llmFetchedResourceIds: $previewIDs.filter((id) => !id.blacklisted).map((id) => id.id)
    })
    dispatch('close-modal')
  }

  const handleTemplatePromptClick = async (template: PromptConfig) => {
    $clickedPill = $clickedPill + 1
    if (template.pill) {
      userPrompt.set(`${template.prompt} `)
      activePillConfig.set(template.pill)
      pillContent.set('')
    } else {
      userPrompt.set(template.prompt)
      activePillConfig.set(null)
    }
    aiEnabled.set(true)
    if (!$userEnteredName || templatePrompts.some((t) => t.name === $name)) {
      name.set(template.name)
    }

    await previewAISpace($userPrompt)
  }

  const previewAISpace = async (userPrompt: string, semanticThreshold?: number) => {
    isLoading.set(true)
    try {
      log.debug('Requesting preview with prompt', userPrompt)

      const options: {
        embedding_query?: string
        embedding_distance_threshold?: number
      } = {
        embedding_query: userPrompt,
        embedding_distance_threshold: semanticThreshold
      }

      const response = await resourceManager.getResourcesViaPrompt(userPrompt, options)

      log.debug(`Preview response`, response)

      resultHasSemanticSearch.set(
        !!(response.embedding_search_results && response.embedding_search_results.length > 0)
      )

      const results = new Set([
        ...(response.embedding_search_results ?? []),
        ...(response.sql_query_results ?? [])
      ])

      const resourceIds = Array.from(results).map((id) => ({ id, blacklisted: false }))

      log.debug('Fetched resource IDs', resourceIds)

      previewIDs.set(resourceIds)

      if (resourceIds.length > 0) {
        const loadedResources = await Promise.all(
          resourceIds.map((id) => resourceManager.getResourceWithAnnotations(id.id))
        )
        previewResources.set(loadedResources)
        console.log('xxx-loadedresources', loadedResources)
      } else {
        console.log('xxx-reset')
        previewResources.set([])
      }

      if (!results) {
        log.warn('No results found for', userPrompt, response)
        return
      }
    } catch (err) {
      previewIDs.set([])
      log.error('Failed to create previews with AI', err)
    } finally {
      isLoading.set(false)
      await tick()
    }
  }

  const handleNameInput = () => {
    if ($name === '') {
      userEnteredName.set(false)
    } else {
      userEnteredName.set(true)
    }
  }

  const debouncedPreviewAISpace = useDebounce(previewAISpace, 500)

  const handleEditorUpdate = (event) => {
    userPrompt.set(event.detail)

    if (event.detail === '<p></p>') {
      previewIDs.set([])
      return
    }

    debouncedPreviewAISpace($userPrompt)
  }

  const handlePillInput = (event: Event) => {
    const target = event.target as HTMLElement
    pillContent.set(target.textContent || '')
    const activePrompt = templatePrompts.find((p) => p.pill === $activePillConfig)
    if (activePrompt) {
      debouncedPreviewAISpace(`${activePrompt.prompt} ${$pillContent}`)
    }
  }

  const handleBlacklistResource = (event) => {
    const resourceId = event.detail
    previewIDs.update((ids) =>
      ids.map((id) => (id.id === resourceId ? { ...id, blacklisted: true } : id))
    )
  }

  const handleWhitelistResource = (event) => {
    const resourceId = event.detail
    previewIDs.update((ids) =>
      ids.map((id) => (id.id === resourceId ? { ...id, blacklisted: false } : id))
    )
  }

  $: isCreateButtonDisabled = $name === '' && $userPrompt === '<p></p>'
</script>

<svelte:window
  on:keydown={(e) => {
    if (e.key === 'Escape') {
      handleAbortSpaceCreation()
    } else if (e.key === 'Tab') {
      e.preventDefault()
      e.stopPropagation()
      e.stopImmediatePropagation()
    }
  }}
/>

<div class="centered-content">
  <div
    class="top-bar fixed top-0 right-0 flex justify-between items-center w-[calc(100%-18rem)] px-4 py-2 bg-white z-50 border-b border-gray-200"
    style="border-bottom-width: 0.5px;"
  >
    <div class="input-wrapper flex-grow">
      <input
        type="text"
        class="folder-name w-full text-lg font-medium text-gray-700 bg-transparent border-none focus:outline-none"
        id="folder-name"
        name="folder-name"
        placeholder="Enter Space Name"
        bind:value={$name}
        on:input={handleNameInput}
        tabindex="0"
        autofocus
        on:keydown={(e) => {
          if (e.key === 'Tab') {
            e.stopPropagation()
            e.stopImmediatePropagation()
          }
        }}
      />
    </div>
    <div class="button-group flex space-x-2 ml-4">
      <button
        on:click={handleAbortSpaceCreation}
        class="cancel-button px-4 py-2 text-gray-600 bg-gray-200 rounded-md hover:bg-gray-300 transition-colors"
        >Cancel</button
      >
      <button
        on:click={handleSubmit}
        class="create-button px-4 py-2 text-white bg-blue-500 rounded-md hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-400 disabled:hover:bg-gray-400"
        disabled={isCreateButtonDisabled}>Create</button
      >
    </div>
  </div>
  {#if !$fineTuneEnabled}
    <ResourceOverlay
      caption="Click to change color."
      interactive={$previewIDs.length === 0 ? true : false}
    >
      <div
        slot="content"
        class="space-icon-wrapper transform active:scale-[98%] relative"
        class:has-preview={$previewIDs.length > 0}
        transition:scale={{ duration: 300, easing: quartOut }}
      >
        {#if $isLoading}
          <div
            class={`absolute inset-4 z-20 flex items-center justify-center ${$previewIDs.length > 0 ? 'pt-[12rem]' : ''}`}
          >
            <LoadingParticles size={$previewIDs.length === 0 ? 300 : 700} />
          </div>
        {/if}
        {#if $previewIDs.length > 0}
          <div class="absolute inset-0 z-10">
            {#key $previewIDs}
              <SpacePreview
                resourceIDs={$previewIDs.filter((id) => !id.blacklisted).map((id) => id.id)}
                showHeader={false}
              />
            {/key}
          </div>
        {/if}
        <div class="relative z-0">
          <SpaceIcon on:change={handleColorChange} folder={newSpace()} />
        </div>
      </div>
    </ResourceOverlay>
  {:else}
    {#key $isLoading && $previewIDs}
      <div
        class="preview-resources-wrapper"
        in:fly={{
          y: 20,
          opacity: 0,
          duration: 300,
          delay: 150
        }}
        out:fly={{
          y: -20,
          opacity: 0,
          duration: 200
        }}
      >
        <OasisResourcesViewSearchResult
          resources={previewResources}
          resourcesBlacklistable={true}
          on:blacklist-resource={handleBlacklistResource}
          on:whitelist-resource={handleWhitelistResource}
        />
      </div>
    {/key}
  {/if}
  <div
    class="input-group absolute transition-all duration-300"
    class:bottom-0={$fineTuneEnabled}
    class:bottom-4={!$fineTuneEnabled}
  >
    {#if $isLoading && $fineTuneEnabled}
      <div
        class={`absolute inset-4 flex items-center justify-center ${$previewIDs.length > 0 ? 'pt-[12rem]' : ''}`}
        in:fly={{
          y: 20,
          duration: 420,
          opacity: 1,
          easing: quartOut
        }}
        out:fly={{
          y: 20,
          duration: 420,
          opacity: 0,
          easing: quartOut
        }}
      >
        <LoadingParticles size={$previewIDs.length === 0 ? 300 : 700} />
      </div>
    {/if}
    <div
      class="ai-voodoo bg-white/95 backdrop-blur-md px-12 pt-8 pb-8 mb-16 mt-4 rounded-[3rem] relative border-[0.5px] border-opacity-20"
    >
      {#if $aiEnabled && !$fineTuneEnabled}
        <div
          class="ai-description"
          transition:fly={{
            y: 20,
            duration: 420,
            opacity: 0,
            easing: quartOut
          }}
        >
          <span
            >Surf will from now automatically add content to your space that matches your
            description.</span
          >
          <Icon name="sparkles.fill" size="22px" color="#29A6F3" />
        </div>
      {/if}
      {#if $previewIDs.length > 0 || $fineTuneEnabled}
        <div class="flex justify-center -mt-12">
          <button
            class={$fineTuneEnabled
              ? 'fine-tune-button bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold py-2 px-4 rounded-full shadow-md transition duration-300 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-opacity-50'
              : 'fine-tune-button bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2 px-4 rounded-full shadow-md transition duration-300 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50'}
            on:click={() => fineTuneEnabled.set(!$fineTuneEnabled)}
          >
            {$fineTuneEnabled ? 'Back' : 'Show Grid View'}
          </button>
        </div>
      {/if}
      <div class="input-wrapper">
        <div class="folder-rules">
          {#if $activePillConfig}
            <div class="prompt-with-pill">
              <span>{$userPrompt}</span>
              <div
                class="pill-content"
                contenteditable="true"
                on:input={handlePillInput}
                on:focus={() => activePillConfig.set($activePillConfig)}
                on:blur={() => activePillConfig.set($pillContent !== '' ? $activePillConfig : null)}
              >
                {$pillContent}
              </div>
            </div>
          {:else}
            {#key $clickedPill}
              <Editor
                bind:this={editor}
                content={$userPrompt}
                on:update={handleEditorUpdate}
                placeholder="Describe what you want in your space. (optional)"
                tabindex="1"
                autofocus={false}
                on:keydown={(e) => {
                  if (e.key === 'Tab') {
                    e.stopPropagation()
                    e.stopImmediatePropagation()
                  }
                }}
              />
            {/key}
          {/if}
        </div>
      </div>

      {#if $fineTuneEnabled && $resultHasSemanticSearch}
        <div class="semantic-search-threshold-slider p-4">
          <label
            for="semantic-search-threshold"
            class="block text-sm font-medium text-gray-700 mb-2"
          >
            Prescision
          </label>
          <input
            type="range"
            id="semantic-search-threshold"
            name="semantic-search-threshold"
            min="0"
            max="1"
            bind:value={$semanticInputValue}
            step="0.01"
            on:change={() => {
              previewAISpace($userPrompt, $semanticInputValue)
            }}
            class="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
          />
          <div class="flex justify-between text-xs text-gray-600 mt-1">
            <span>Ignore Semantic</span>
            <span>Recommended</span>
            <span>Wider Range</span>
          </div>
        </div>
      {/if}
      {#if !$fineTuneEnabled}
        <div class="template-prompts">
          <div class="prompt-pills mt-8 mb-4">
            {#each templatePrompts as template}
              <button
                class={`prompt-pill ${
                  $userPrompt.startsWith(template.prompt)
                    ? 'bg-blue-200 text-blue-800'
                    : 'bg-gray-100 text-gray-800'
                } rounded-full px-4 py-2 text-sm font-medium hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2`}
                on:click={async () => await handleTemplatePromptClick(template)}
              >
                {template.prompt}
                {#if template.pill}
                  <span class="pill-placeholder">{template.pill.placeholder}</span>
                {/if}
              </button>
            {/each}
          </div>
        </div>
      {/if}
    </div>
  </div>
  {#if $fineTuneEnabled && $previewIDs.length === 0}
    <div
      class="empty-state-container flex flex-col items-center justify-center h-full absolute inset-0 pointer-events-none"
    >
      <div class="empty-state-icon mb-6">
        <Icon name="sparkles.fill" size="64px" color="#e5e5e5" />
      </div>
      <h3 class="empty-state-title text-2xl font-semibold text-gray-800 mb-2">
        No resources found
      </h3>
      <p class="empty-state-description text-gray-600 text-center max-w-md">
        Try adjusting your query.
      </p>
    </div>
  {/if}
</div>

<style lang="scss">
  .centered-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100vh;
    width: 100%;
    background: #f6faff;
    background: color(display-p3 0.9661 0.9801 1);
    overflow-y: auto;
    padding-bottom: 12rem;
  }

  .preview-resources-wrapper {
    width: -webkit-fill-available;
    height: calc(100vh - 4rem);
    position: fixed;
    top: 4rem;
    overflow-y: auto;
  }

  h2 {
    margin: 0 0 2rem;
    font-size: 1.25rem;
    font-weight: 500;
    color: #28568f;
    opacity: 0.4;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }

  .space-icon-wrapper {
    width: 16rem;
    height: 16rem;
    margin-bottom: 2rem;
    transition: all 0.3s ease-in-out;

    &.has-preview {
      width: 36rem;
      height: 26rem;
    }
  }

  .input-group {
    display: flex;
    flex-direction: column;
    align-items: center;
    margin-bottom: 2rem;
  }

  .input-wrapper {
    display: flex;
    justify-content: center;
    align-items: center;
    position: relative;
    width: 28rem;
  }

  .folder-name {
    font-size: 1.25rem;
    background: transparent;
    font-weight: 500;
    min-width: 25rem;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    border: none;
    padding: 0.5rem;
    width: 100%;
    color: #28568f;
    transition: border-color 0.3s;

    &::placeholder {
      color: rgba(40, 86, 143, 0.4);
    }

    &:focus {
      outline: none;
    }
  }

  .folder-rules {
    font-size: 1.25rem;
    background: transparent;
    font-weight: 500;
    min-width: 25rem;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    border: none;
    padding: 0.5rem;
    width: 100%;
    color: #28568f;
    transition: border-color 0.3s;
    text-align: left;

    &::placeholder {
      color: rgba(40, 86, 143, 0.4);
      text-align: left;
    }

    &:focus {
      outline: none;
    }
  }

  .ai-description {
    position: absolute;
    bottom: -32px;
    right: 50%;
    transform: translateX(50%) rotate(0.75deg);
    display: flex;
    align-items: center;
    gap: 2rem;
    opacity: 0.6;
    width: 100%;
    max-width: 24rem;
    font-weight: 500;
    font-size: 0.875rem;
    color: #28568f;
    text-align: left;
    padding: 0.5rem 0 0.5rem 1rem;
    background-color: #e1f0ff;
    border-radius: 8px;
    border: 0.5px solid rgba(41, 128, 185, 0.2);
    box-shadow:
      0 1px 2px rgba(186, 230, 253, 0.9),
      0 2px 4px rgba(186, 230, 253, 0.8),
      0 4px 8px rgba(186, 230, 253, 0.7),
      0 8px 16px rgba(186, 230, 253, 0.9);
    span {
      width: 80%;
    }
  }

  .button-group {
    display: flex;
    justify-content: center;
    gap: 1rem;
  }

  .cancel-button,
  .create-button {
    font-weight: 500;
    font-size: 1.125rem;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    padding: 1rem 1.5rem;
    border: none;
    border-radius: 12px;
    cursor: pointer;
  }

  .cancel-button {
    background-color: #fff;
    color: #28568f;
  }

  .cancel-button:hover {
    background-color: #d1edff;
    color: #173861;
  }

  .create-button {
    color: #fff;
  }

  .create-button:hover {
    background-color: #29a6f3;
  }

  .template-prompts {
    width: 28rem;
    margin-top: 1rem;
  }

  .template-prompts h3 {
    font-size: 1rem;
    font-weight: 500;
    color: #28568f;
    margin-bottom: 0.5rem;
  }

  .prompt-pills {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .prompt-pill {
    display: flex;
    align-items: center;
    white-space: nowrap;
  }

  .prompt-with-pill {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    font-size: 1.25rem;
    color: #28568f;
    padding: 0.5rem;
  }

  .pill-content {
    display: inline-block;
    background-color: #e1f0ff;
    border-radius: 20px;
    padding: 0.25rem 0.75rem;
    margin: 0.25rem 0.5rem;
    min-width: 100px;
    outline: none;

    &:empty::before {
      content: attr(data-placeholder);
      color: rgba(40, 86, 143, 0.4);
    }

    &:focus {
      box-shadow: 0 0 0 2px #47b1f3;
    }
  }

  .pill-placeholder {
    opacity: 0.6;
    font-style: italic;
    margin-left: 0.5rem;
  }
</style>
