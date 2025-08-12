<script lang="ts" context="module">
  export type CreateNewSpaceEvents = {
    'abort-space-creation': string
    'close-modal': void
    'creating-new-space': void
    'done-creating-new-space': void
    'update-existing-space': {
      space: OasisSpace
      name: string
      colors?: [string, string]
      emoji?: string
      imageIcon?: string
      processNaturalLanguage: boolean
      userPrompt: string
      blacklistedResourceIds: string[]
      llmFetchedResourceIds: string[]
    }
  }
</script>

<script lang="ts">
  import { onMount, onDestroy } from 'svelte'
  import { Icon } from '@deta/icons'
  import { useLogScope, useDebounce } from '@deta/utils'
  import { useResourceManager } from '../../service/resources'
  import SpaceIcon from '../Atoms/SpaceIcon.svelte'
  import { CreateSpaceEventFrom } from '@deta/types'
  import { writable, type Writable } from 'svelte/store'
  import { createEventDispatcher, tick } from 'svelte'
  import { fly, scale } from 'svelte/transition'
  import { quartOut } from 'svelte/easing'

  import { colorPairs, OasisSpace } from '../../service/oasis'
  import SpacePreview from './SpacePreview.svelte'
  import LoadingParticles from '../Effects/LoadingParticles.svelte'
  import type { SpaceIconChange } from './IconSelector.svelte'
  import { useAI } from '@horizon/core/src/lib/service/ai/ai'
  import OasisResourcesView from './ResourceViews/OasisResourcesView.svelte'

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
  const userPrompt = writable('')
  const colors = writable(colorPairs[Math.floor(Math.random() * colorPairs.length)])
  const userEnteredName = writable(false)
  const previewIDs = writable<PreviewID[]>([])
  const previewResources = writable<any[]>([])
  const fineTuneEnabled = writable(false)
  const isLoading = writable(false)
  const isTyping = writable(false)
  const resultEmpty = writable(false)
  const loadingIndex = writable(0)
  const pillContent = writable('')
  const clickedPill = writable(0)
  const activePillConfig = writable<PromptConfig['pill'] | null>(null)
  const resultHasSemanticSearch = writable(false)
  const blacklistedResources = writable<string[]>([])
  const selectedEmoji = writable<string | null>(null)
  const selectedImage = writable<string | null>(null)

  let shakeClass = ''

  const log = useLogScope('CreateNewSpace')
  const dispatch = createEventDispatcher<CreateNewSpaceEvents>()
  const resourceManager = useResourceManager()
  const ai = useAI()
  const telemetry = resourceManager.telemetry

  export let space: OasisSpace
  export let isCreatingNewSpace: Writable<boolean> = writable(false)

  const templatePrompts: PromptConfig[] = [
    { name: 'YouTube Videos', prompt: 'Youtube Videos' },
    { name: 'Images', prompt: 'All my Images' },
    { name: 'Notion Documents', prompt: 'Notion Documents' },
    { name: 'Github Pull Requests', prompt: 'Github Pull Requests' },
    {
      name: 'PDFs',
      prompt: 'Every PDF'
    }
  ]

  $: {
    if ($previewIDs.length > 0) {
      fineTuneEnabled.set(true)
    }
  }

  $: aiEnabled.set($userPrompt !== '')

  $: resultEmpty.set($previewIDs.length === 0 && $userPrompt !== '' && !$isLoading && !$isTyping)

  $: isCreateButtonDisabled = $name === '' && $userPrompt === ''

  $: if ($resultEmpty) {
    shakeClass = 'shake'
    setTimeout(() => {
      shakeClass = ''
    }, 500) // Duration of the animation
  }

  $: log.debug('create new space', space)

  const handleAbortSpaceCreation = () => {
    dispatch('abort-space-creation', space.id)
  }

  const handleSubmit = async () => {
    const sanitizedUserPrompt = $userPrompt.replace(/<\/?[^>]+(>|$)/g, '')
    const spaceName = $name || sanitizedUserPrompt

    dispatch('update-existing-space', {
      name: spaceName,
      space: space,
      colors: $colors,
      emoji: $selectedEmoji ?? undefined,
      imageIcon: $selectedImage ?? undefined,
      processNaturalLanguage: $aiEnabled,
      userPrompt: sanitizedUserPrompt,

      blacklistedResourceIds: $previewIDs.filter((id) => id.blacklisted).map((id) => id.id),
      llmFetchedResourceIds: $previewIDs.filter((id) => !id.blacklisted).map((id) => id.id)
    })
    dispatch('close-modal')

    await telemetry.trackCreateSpace(CreateSpaceEventFrom.OasisSpacesView, {
      isLiveSpace: false,
      createdUsingAI: $aiEnabled,
      numberOfPrompts: $loadingIndex,
      numberOfBlacklistedItems: $previewIDs.filter((id) => id.blacklisted).length
    })
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

  const previewAISpace = async (prompt: string, semanticThreshold?: number) => {
    let actionCancelled = false
    isTyping.set(false)
    isLoading.set(true)
    try {
      log.debug('Requesting preview with prompt', prompt)

      const options: {
        embeddingQuery?: string
        embeddingDistanceThreshold?: number
      } = {
        embeddingQuery: prompt,
        embeddingDistanceThreshold: semanticThreshold
      }

      const response = await ai.getResourcesViaPrompt(prompt, options)

      if (prompt !== $userPrompt) {
        log.debug(`Outdated Preview Response`, response)
        actionCancelled = true
        return
      }

      log.debug(`Preview response`, response)

      resultHasSemanticSearch.set(
        !!(response.embedding_search_results && response.embedding_search_results.length > 0)
      )

      const results = new Set([
        ...(response.embedding_search_results ?? []),
        ...(response.sql_query_results ?? [])
      ])

      const resourceIds = Array.from(results).map((id) => ({
        id,
        blacklisted: $blacklistedResources.includes(id)
      }))

      previewIDs.set(resourceIds)

      if (resourceIds.length > 0) {
        const loadedResources = await Promise.all(
          resourceIds
            .filter((id) => !id.blacklisted)
            .map((id) => resourceManager.getResourceWithAnnotations(id.id))
        )
        const filteredResources = loadedResources.filter((resource) => resource !== null)
        previewResources.set(filteredResources)
      } else {
        previewResources.set([])
      }

      if (!results) {
        log.warn('No results found for', prompt, response)
        return
      }
    } catch (err) {
      previewIDs.set([])
      log.error('Failed to create previews with AI', err)
    } finally {
      if (!actionCancelled) {
        loadingIndex.set($loadingIndex + 1)
      }

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

  const debouncedPreviewAISpace = useDebounce(previewAISpace, 860)

  const resetSmartFetchingState = () => {
    previewIDs.set([])
    previewResources.set([])
    isLoading.set(false)
    isTyping.set(false)
    aiEnabled.set(false)
    fineTuneEnabled.set(false)
    userPrompt.set('')
  }

  const handleEditorUpdate = () => {
    if ($userPrompt === '') {
      resetSmartFetchingState()
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

  const handleBlacklistResource = (event: CustomEvent<string>) => {
    const resourceId = event.detail
    previewIDs.update((ids) =>
      ids.map((id) => (id.id === resourceId ? { ...id, blacklisted: true } : id))
    )

    blacklistedResources.update((resourceIDs) => {
      return [...resourceIDs, resourceId]
    })
  }

  const handleWhitelistResource = (event: CustomEvent<string>) => {
    const resourceId = event.detail
    previewIDs.update((ids) =>
      ids.map((id) => (id.id === resourceId ? { ...id, blacklisted: false } : id))
    )

    blacklistedResources.update((resourceIDs) => {
      return resourceIDs.filter((id) => id !== resourceId)
    })
  }

  const handleSpaceIconUpdate = (event: CustomEvent<SpaceIconChange>) => {
    log.debug('Changed icon', event.detail)
    const { colors: updatedColors, emoji, imageIcon } = event.detail
    if (updatedColors) {
      colors.set(updatedColors)
    }

    selectedEmoji.set(emoji ?? null)
    selectedImage.set(imageIcon ?? null)
  }

  onMount(async () => {
    if (isCreatingNewSpace) {
      isCreatingNewSpace.set(true)
    }
    dispatch('creating-new-space')
  })

  onDestroy(() => {
    if (isCreatingNewSpace) {
      isCreatingNewSpace.set(false)
    }
    dispatch('done-creating-new-space')
  })
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

<div
  class="flex flex-col items-center justify-center p-3 h-full w-full bg-[#f6faff] dark:bg-gray-900 overflow-y-auto pb-48 border border-natural-100 border-l-natural-100 dark:border-gray-800 text-gray-900 dark:text-gray-100"
>
  <div
    class="top-bar top-0 left-0 right-0 absolute flex justify-between items-center w-[calc(100%-1.75rem)] px-4 py-2 bg-white dark:bg-gray-800 z-50 border border-gray-200 dark:border-gray-700"
    style="border-bottom-width: 0.5px; margin: 0.75rem; border-radius: 12px;"
  >
    <div class="input-wrapper flex-grow">
      <input
        type="text"
        class="folder-name w-full text-xl font-medium text-gray-700 dark:text-gray-100 bg-transparent border-none focus:outline-none"
        id="folder-name"
        name="folder-name"
        placeholder="Enter Context Name"
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
      <button on:click={handleAbortSpaceCreation} class="cancel-button px-4 py-2">Cancel</button>
      <button
        on:click={handleSubmit}
        class="create-button px-4 py-2 text-white dark:text-gray-100 bg-blue-500 dark:bg-blue-500 rounded-md hover:bg-blue-600 dark:hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-400 dark:disabled:bg-gray-700 disabled:hover:bg-gray-400 dark:disabled:hover:bg-gray-700"
        disabled={isCreateButtonDisabled}>Create</button
      >
    </div>
  </div>
  {#if !$fineTuneEnabled}
    <div class="flex flex-col justify-center items-center">
      <div
        class="space-icon-wrapper transform active:scale-[98%] relative {shakeClass}"
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
              <SpacePreview resources={previewResources} origin="smartcontext" />
            {/key}
          </div>
        {/if}
        <div class="relative z-0">
          {#if space}
            <div
              class="w-full h-full aspect-square bg-white dark:bg-gray-800/95 rounded-full flex items-center justify-center"
            >
              <SpaceIcon
                on:update={handleSpaceIconUpdate}
                folder={space}
                size="2xl"
                round
                isCreating
              />
            </div>
            <p class="text-center py-6 text-gray-600 dark:text-gray-400">
              Click the circle to change the icon.
            </p>
          {/if}
        </div>
      </div>
    </div>
    <!-- </ResourceOverlay> -->
  {:else}
    {#key $loadingIndex}
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
        <OasisResourcesView
          resources={previewResources}
          searchValue={undefined}
          resourcesBlacklistable={true}
          on:blacklist-resource={handleBlacklistResource}
          on:whitelist-resource={handleWhitelistResource}
          interactive={false}
        />
      </div>
    {/key}
  {/if}
  <div
    class="input-group absolute transition-all duration-300 z-20"
    class:bottom-0={!$fineTuneEnabled}
    class:bottom-6={$fineTuneEnabled}
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
      class="ai-voodoo bg-white/95 dark:bg-gray-800/95 backdrop-blur-md px-8 pt-4 pb-4 mb-20 mt-4 rounded-[3rem] relative border-[0.5px] border-gray-200 dark:border-gray-800 border-opacity-20"
      class:loading={$fineTuneEnabled && $isLoading}
    >
      {#if $aiEnabled && $fineTuneEnabled}
        <div
          class="ai-description text-gray-900 dark:text-gray-100 bg-sky-50 dark:bg-sky-900"
          transition:fly={{
            y: 20,
            duration: 420,
            opacity: 0,
            easing: quartOut
          }}
        >
          <span>
            Surf will automatically add content that match your description to this context.
          </span>
          <Icon name="sparkles.fill" size="22px" className="text-[#29A6F3] dark:text-sky-100" />
        </div>
      {/if}
      {#if $previewIDs.length > 0 || $fineTuneEnabled}
        <div class="flex justify-center -mt-12">
          <button
            class={$fineTuneEnabled
              ? 'fine-tune-button bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold py-2 px-4 rounded-full shadow-md transition duration-300 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-opacity-50'
              : 'fine-tune-button bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2 px-4 rounded-full shadow-md transition duration-300 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50'}
            on:click={() => resetSmartFetchingState()}
          >
            {$fineTuneEnabled ? 'Cancel' : 'Show Grid View'}
          </button>
        </div>
      {/if}
      <div class="input-wrapper z-20">
        <div
          class="folder-rules text-gray-900 dark:text-gray-100"
          data-tooltip-target="smart-space-description"
        >
          {#if $activePillConfig}
            <div class="prompt-with-pill text-gray-900 dark:text-gray-100">
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
              <input
                class="w-full border-none focus:outline-none font-medium"
                type="text"
                placeholder="Describe your context for auto-fetching."
                bind:value={$userPrompt}
                on:input={handleEditorUpdate}
              />
            {/key}
          {/if}
        </div>
      </div>

      <!-- {#if $fineTuneEnabled && $resultHasSemanticSearch && $userPrompt !== $previousUserPrompt}
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
            class="w-full h-2 bg-gray-200 rounded-lg appearance-none "
          />
          <div class="flex justify-between text-xs text-gray-600 mt-1">
            <span>Ignore Semantic</span>
            <span>Recommended</span>
            <span>Wider Range</span>
          </div>
        </div>
      {/if} -->
      {#if !$fineTuneEnabled}
        <div class="template-prompts">
          <div class="prompt-pills mt-4 mb-4">
            {#each templatePrompts as template}
              <button
                class={`prompt-pill ${
                  $userPrompt.startsWith(template.prompt)
                    ? 'bg-blue-200 dark:bg-blue-700 text-gray-800 dark:text-gray-100'
                    : 'bg-blue-50 dark:bg-gray-700 text-gray-600/80 dark:text-gray-100'
                } rounded-full px-4 py-2 text-sm font-medium hover:bg-blue-100 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2`}
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
      class="empty-state-container flex flex-col items-center justify-center h-full absolute inset-0 pointer-events-none z-10 bg-gray-100"
    >
      <div class="empty-state-icon mb-6">
        <Icon name="sparkles.fill" size="64px" color="#e5e5e5" />
      </div>
      <h3 class="empty-state-title text-2xl font-semibold text-gray-800 mb-2">
        Create Empty Context
      </h3>
      <p class="empty-state-description text-gray-600 text-center max-w-md">
        future items will be<br /> dropped here.
      </p>
    </div>
  {/if}
</div>

<style lang="scss">
  @keyframes shake {
    0% {
      transform: translateX(0) rotate(0);
    }
    10% {
      transform: translateX(-5px) rotate(-1deg);
    }
    20% {
      transform: translateX(5px) rotate(1deg);
    }
    30% {
      transform: translateX(-5px) rotate(-1deg);
    }
    40% {
      transform: translateX(5px) rotate(1deg);
    }
    50% {
      transform: translateX(-5px) rotate(-1deg);
    }
    60% {
      transform: translateX(5px) rotate(1deg);
    }
    70% {
      transform: translateX(-5px) rotate(-1deg);
    }
    80% {
      transform: translateX(5px) rotate(1deg);
    }
    90% {
      transform: translateX(-3px) rotate(-0.5deg);
    }
    100% {
      transform: translateX(0) rotate(0);
    }
  }

  .shake {
    animation: shake 1.5s cubic-bezier(0.36, 0.07, 0.19, 0.97) both;
  }

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
    position: absolute;
    width: -webkit-fill-available;
    height: 100%;
    top: 4.75rem;
    overflow-y: auto;
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

  .ai-voodoo {
    box-shadow:
      0 1px 2px rgba(10, 20, 30, 0.2),
      0 2px 4px rgba(10, 20, 30, 0.012),
      0 4px 8px rgba(10, 20, 30, 0.09),
      0 8px 16px rgba(10, 20, 30, 0.05);
    outline: 4px solid rgba(56, 189, 248, 0.6);
    backdrop-filter: blur(16px);
    &.loading {
      outline: 3px solid transparent;
      animation: moving-gradient 1s ease-in-out infinite;
      box-shadow:
        0 1px 2px rgba(186, 230, 253, 0.9),
        0 2px 4px rgba(186, 230, 253, 0.8),
        0 4px 8px rgba(186, 230, 253, 0.7),
        0 8px 16px rgba(186, 230, 253, 0.9);
    }
  }

  @keyframes moving-gradient {
    0% {
      outline-color: transparent;
    }
    25% {
      outline-color: rgba(56, 189, 248, 0.5);
    }
    50% {
      outline-color: rgba(56, 189, 248, 1);
    }
    75% {
      outline-color: rgba(56, 189, 248, 0.5);
    }
    100% {
      outline-color: transparent;
    }
  }

  .input-group {
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .input-wrapper {
    display: flex;
    justify-content: center;
    align-items: center;
    position: relative;
    width: 28rem;
    padding-left: 0.75rem;
  }

  .folder-rules {
    font-size: 1.25rem;
    background: transparent;
    font-weight: 500;
    min-width: 28rem;
    margin-top: 8px;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    border: none;
    padding: 0.5rem 0.5rem;
    width: 100%;
    color: #28568f;
    transition: border-color 0.3s;
    text-align: left;

    &::placeholder {
      color: rgba(40, 86, 143, 0.4);
      :global(.dark) & {
        color: rgba(186, 230, 253, 0.4);
      }
      text-align: left;
    }

    &:focus {
      outline: none;
    }
  }

  .ai-description {
    position: absolute;
    bottom: -64px;
    right: 50%;
    transform: translateX(50%) rotate(0.75deg);
    display: flex;
    align-items: center;
    gap: 2rem;
    opacity: 0.8;
    width: 100%;
    max-width: 24rem;
    font-weight: 500;
    font-size: 0.875rem;
    text-align: left;
    padding: 0.5rem 0 0.5rem 1rem;
    border-radius: 8px;
    border: 0.5px solid rgba(41, 128, 185, 0.2);
    box-shadow:
      0 1px 2px rgba(186, 230, 253, 0.9),
      0 2px 4px rgba(186, 230, 253, 0.8),
      0 4px 8px rgba(186, 230, 253, 0.7),
      0 8px 16px rgba(186, 230, 253, 0.9);

    :global(.dark) & {
      border: 0.5px solid rgba(41, 128, 185, 0.2);
      box-shadow:
        0 1px 2px rgba(30, 58, 138, 0.9),
        0 2px 4px rgba(30, 58, 138, 0.8),
        0 4px 8px rgba(30, 58, 138, 0.7),
        0 8px 16px rgba(30, 58, 138, 0.9);
    }

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
  }

  .cancel-button {
    background-color: #fff;
    color: #28568f;

    @apply bg-white text-[#28568f]  dark:text-gray-100 dark:bg-gray-800 hover:bg-gray-300 dark:hover:bg-gray-700 transition-colors rounded-xl;
  }

  .cancel-button:hover {
    background-color: #d1edff;
    color: #173861;

    @apply hover:bg-[#d1edff] hover:text-[#173861] dark:hover:bg-gray-700 dark:hover:text-gray-100;
  }

  .create-button {
    color: #fff;
  }

  .create-button:hover {
    background-color: #29a6f3;
  }

  .template-prompts {
    width: 30rem;
    margin-top: 1rem;
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
