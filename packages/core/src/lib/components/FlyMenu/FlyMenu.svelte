<script context="module" lang="ts">
  export const flyMenuOpen = writable(false)
  export const flyMenuType = writable<'cursor' | 'cmdk'>('cmdk')
  export const flyMenuItems: Writable<IFlyMenuItem[]> = writable([])

  export function openFlyMenu(type: 'cursor' | 'cmdk', items: IFlyMenuItem[]) {
    flyMenuType.set(type)
    flyMenuItems.set(items)
    flyMenuOpen.set(true)
  }
  export function closeFlyMenu() {
    flyMenuType.set('cmdk')
    flyMenuOpen.set(false)
  }
</script>

<script lang="ts">
  //import "./style.scss"
  import { Command, createState } from '@horizon/cmdk-sv'
  import { createEventDispatcher, tick } from 'svelte'
  import { cubicOut, quadInOut, quadOut } from 'svelte/easing'
  import type { Readable } from 'svelte/motion'
  import { writable, type Writable } from 'svelte/store'
  import { fly, scale } from 'svelte/transition'
  import { type IFlyMenuItem } from './flyMenu'
  import { posToAbsolute } from '@horizon/tela'
  import { APP_BAR_WIDTH } from '../../constants/horizon'
  import { getServiceIcon } from '../../utils/services'

  export let viewOffset: Readable<{ x: number; y: number }>
  export let viewPort: Readable<{ x: number; y: number; w: number; h: number }>

  const dispatch = createEventDispatcher()

  let state = createState()

  let flyMenuEl: HTMLElement
  let inputEl: HTMLInputElement
  let cursorPos = { x: 0, y: 0 }

  let flyMenuWidth = 0
  let flyMenuHeight = 0

  $: offsetCursorLeft = $viewOffset.x + cursorPos.x
  $: offsetCursorTop = $viewOffset.y + cursorPos.y
  $: flyRightEdgeDif = offsetCursorLeft - $viewOffset.x + flyMenuWidth - $viewPort.w
  $: flyTopEdgeDif = offsetCursorTop - flyMenuHeight
  $: flyBottomEdgeDif = offsetCursorTop - $viewPort.h + $viewPort.y
  $: flyLeftEdgeDig = offsetCursorLeft - APP_BAR_WIDTH
  $: top =
    flyTopEdgeDif <= 0
      ? offsetCursorTop - flyTopEdgeDif
      : flyBottomEdgeDif >= 0
        ? offsetCursorTop - flyBottomEdgeDif
        : offsetCursorTop

  $: left =
    flyLeftEdgeDig <= 0
      ? offsetCursorLeft - flyLeftEdgeDig
      : flyRightEdgeDif >= 0
        ? offsetCursorLeft - flyRightEdgeDif
        : offsetCursorLeft

  $: offsetFollowCursor = `left: ${left}px; top: ${top}px;`
  $: offset = $flyMenuType === 'cursor' ? offsetFollowCursor : `left: ${$viewOffset.x}px;`

  $: if ($flyMenuOpen) {
    setTimeout(() => {
      inputEl.focus()
    }, 80)
  }

  function onKeyDown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      $flyMenuOpen = false
      state = createState()
    } else if (e.key === 'Enter' && $flyMenuOpen) {
      const pos = posToAbsolute(
        cursorPos.x,
        cursorPos.y,
        $viewOffset.x,
        $viewOffset.y,
        $viewPort,
        1
      )
      dispatch('command', {
        cmd: $state.value,
        origin: $flyMenuType,
        targetX: pos.x,
        targetY: pos.y
      })

      $flyMenuOpen = false
      state = createState()
    }
  }

  function onInputKeyDown(e: KeyboardEvent) {
    if (e.key === 'Tab') {
      e.preventDefault()
      e.stopImmediatePropagation()
      // TODO: Select nex item
    } else if (e.key === 'Tab' && e.shiftKey) {
      e.preventDefault()
      e.stopImmediatePropagation()
      // TODO: Select prev item
    }
  }

  function onMouseMove(e: MouseEvent) {
    cursorPos = { x: e.clientX, y: e.clientY }
  }
</script>

<svelte:window on:mousemove={onMouseMove} on:keydown={onKeyDown} />

{#if $flyMenuOpen}
  <div
    class="flyMenuWrapper"
    class:cursorMode={$flyMenuType === 'cursor'}
    class:default={$flyMenuType === 'cmdk'}
    style={offset}
    bind:this={flyMenuEl}
    bind:clientWidth={flyMenuWidth}
    bind:clientHeight={flyMenuHeight}
    transition:fly={{ duration: 100, y: 50, easing: quadOut }}
  >
    <Command.Root label="Fly Menu" class="flyMenu raycast" loop {state}>
      <Command.List>
        <Command.Empty>No results found.</Command.Empty>

        {#each $flyMenuItems as item (item.value)}
          <Command.Item value={item.value} class="item-{item.type}">
            <span class="icn">
              {#if item.type === 'app'}
                <!-- TODO: Serices is nice, but this should be not browser card specific! -->
                <img src={getServiceIcon(item.value.toLowerCase())} />
              {:else}
                {item.icon}
              {/if}
            </span>
            {item.value}</Command.Item
          >
        {/each}
      </Command.List>
      <Command.Input placeholder="Type a query" bind:el={inputEl} on:keydown={onInputKeyDown} />
    </Command.Root>
  </div>
{/if}

<style lang="scss">
</style>
