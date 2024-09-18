<script>
  import { tweened } from 'svelte/motion'
  import { onMount, onDestroy } from 'svelte'
  import { cubicOut } from 'svelte/easing'
  import { useOasis } from '../../service/oasis'
  import { useResourceManager } from '../../service/resources'

  import ResourcePreviewClean from '../Resources/ResourcePreviewClean.svelte'

  const oasis = useOasis()
  const resourceManager = useResourceManager()

  export let resourceIDs = []
  export let showHeader = true

  // Define the activeIndex as a tweened value for smooth transitions
  let activeIndex = tweened(0, { duration: 200, easing: cubicOut })

  // Data to be populated with resources loaded in onMount
  let resources = []
  let resourcesData = []
  let resourceDataLength = 0

  let spaceName = 'undefined'

  // Color mapping for different types of cards
  const typeColors = {
    travel: 'bg-blue-500',
    nature: 'bg-green-500',
    technology: 'bg-purple-500',
    food: 'bg-yellow-500',
    culture: 'bg-red-500',
    history: 'bg-orange-500'
  }

  // Mouse movement handler to adjust active index based on mouse position
  const handleMouseMove = (e) => {
    const container = document.getElementById('preview-container')
    if (container && isMouseOver) {
      const rect = container.getBoundingClientRect()
      const newIndex = Math.floor(((e.clientX - rect.left) / rect.width) * resourcesData.length)
      activeIndex.set(Math.max(0, Math.min(newIndex, resourcesData.length - 1)))
    }
  }

  // Lifecycle methods to attach/detach the mousemove event listener
  onMount(async () => {
    window.addEventListener('mousemove', handleMouseMove)

    try {
      resources = await Promise.all(
        resourceIDs.map((id) => resourceManager.getResourceWithAnnotations(id))
      )

      resourceDataLength = resources.length

      resourcesData = resources.slice(0, 9).map((resource) => ({
        id: resource.id,
        title: resource.metadata.name || 'Untitled',
        type:
          resource.tags
            .find((tag) => tag.name === 'type')
            ?.value.split('.')
            .pop() || 'unknown'
      }))

      if (resources.length > 0 && showHeader) {
        const space = await oasis.getSpace(resources[0].space_id)
        if (space) {
          spaceName = space.name.folderName
        }
      }
    } catch (error) {
      console.error('Error fetching resources:', error)
    }
  })

  onDestroy(() => {
    window.removeEventListener('mousemove', handleMouseMove)
  })

  // Calculate transform styles based on the card's index and activeIndex
  const getTransformStyle = (index, activeIndex) => {
    const offset = index - activeIndex
    const y = Math.abs(offset) * 3
    const x = offset * 10 // Increased horizontal offset for more pronounced spacing
    const rotate = offset * 2 // Rotate the card based on its offset
    const scale = index === Math.round(activeIndex) ? 0.98 : 1 - Math.abs(offset) * 0.05 // Scale the active card bigger

    return `transform: translate(${x}px, ${y}px) rotate(${rotate}deg) scale(${scale}); z-index: ${index === Math.round(activeIndex) ? resourcesData.length : resourcesData.length - Math.abs(offset)};`
  }

  // State to track if the mouse is over the component
  let isMouseOver = false

  // Mouse enter and leave handlers
  const handleMouseEnter = () => {
    isMouseOver = true
  }

  const handleMouseLeave = () => {
    isMouseOver = false
  }
</script>

<!-- Container for the entire card preview -->
<div class="flex items-center justify-center p-24">
  <div
    id="preview-container"
    class="w-[400px] p-6 relative"
    on:mouseenter={handleMouseEnter}
    on:mouseleave={handleMouseLeave}
    aria-hidden="true"
  >
    {#if showHeader}
      <div class="flex justify-between items-center mb-6">
        <h1 class="text-2xl font-bold text-gray-700">{spaceName}</h1>
        <span class="bg-sky-100 text-gray-700 rounded-full px-3 py-1 text-sm font-semibold"
          >{resourceDataLength}</span
        >
      </div>
    {/if}

    <!-- Card display with dynamic transformations -->
    <div class="relative h-[26rem] mb-6">
      {#each resourcesData as item, index}
        <div class="card" style={getTransformStyle(index, $activeIndex)}>
          <div class="overflow-hidden w-full h-full">
            <ResourcePreviewClean resource={resources[index]} interactive={false} on:click />
          </div>
        </div>
      {/each}
    </div>

    <!-- Active indicator bars that reflect the active card, only shown when mouse is over the component -->
    <div
      class="h-2 flex justify-center space-x-1 transition-opacity duration-300"
      style="opacity: {isMouseOver ? 1 : 0}"
    >
      {#each resourcesData as item, index}
        <div class="flex flex-col justify-end h-full">
          <div
            class="w-2 rounded-full active-bar {typeColors[item.type] || 'bg-white'}"
            style="height: {index === Math.round($activeIndex) ? '100%' : '50%'}; width: {index ===
            Math.round($activeIndex)
              ? '12px'
              : '8px'}"
          />
        </div>
      {/each}
    </div>
  </div>
</div>

<style>
  .card-container {
    position: relative;
    height: 70%;
    margin-top: -20px;
  }

  .card {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    background-color: white;
    display: flex;
    justify-content: center;
    align-items: start;
    padding: 12px;
    height: 20rem;
    border-radius: 24px;
    box-shadow:
      0 1px 3px rgba(67, 142, 239, 0.12),
      0 2px 4px rgba(67, 142, 239, 0.09),
      0 4px 8px rgba(67, 142, 239, 0.06),
      0 8px 16px rgba(67, 142, 239, 0.03),
      0 16px 32px rgba(67, 142, 239, 0.01);
    transform-origin: center top;
    border: 0.5px solid rgba(67, 142, 239, 0.15);
    transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
    will-change: transform;
    overflow: hidden;
  }

  .active-bar {
    transition: all 0.2s ease-in-out;
  }
</style>
