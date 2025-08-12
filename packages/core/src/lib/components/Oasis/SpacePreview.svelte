<script lang="ts">
  import { tweened } from 'svelte/motion'
  import { onMount, onDestroy } from 'svelte'
  import { type Readable } from 'svelte/store'
  import { cubicOut } from 'svelte/easing'
  import { useOasis } from '@horizon/core/src/lib/service/oasis'
  import { Resource } from '../../service/resources'
  import { useThrottle } from '@deta/utils'

  type Origin = 'smartcontext' | 'oasis'

  import ResourcePreview from '../Resources/ResourcePreview.svelte'
  import { DynamicIcon } from '@deta/icons'

  const oasis = useOasis()

  export let resources: Readable<Resource[]>
  export let origin: Origin = 'oasis'
  export let performanceMode: boolean = false
  export let icon: string = ''

  // Get the selectedSpace store from oasis service
  const selectedSpace = oasis?.selectedSpace

  // React to changes in the selected space
  $: if (selectedSpace && $selectedSpace === 'all-contexts') {
    console.log('SpacePreview - enabling performance mode for all-contexts space')
    performanceMode = true
  } else if (selectedSpace && $selectedSpace !== 'all-contexts') {
    performanceMode = false
  }

  // Define the activeIndex as a tweened value for smooth transitions
  let activeIndex = tweened(0, { duration: 200, easing: cubicOut })

  // Data to be populated with resources loaded in onMount
  let resourcesData: { id: string; title: string; type: string }[] = []
  let resourceDataLength: number = 0
  let previewContainerRef: HTMLDivElement
  let allResourcesLoaded: boolean = false
  let skeletonResources: Resource[] = []
  let renderedResources: Resource[] = []
  let resourceReleaseTimeout: number | null = null
  const RESOURCE_RELEASE_DELAY = 250

  // Color mapping for different types of cards
  const typeColors: { [key: string]: string } = {
    travel: 'bg-blue-500',
    nature: 'bg-green-500',
    technology: 'bg-purple-500',
    food: 'bg-yellow-500',
    culture: 'bg-red-500',
    history: 'bg-orange-500'
  }

  // Mouse movement handler function
  const handleMouseMove = (e: MouseEvent) => {
    const container = previewContainerRef
    if (container && isMouseOver) {
      const rect = container.getBoundingClientRect()
      const newIndex = Math.floor(((e.clientX - rect.left) / rect.width) * resourcesData.length)
      activeIndex.set(Math.max(0, Math.min(newIndex, resourcesData.length - 1)))
    }
  }

  // Use throttled version of the handler (50ms = ~20fps) which is sufficient for this animation
  const throttledHandleMouseMove = useThrottle(handleMouseMove, 100)

  // Lifecycle methods to attach/detach the mousemove event listener
  onMount(async () => {
    // Only add event listener if context is not empty and not in performance mode
    if (!isContextEmpty && !performanceMode) {
      window.addEventListener('mousemove', throttledHandleMouseMove, { passive: true })
    }

    try {
      // Store the total count of resources for display purposes
      resourceDataLength = $resources.length

      // Create skeleton placeholders for all resources
      if (resourceDataLength > 0) {
        const maxResources =
          // TODO: when we use Space Preview in Smart Space again we'll use higher max resources
          origin === 'oasis' ? Math.min(4, resourceDataLength) : Math.min(4, resourceDataLength)
        skeletonResources = $resources.slice(0, maxResources)
      } else {
        // Create at least one skeleton resource for empty spaces
        skeletonResources = [{} as Resource]
        isContextEmpty = true
      }

      // Only load the first resource initially
      if (resourceDataLength > 0) {
        // Just load the first resource
        const firstResource = $resources[0]
        renderedResources = [firstResource]

        // Create resourcesData for the first resource
        resourcesData = [
          {
            id: firstResource.id,
            title: firstResource.metadata?.name || 'Untitled',
            type:
              firstResource.tags
                ?.find((tag: any) => tag.name === 'type')
                ?.value.split('.')
                .pop() || 'unknown'
          }
        ]

        // Create skeleton data for remaining resources (skip in performance mode)
        const remainingCount = performanceMode ? 0 : skeletonResources.length - 1
        for (let i = 1; i < remainingCount + 1; i++) {
          resourcesData.push({
            id: skeletonResources[i].id,
            title: 'Loading...',
            type: 'unknown'
          })
        }

        // Mark as all loaded if we have only one resource or in performance mode
        if ($resources.length === 1 || performanceMode) {
          allResourcesLoaded = true
        }
      } else {
        resourceDataLength = 0
        allResourcesLoaded = true

        // Create a placeholder resourceData entry for the empty state
        resourcesData = [
          {
            id: 'empty-skeleton',
            title: 'Empty',
            type: 'unknown'
          }
        ]
      }
    } catch (error) {
      console.error('Error fetching initial resource:', error)
    }
  })

  onDestroy(() => {
    // Only remove the event listener if it was added
    if (!isContextEmpty && !performanceMode) {
      window.removeEventListener('mousemove', throttledHandleMouseMove)
    }

    // Clear any pending resource release timeout
    if (resourceReleaseTimeout) {
      clearTimeout(resourceReleaseTimeout)
    }
  })

  // Memoize transform styles to avoid recalculation
  const transformStyleCache = new Map()
  const getTransformStyle = (index: number, activeIndex: number) => {
    // Round to 2 decimal places to limit cache size while maintaining visual quality
    const roundedActiveIndex = Math.round(activeIndex * 100) / 100
    const key = `${index}-${roundedActiveIndex}`

    if (transformStyleCache.has(key)) {
      return transformStyleCache.get(key)
    }

    const offset = index - activeIndex
    const y = Math.abs(offset) * 3
    const x = offset * 10 // Increased horizontal offset for more pronounced spacing
    const rotate = offset * 2 // Rotate the card based on its offset
    const scale = index === Math.round(activeIndex) ? 0.98 : 1 - Math.abs(offset) * 0.05 // Scale the active card bigger
    const zIndex =
      index === Math.round(activeIndex)
        ? resourcesData.length
        : resourcesData.length - Math.abs(offset)

    const style = `transform: translate3d(${x}px, ${y}px, 0) rotate(${rotate}deg) scale(${scale}); z-index: ${zIndex};`
    transformStyleCache.set(key, style)
    return style
  }

  // State to track if the mouse is over the component
  let isMouseOver: boolean = false

  // Check if context is empty
  let isContextEmpty: boolean = $resources.length === 0

  // Mouse enter and leave handlers
  const handleMouseEnter = async () => {
    isMouseOver = true

    // Load remaining resources on hover if not already loaded and not in performance mode
    if (!allResourcesLoaded && $resources.length > 1 && !performanceMode) {
      // Clear any existing release timeout to prevent resources from being released
      if (resourceReleaseTimeout) {
        clearTimeout(resourceReleaseTimeout)
        resourceReleaseTimeout = null
      }

      try {
        const remainingResources = $resources.slice(1, skeletonResources.length)
        renderedResources = [...$resources, ...remainingResources]

        // Update resourcesData with all resources
        resourcesData = renderedResources.map((resource) => ({
          id: resource.id,
          title: resource.metadata?.name || 'Untitled',
          type:
            resource.tags
              ?.find((tag: any) => tag.name === 'type')
              ?.value.split('.')
              .pop() || 'unknown'
        }))

        // Force update of allResourcesLoaded to trigger reactivity
        allResourcesLoaded = true

        // Force a Svelte update cycle
        renderedResources = [...renderedResources]
      } catch (error) {
        console.error('Error fetching remaining resources:', error)
      }
    }
  }

  const handleMouseLeave = () => {
    isMouseOver = false

    // Set a timeout to release resources after delay
    if (allResourcesLoaded && $resources.length > 1) {
      // Clear any existing timeout
      if (resourceReleaseTimeout) {
        clearTimeout(resourceReleaseTimeout)
      }

      // Set new timeout to release resources
      resourceReleaseTimeout = window.setTimeout(() => {
        // First smoothly animate back to the first card
        activeIndex.set(0, { duration: 400 })

        // Wait for the animation to complete before removing resources
        setTimeout(() => {
          // Keep only the first resource
          if ($resources.length > 1) {
            const firstResource = $resources[0]
            const firstResourceData = resourcesData[0]

            // Create skeleton placeholders for the resources that will be released
            const newResourcesData = [firstResourceData]

            // Add skeleton placeholders for the resources we're releasing
            for (let i = 1; i < skeletonResources.length; i++) {
              newResourcesData.push({
                id: skeletonResources[i].id,
                title: 'Loading...',
                type: 'unknown'
              })
            }

            // Update the resources and data
            renderedResources = [firstResource]
            resourcesData = newResourcesData
            allResourcesLoaded = false

            // Log resource release for debugging
            console.log('Resources released after timeout')
          }
        }, 450) // Wait slightly longer than the animation duration
      }, RESOURCE_RELEASE_DELAY)
    }
  }
