<script lang="ts">
  import { onMount, afterUpdate, tick, createEventDispatcher } from 'svelte'
  import { spring } from 'svelte/motion'
  import { flip } from 'svelte/animate'
  import { useOasis } from '../../service/oasis'
  import { tooltip } from '@horizon/utils'
  import { Icon } from '@horizon/icons'
  import ChatContextTabPicker from './ChatContextTabPicker.svelte'
  import { writable } from 'svelte/store'

  import SpaceIcon from '../Atoms/SpaceIcon.svelte'
  import type { Tab } from '../../types/browser.types'

  export let tabs: Tab[]
  let containerRef
  let isInitialized = false
  const oasis = useOasis()

  $: pills = tabs.map((tab) => {
    return {
      favicon: tab.icon,
      title: tab.title,
      id: tab.id,
      type: tab.type,
      spaceId: tab.spaceId
    }
  })

  const containerWidth = spring(220, { stiffness: 0.2, damping: 0.7 })

  const dispatch = createEventDispatcher<{
    select: string
    'select-all-tabs': void
    'exclude-tab': string
  }>()

  $: pillProperties = spring(
    pills.map((_, index) => ({
      x: index * 30,
      y: getSubtleVerticalOffset(),
      rotate: getSubtleRotation(),
      width: 40,
      height: 36,
      borderRadius: 9,
      textOpacity: 0,
      textBlur: 10,
      textX: -20
    })),
    { stiffness: 0.5, damping: 0.8 }
  )

  onMount(async () => {
    await initializePositions()
    isInitialized = true
  })

  afterUpdate(async () => {
    if (isInitialized && pills.length !== $pillProperties.length) {
      await resetAnimation()
    }
  })

  async function initializePositions() {
    await tick()
    pillProperties.set(
      pills.map((_, index) => ({
        x: index * 30,
        y: getSubtleVerticalOffset(),
        rotate: getSubtleRotation(),
        width: 40,
        height: 36,
        borderRadius: 9,
        textOpacity: 0,
        textBlur: 10,
        textX: -20
      }))
    )
  }

  function getSubtleVerticalOffset() {
    return (Math.random() * 2 - 1) * 2.5 + 8
  }

  function getSubtleRotation() {
    return (Math.random() * 2 - 1) * 3.5
  }

  async function resetAnimation() {
    await initializePositions()
  }

  const handleSelectAllTabs = () => {
    dispatch('select-all-tabs')
  }

  const handleSelectTab = (tabId: string) => {
    dispatch('select', tabId)
  }

  const handleExcludeTab = (tabId: string) => {
    dispatch('exclude-tab', tabId)
  }

  function handleMouseLeave(event: MouseEvent) {}
</script>

<div class="relative w-full" style="height: 54px;" aria-hidden="true" bind:this={containerRef}>
  <div
    class="flex items-center h-full relative overflow-x-autoscrollbar-hide overflow-y-hidden"
    style="width: {$containerWidth}px; height: 64px; min-width: 100%;  overflow-x: scroll;"
  >
    {#each pills as pill (pill.id)}
      <div
        aria-hidden="true"
        class="absolute top-0 left-0 shine-border pill transform hover:translate-y-[-6px]"
        animate:flip={{ duration: 300 }}
        on:click={() => handleSelectTab(pill.id)}
        on:contextmenu={() => handleExcludeTab(pill.id)}
        style="transform: translate({$pillProperties[pills.findIndex((p) => p.id === pill.id)]
          .x}px, {$pillProperties[pills.findIndex((p) => p.id === pill.id)]
          .y}px) rotate({$pillProperties[pills.findIndex((p) => p.id === pill.id)]
          .rotate}deg); transform-origin: center center;"
      >
        <div
          aria-hidden="true"
          class="pill flex items-center bg-white z-0 shadow-md pl-[11px] hover:bg-red-100 transform hover:translate-y-[-6px]"
          style="width: {$pillProperties[pills.findIndex((p) => p.id === pill.id)]
            .width}px; height: {$pillProperties[pills.findIndex((p) => p.id === pill.id)]
            .height}px; border-radius: {$pillProperties[pills.findIndex((p) => p.id === pill.id)]
            .borderRadius}px; transition: width 0.3s, height 0.3s, transform 0.3s, background-color 0.3s;"
          on:mouseleave={handleMouseLeave}
        >
          <button
            class="remove absolute top-0 left-0 shadow-sm transform"
            style="background: white; border: 1px solid rgb(220,220,220); transform: translate(-20%, -20%); z-index: 10; width: 16px; aspect-ratio: 1 / 1; border-radius: 100%;"
            on:click={() => handleExcludeTab(pill.id)}
          >
            <Icon name="close" size="11px" color="black" />
          </button>
          <div class="w-5 h-5 flex items-center justify-center flex-shrink-0">
            {#if pill.type !== 'space'}
              <img
                src={pill.favicon}
                alt={pill.title}
                class="w-full h-full object-contain"
                style="transition: transform 0.3s;"
                loading="lazy"
              />
            {:else}
              {#await oasis.getSpace(pill.spaceId) then fetchedSpace}
                {#if fetchedSpace}
                  <SpaceIcon folder={fetchedSpace} />
                {/if}
              {/await}
            {/if}
          </div>
          <span
            class="ml-2 whitespace-nowrap overflow-hidden text-sm"
            style="opacity: {$pillProperties[pills.findIndex((p) => p.id === pill.id)]
              .textOpacity}; filter: blur({$pillProperties[pills.findIndex((p) => p.id === pill.id)]
              .textBlur}px); transform: translateX({$pillProperties[
              pills.findIndex((p) => p.id === pill.id)
            ].textX}px); transition: opacity 0.3s, filter 0.3s;"
          >
            {pill.title}
          </span>
        </div>
      </div>
    {/each}
  </div>
</div>

<style lang="scss">
  .relative::-webkit-scrollbar {
    display: none;
  }
  .scrollbar-hide {
    -ms-overflow-style: none;
    scrollbar-width: none;
  }
  .scrollbar-hide::-webkit-scrollbar {
    display: none;
  }
  .shine-border {
    transform-box: fill-box;
    transform-origin: center center;
  }
  .pill {
    cursor: default;
    transition: transform 0.3s ease;
  }

  .add-container {
    position: absolute;
    z-index: 100000;
    top: -7px;
    left: -14px;
    bottom: 10px;
    height: 78px;
    background: linear-gradient(90deg, rgba(224, 242, 254, 1) 75%, rgba(255, 255, 255, 0) 100%);
    padding-left: 0.75rem;
    padding-right: 1.25rem;
    display: flex;
    justify-content: center;
    align-items: center;
  }
  .pill {
    button.remove {
      display: none;
      justify-content: center;
      align-items: center;
      transition: all 0.3 ease;
    }
    &:hover button.remove {
      display: flex;
    }
  }
  /*.pill.add {
    display: flex;
    justify-content: center;
    align-items: center;
    width: 36px;
    aspect-ratio: 1 / 1;
    border-radius: 9px;

    &:hover,
    &.active {
      background: rgba(0, 0, 0, 0.1);
    }
  }*/
</style>
