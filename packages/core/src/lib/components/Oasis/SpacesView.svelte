<script lang="ts">
  import { createEventDispatcher, onMount, tick } from 'svelte'
  import { writable, derived } from 'svelte/store'

  import { useLogScope } from '../../utils/log'
  import Folder from './Folder.svelte'
  import { Icon } from '@horizon/icons'
  import { useOasis } from '../../service/oasis'
  import emblaCarouselSvelte from 'embla-carousel-svelte'
  import { WheelGesturesPlugin } from 'embla-carousel-wheel-gestures'
  import { fly } from 'svelte/transition'

  import { useToasts } from '../../service/toast'
  import type { SpaceData, SpaceSource, TabSpace } from '../../types'
  import type { Writable } from 'svelte/store'
  import type { Space } from '@horizon/core/src/lib/types'
  import { useTelemetry } from '../../service/telemetry'
  import {
    CreateSpaceEventFrom,
    DeleteSpaceEventTrigger,
    OpenSpaceEventTrigger
  } from '@horizon/types'
  import type { ResourceManager } from '../../service/resources'
  import { RefreshSpaceEventTrigger } from '@horizon/types'

  let folderRef: any

  const log = useLogScope('SpacesView')
  const oasis = useOasis()
  const toast = useToasts()
  const telemetry = useTelemetry()
  const dispatch = createEventDispatcher<{
    createTab: { tab: TabSpace; active: boolean }
    'space-selected': { id: string; canGoBack: boolean }
    'open-creation-modal': void
  }>()

  export let spaces: Writable<Space[]>
  export let interactive = true
  export let type: 'grid' | 'horizontal' = 'grid'
  export let resourceManager: ResourceManager
  export let showPreview = true
  const selectedSpace = oasis.selectedSpace

  export let onBack = () => {}
  $: log.debug('Spaces:', $spaces)

  export const handleCreateSpace = async (
    _e: MouseEvent,
    name: string,
    colors?: [string, string],
    userPrompt?: string
  ) => {
    try {
      const newSpace = await oasis.createSpace({
        folderName: name ? name : 'New Space',
        colors: ['#FFBA76', '#FB8E4E'],
        smartFilterQuery: userPrompt ? userPrompt : null,
        liveModeEnabled: !!userPrompt
      })

      log.debug('New Folder:', newSpace)

      selectedSpace.set(newSpace.id)

      await tick()

      if (colors) {
        await oasis.updateSpaceData(newSpace.id, {
          colors: colors
        })
      }

      const inputElement = document.getElementById(
        `folder-input-${newSpace.id}`
      ) as HTMLInputElement
      if (inputElement) {
        inputElement.select()
      }

      await telemetry.trackCreateSpace(CreateSpaceEventFrom.OasisSpacesView)

      return newSpace.id
    } catch (error) {
      log.error('Failed to create folder:', error)
      return null
    }
  }

  export const createSpaceWithAI = async (
    spaceId: string,
    userPrompt: string,
    colors?: [string, string]
  ) => {
    try {
      log.debug('Creating folder with AI', userPrompt)

      const response = await resourceManager.getResourcesViaPrompt(userPrompt)

      log.debug(`Automatic Folder Generation request`, response)

      const results = new Set([
        ...(response.embedding_search_results ?? []),
        ...(response.sql_query_results ?? [])
      ])

      const resourceIds = Array.from(results)

      log.debug('Automatic Folder generated with', results)

      if (!results) {
        log.warn('No results found for', userPrompt, response)
        return
      }

      if (colors) {
        await oasis.updateSpaceData(spaceId, {
          colors: colors,
          sql_query: response.sql_query,
          embedding_query: response.embedding_search_query ?? undefined
        })
      }

      await oasis.addResourcesToSpace(spaceId, resourceIds)

      await resourceManager.telemetry.trackRefreshSpaceContent(
        RefreshSpaceEventTrigger.RenameSpaceWithAI,
        {
          usedSmartQuery: true,
          addedResources: resourceIds.length > 0
        }
      )

      toast.success('Folder created with AI!')
    } catch (err) {
      log.error('Failed to create folder with AI', err)
    } finally {
      await tick()
    }
  }

  const addItemToTabs = async (id: string, active: boolean) => {
    try {
      log.debug('Adding folder to tabs:', id)
      const space = $spaces.find((space) => space.id === id)
      if (space) {
        space.name.showInSidebar = true

        await oasis.updateSpaceData(id, {
          showInSidebar: true
        })

        dispatch('createTab', {
          tab: {
            title: space.name.folderName,
            icon: '',
            spaceId: id,
            type: 'space',
            index: 0,
            pinned: false,
            archived: false
          } as TabSpace,
          active: active
        })

        await tick()

        await telemetry.trackOpenSpace(OpenSpaceEventTrigger.SidebarMenu, {
          isLiveSpace: space.name.liveModeEnabled,
          hasSources: (space.name.sources ?? []).length > 0,
          hasSmartQuery: !!space.name.smartFilterQuery
        })
      }
    } catch (error) {
      log.error('Failed to delete folder:', error)
    }
  }

  const handleSpaceUpdate = async (id: string, updates: Partial<SpaceData>) => {
    try {
      log.debug('Updating space:', id, updates)
      if (id === 'everything') {
        log.debug('Cannot update the Everything folder')
        return
      }

      const space = $spaces.find((space) => space.id === id)
      if (!space) {
        log.error('Space not found:', id)
        return
      }

      await oasis.updateSpaceData(id, updates)
    } catch (error) {
      log.error('Failed to update folder:', error)
    }
  }

  const handleSpaceSelect = async (id: string) => {
    try {
      selectedSpace.set(id)
      log.debug('Selected space:', id)
      dispatch('space-selected', { id: id, canGoBack: true })
    } catch (error) {
      log.error('Failed to select folder:', error)
    }
  }

  const handleShowCreationModal = () => {
    dispatch('open-creation-modal')
  }

  let embla: HTMLElement

  let showBrowserHomescreen: boolean = true

  let emblaCanScrollLeft = writable(false)
  let emblaCanScrollRight = writable(true)

  let emblaApi: any
  let options = { loop: false, dragFree: true }
  let plugins = [WheelGesturesPlugin({ forceWheelAxis: 'x' })]

  function onInit(event: any) {
    emblaApi = event.detail
    emblaApi.slideNodes()
    emblaApi.on('scroll', isScrolled)
  }

  function isScrolled(e: any) {
    emblaCanScrollLeft.set(e.canScrollPrev())
    emblaCanScrollRight.set(e.canScrollNext())
  }

  function handleNext() {
    emblaApi.scrollNext()
  }

  function handlePrevious() {
    emblaApi.scrollPrev()
  }

  onMount(() => {
    log.debug('Mounted SpacesView')
  })

  const filteredSpaces = derived(spaces, ($spaces) =>
    $spaces
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .filter((folder) => folder.id !== 'all')
  )