</script>

<!-- Container for the entire card preview -->
<div class="preview-wrapper">
  <div
    id="preview-container"
    bind:this={previewContainerRef}
    class="preview-container"
    on:mouseenter={!isContextEmpty && !performanceMode ? handleMouseEnter : null}
    on:mouseleave={!isContextEmpty && !performanceMode ? handleMouseLeave : null}
    role="none"
  >
    <!-- Card display with dynamic transformations - only render visible cards -->
    <div class="card-container">
      {#each resourcesData as item, index}
        <!-- In performance mode, only render the first card with no transforms -->
        {#if performanceMode ? index === 0 : Math.abs(index - $activeIndex) < 4}
          <div
            class="card {performanceMode ? 'static-card' : ''}"
            style={performanceMode ? '' : getTransformStyle(index, $activeIndex)}
          >
            <div class="overflow-hidden w-full h-full rounded-xl pointer-events-none isolate">
              {#if $resources[index]}
                <ResourcePreview
                  viewMode="responsive"
                  resource={$resources[index]}
                  interactive={false}
                  draggable={false}
                  selected={false}
                  selectable={false}
                  resourcesBlacklistable={false}
                  titleEditable={false}
                  frameless={true}
                  disableContextMenu={true}
                />
              {:else}
                <div class="skeleton-preview">
                  {#if item.id === 'empty-skeleton'}
                    <div class="empty-state">This context is empty</div>
                    <div class="skeleton-header"></div>
                    <div class="skeleton-content">
                      <div class="skeleton-line"></div>
                      <div class="skeleton-line"></div>
                      <div class="skeleton-line short"></div>
                    </div>
                  {:else if item.id === 'nested-skeleton'}
                    <div class="nested-state">
                      <DynamicIcon name={icon} />
                    </div>
                  {/if}
                </div>
              {/if}
            </div>
          </div>
        {/if}
      {/each}
    </div>

    <!-- Active indicator bars that reflect the active card, only shown when mouse is over the component and not in performance mode -->
    {#if !performanceMode}
      <div
        class="h-2 flex justify-center space-x-1 transition-opacity duration-300"
        style="opacity: {isMouseOver ? 1 : 0}"
      >
        {#each resourcesData as item, index}
          <div class="flex flex-col justify-end h-full">
            <div
              class="rounded-full active-bar {typeColors[item.type] || 'bg-sky-300'} {index ===
              Math.round($activeIndex)
                ? 'active'
                : 'inactive'}"
            />
          </div>
        {/each}
      </div>
    {/if}
  </div>
</div>

<style>
  .preview-wrapper {
    flex-grow: 1;
    width: 100%;
    display: block;
    position: relative;
  }

  .preview-container {
    width: 100%;
    height: 100%;
    padding: 0 0 4px 0;
    display: flex;
    flex-direction: column;
  }

  .card-container {
    position: relative;
    height: 100%;
    width: 100%;
    display: flex;
    margin-bottom: 0.5rem;
    align-items: center;
    justify-content: center;
  }

  .card {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-color: white;
    display: flex;
    justify-content: center;
    align-items: center; /* Center content vertically */
    padding: 12px;
    border-radius: 24px;
    box-shadow: 0 4px 8px rgba(67, 142, 239, 0.1);
    transform-origin: center center; /* Center transform origin */
    border: 0.5px solid rgba(67, 142, 239, 0.15);
    transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
    will-change: transform, opacity;
    overflow: visible;
    /* Add compositing hints */
    backface-visibility: hidden;
    transform-style: preserve-3d;
    contain: layout paint style;
    min-height: 100px; /* Ensure minimum height */
  }

  /* Static card for performance mode - no animations or transforms */
  .static-card {
    position: relative;
    transition: none;
    will-change: auto;
    transform: none !important;
    backface-visibility: visible;
    transform-style: flat;
  }

  .active-bar {
    transition: all 0.2s ease-in-out;
  }

  .active-bar.active {
    width: 12px;
    height: 100%;
  }

  .active-bar.inactive {
    width: 8px;
    height: 50%;
  }

  /* Skeleton styles */
  .skeleton-preview {
    width: 100%;
    height: 100%;
    background-color: white;
    border-radius: 12px;
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    animation: pulse 1.5s infinite ease-in-out;
  }

  .skeleton-header {
    height: 24px;
    background-color: #f0f0f0;
    border-radius: 4px;
    width: 70%;
  }

  .skeleton-content {
    display: flex;
    flex-direction: column;
    gap: 8px;
    flex-grow: 1;
  }

  .skeleton-line {
    height: 16px;
    background-color: #f0f0f0;
    border-radius: 4px;
    width: 100%;
  }

  .skeleton-line.short {
    width: 60%;
  }

  .empty-state {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    font-size: 1rem;
    color: #666;
    text-align: center;
    font-weight: 500;
  }

  :global(.dark) .skeleton-preview {
    background-color: #2a2a2a;
  }

  :global(.dark) .empty-state {
    color: #aaa;
  }

  :global(.dark) .skeleton-header,
  :global(.dark) .skeleton-line {
    background-color: #3a3a3a;
  }

  @keyframes pulse {
    0% {
      opacity: 0.6;
    }
    50% {
      opacity: 0.8;
    }
    100% {
      opacity: 0.6;
    }
  }
</style>
