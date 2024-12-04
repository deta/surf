<script lang="ts">
  import { Icon } from '@horizon/icons'
  import Button from '../../Atoms/Button.svelte'
  import { writable } from 'svelte/store'
  import type { ResourceManager } from '@horizon/core/src/lib/service/resources'
  import { ResourceTag } from '../../../service/resources'
  import { extractAndCreateWebResource } from '../../../service/mediaImporter'
  import { type OnboardingTab } from '../../../constants/examples'
  import { fade, fly } from 'svelte/transition'
  import { quintOut } from 'svelte/easing'
  import { type Resource } from '@horizon/core/src/lib/service/resources'
  import { createEventDispatcher } from 'svelte'

  interface OnboardingTab {
    title: string
    url: string
  }

  export let onboardingResources: OnboardingTab[]
  export let resourceManager: ResourceManager

  const dispatch = createEventDispatcher<{
    resourcesSaved: { resources: Resource[] }
  }>()

  const savedTabs = writable<{ [key: string]: boolean }>({})
  const savingTabs = writable<{ [key: string]: boolean }>({})
  const savingTimeouts = writable<{ [key: string]: number }>({})
  const savedStack = writable<OnboardingTab[]>([])
  const allSaved = writable<boolean>(false)
  const isSaving = writable<boolean>(false)

  const savingMessages = [
    'Extracting content...',
    'Almost there...',
    'Loading... (seriously)',
    "Rome wasn't built in a day..."
  ]

  const getButtonClass = (isSuccess: boolean) => {
    if (isSuccess) {
      return 'bg-green-500 border-green-600 hover:bg-green-500'
    }
    return 'hover:opacity-80 transition-opacity'
  }

  $: {
    if (Object.values($savedTabs).filter(Boolean).length === onboardingResources.length) {
      allSaved.set(true)
    }
  }

  $: remainingTabs = onboardingResources.filter((tab) => !$savedTabs[tab.url])
  $: hasRemainingTabs = remainingTabs.length > 0
  $: stackHeight = $savedStack.length * 84

  const saveResource = async (tab: OnboardingTab) => {
    const resource = await extractAndCreateWebResource(
      resourceManager,
      tab.url,
      {
        sourceURI: tab.url
      },
      [ResourceTag.canonicalURL(tab.url)]
    )

    dispatch('resourcesSaved', { resources: [resource] })

    return resource
  }

  const handleSaveDemo = async () => {
    if ($isSaving || !hasRemainingTabs) return

    isSaving.set(true)
    const unsavedTabs = onboardingResources.filter((tab) => !$savedTabs[tab.url])
    const savedResourcesList: Resource[] = []

    const savePromises = unsavedTabs.map(async (tab) => {
      savingTabs.update((saving) => ({ ...saving, [tab.url]: true }))

      let messageIndex = 0
      const messageInterval = setInterval(() => {
        messageIndex = (messageIndex + 1) % savingMessages.length
        savingTimeouts.update((timeouts) => ({ ...timeouts, [tab.url]: messageIndex }))
      }, 3000)

      try {
        await saveResource(tab)
        savedTabs.update((saved) => ({ ...saved, [tab.url]: true }))
        savedStack.update((stack) => [...stack, tab])
      } finally {
        clearInterval(messageInterval)
        savingTabs.update((saving) => ({ ...saving, [tab.url]: false }))
      }
    })

    await Promise.all(savePromises)
    isSaving.set(false)
  }

  const handleSaveTab = async (tab: OnboardingTab) => {
    if ($savingTabs[tab.url] || $savedTabs[tab.url]) return

    savingTabs.update((saving) => ({ ...saving, [tab.url]: true }))

    let messageIndex = 0
    const messageInterval = setInterval(() => {
      messageIndex = (messageIndex + 1) % savingMessages.length
      savingTimeouts.update((timeouts) => ({ ...timeouts, [tab.url]: messageIndex }))
    }, 3000)

    try {
      await saveResource(tab)
      savedTabs.update((saved) => ({ ...saved, [tab.url]: true }))
      savedStack.update((stack) => [...stack, tab])
    } finally {
      clearInterval(messageInterval)
      savingTabs.update((saving) => ({ ...saving, [tab.url]: false }))
    }
  }
</script>

<section
  class="w-full min-h-screen flex flex-col items-center justify-center relative z-10 p-4 md:!p-8 lg:!p-32"