</script>

<div class="folders-sidebar">
  <div
    class="embla"
    use:emblaCarouselSvelte={{ options, plugins }}
    on:emblaInit={onInit}
    class:scrolled={$emblaCanScrollLeft}
    bind:this={embla}
  >
    <div class="embla__container">
      <button class="action-new-space" on:click={handleShowCreationModal}>
        <Icon name="plus" />
        <span class="new-space-text">New Space</span>
      </button>
      {#each $filteredSpaces as folder (folder.id)}
        {#key folder.id}
          <div class="embla__slide">
            <Folder
              {folder}
              on:select={() => handleSpaceSelect(folder.id)}
              on:space-selected={() => handleSpaceSelect(folder.id)}
              on:open-space-as-tab={(e) => addItemToTabs(folder.id, e.detail.active)}
              on:update-data={(e) => handleSpaceUpdate(folder.id, e.detail)}
              on:open-resource
              selected={$selectedSpace === folder.id}
              {showPreview}
            />
          </div>
        {/key}
      {/each}
    </div>
    {#if $emblaCanScrollLeft}
      <button
        class="embla__prev"
        on:click={handlePrevious}
        in:fly={{ x: 10, duration: 160 }}
        out:fly={{ x: 10, duration: 160 }}
      >
        <Icon name="chevron.left" color="red" />
      </button>
    {/if}
    {#if $emblaCanScrollRight}
      <button
        class="embla__next"
        on:click={handleNext}
        in:fly={{ x: -10, duration: 160 }}
        out:fly={{ x: -10, duration: 160 }}
      >
        <Icon name="chevron.right" />
      </button>
    {/if}
  </div>
</div>

<style lang="scss">
  .top-bar {
    display: flex;
    justify-content: space-between;
    padding: 1rem;
    gap: 1rem;
    width: fit-content;
  }
  .folders-sidebar {
    position: relative;
    padding: 0 0.5rem 0.5rem 0.5rem;
    padding-top: 0;
    flex: 1;
  }

  button {
    display: flex;
    align-items: center;
    margin: 0.5rem 0;
    padding: 1rem 0;
    gap: 0.5rem;
    background-color: transparent;
    border: 0;
    border-radius: 8px;
    cursor: pointer;
    border-radius: 16px;
    background: var(--Black, #fff);
    background: var(--Black, color(display-p3 1 1 1));
    box-shadow: 0px 0.933px 2.8px 0px rgba(0, 0, 0, 0.1);
    box-shadow: 0px 0.933px 2.8px 0px color(display-p3 0 0 0 / 0.1);

    span {
      font-size: 1rem;
      letter-spacing: 0.01em;
    }
  }

  .folder-wrapper {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(230px, 1fr));
    gap: 1rem;
    width: 100%;
  }

  .action-new-space {
    .new-space-text {
      font-size: 1.1rem;
    }
    letter-spacing: 0.01em;
    margin: 0;
    padding: 0.75rem 1rem;
    opacity: 0.6;
    &:hover {
      opacity: 1;
    }
  }

  .action-back-to-tabs {
    .label {
      letter-spacing: 0.04rem;
    }
  }

  .embla-wrapper {
    position: relative;
  }

  .embla {
    overflow: hidden;
    -webkit-mask-image: linear-gradient(to right, #000 98%, transparent 100%);
    &.scrolled {
      -webkit-mask-image: linear-gradient(to right, transparent, #000 2%, #000 98%, transparent);
    }
  }
  .embla__container {
    display: flex;
  }

  .embla__prev,
  .embla__next {
    top: 40%;
    background: white;
    border: 0;
    display: flex;
    justify-content: center;
    align-items: center;
    width: 2rem;
    cursor: pointer;
    pointer-events: all;
    transform: translateY(-50%);
  }

  .embla__prev {
    position: absolute;
    left: 2rem;
  }

  .embla__slide {
    margin-right: 20px;
    margin-left: 10px;
  }

  .embla__next {
    position: absolute;
    right: 2rem;
    z-index: 10000;
  }
</style>