>
  <div
    class="flex flex-col lg:!flex-row gap-8 lg:!gap-24 w-full max-w-full lg:!max-w-7xl mx-auto z-50"
  >
    <div
      class="flex flex-col items-start justify-center gap-6 rounded-3xl p-8 w-full lg:!w-1/3 shrink-0"
    >
      <Icon name="save" color="white" size="44" />
      <h1
        class="font-gambarino text-3xl md:!text-4xl text-white leading-tight [text-shadow:0_1px_2px_rgba(0,0,0,0.1)]"
      >
        Save Anything.
      </h1>
      <p class="text-white text-lg md:!text-xl [text-shadow:0_1px_2px_rgba(0,0,0,0.1)]">
        Save and organize what you think is important.
      </p>
      <div class="relative h-10 w-64">
        <Button
          on:click={handleSaveDemo}
          disabled={!hasRemainingTabs || $isSaving}
          class={getButtonClass(false)}
          style={$allSaved ? 'opacity: 0; pointer-events: none;' : ''}
        >
          <div class="relative overflow-hidden h-6">
            <span
              class="absolute inset-0 flex items-center justify-center transition-transform duration-300"
              style="transform: translateY({$isSaving ? '-100%' : '0'});"
            >
              {$allSaved ? 'All items Saved' : 'Save all Demo Items'}
            </span>
            <span
              class="absolute inset-0 flex items-center justify-center transition-transform duration-300"
              style="transform: translateY({$isSaving ? '0' : '100%'});"
            >
              Saving Items...
            </span>
          </div>
        </Button>
      </div>
    </div>

    <div class="flex-1 flex flex-col justify-center relative min-h-[400px] max-w-full">
      <div class="relative w-full flex flex-col items-center">
        <div
          class="w-full transition-all duration-500"
          class:opacity-0={!hasRemainingTabs}
          class:invisible={!hasRemainingTabs}
        >
          {#each remainingTabs as tab, i}
            <div
              class="flex items-center justify-between rounded-xl p-4 shadow-md transition-transform hover:-translate-y-1 bg-white relative"
              style="transform: rotate({(remainingTabs.length - 1 - i) *
                1.5}deg); transform-origin: center right; margin-top: {i * 0.1 * 8 + 10}px;"
              aria-hidden="true"
              transition:fly={{ y: -50, duration: 300, delay: i * 100, easing: quintOut }}
            >
              <div class="flex items-center gap-3 flex-1 min-w-0">
                <img
                  src={`https://www.google.com/s2/favicons?domain=${tab.url}`}
                  alt=""
                  class="w-4 h-4 flex-shrink-0"
                />
                <span class="text-gray-700 truncate text-sm md:!text-base">{tab.title}</span>
              </div>
              <div
                class="flex items-center gap-2 flex-shrink-0 hover:scale-110 transform-gpu transition-transform cursor-pointer {!$savingTabs[
                  tab.url
                ]
                  ? 'tooltip-target'
                  : ''} relative"
                on:click={() => handleSaveTab(tab)}
                aria-hidden="true"
              >
                {#if $savingTabs[tab.url]}
                  <div class="flex items-center gap-2 animate-pulse">
                    <span class="text-blue-500 text-sm hidden sm:inline">
                      {savingMessages[$savingTimeouts[tab.url] || 0]}
                    </span>
                  </div>
                {:else}
                  <Icon name="save" size="20" color="#2497e9" />
                {/if}
              </div>
            </div>
          {/each}
        </div>

        <div
          class="absolute w-full transition-all duration-500 ease-out"
          style="top: {hasRemainingTabs
            ? 'calc(100% + 2rem)'
            : '50%'}; transform: translateY({hasRemainingTabs ? '0' : '-50%'});"
        >
          <div class="relative w-full">
            {#each $savedStack as savedTab, i}
              <div
                class="absolute top-8 left-1/2 rounded-xl p-6 shadow-lg transition-all duration-500 bg-white border-l-4 border-green-500 w-full max-w-[calc(100vw-2rem)] lg:!max-w-[500px]"
                style="
                  transform: rotate({Math.random() * 6 - 2}deg) translate(-50%, {i * -4}px);
                  z-index: {i};
                "
                transition:fly={{ y: 50, duration: 400, delay: i * 150, easing: quintOut }}
              >
                <div class="flex items-center gap-4 overflow-hidden">
                  <div class="bg-gray-100 p-2 rounded-lg flex-shrink-0">
                    <img
                      src={`https://www.google.com/s2/favicons?domain=${savedTab.url}`}
                      alt=""
                      class="w-5 h-5"
                    />
                  </div>
                  <div class="flex-1 min-w-0">
                    <span class="text-gray-900 font-medium text-sm md:!text-base block truncate"
                      >{savedTab.title}</span
                    >
                    <p class="text-gray-500 text-sm truncate">{savedTab.url}</p>
                  </div>
                  <div class="bg-green-100 p-2 rounded-full flex-shrink-0">
                    <Icon name="check" size="20" color="#22c55e" />
                  </div>
                </div>
              </div>
            {/each}
          </div>
        </div>
      </div>
    </div>
  </div>
</section>

<style lang="scss">
  .tooltip-target::after {
    content: '';
    position: absolute;
    top: -4px;
    left: -4px;
    right: -4px;
    bottom: -4px;
    display: block;
    border-radius: 50%;
    border-radius: calc(inherit + 8px);
    z-index: -1;
    animation: pulse 2s infinite;
    filter: blur(4px);
  }

  @keyframes pulse {
    0% {
      box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.7);
    }
    70% {
      box-shadow: 0 0 0 10px rgba(59, 130, 246, 0);
    }
    100% {
      box-shadow: 0 0 0 0 rgba(59, 130, 246, 0);
    }
  }
</style>
