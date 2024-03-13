<script context="module" lang="ts">
  export const flyMenuOpen = writable(false)
  export const flyMenuType = writable<'cursor' | 'cmdk'>('cursor')
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
  import { createEventDispatcher, onDestroy, onMount, tick } from 'svelte'
  import { cubicOut, quadInOut, quadOut } from 'svelte/easing'
  import type { Readable } from 'svelte/motion'
  import { derived, writable, type Writable } from 'svelte/store'
  import { fly, scale } from 'svelte/transition'
  import { type IFlyMenuItem } from './flyMenu'
  import { posToAbsolute } from '@horizon/tela'
  import { APP_BAR_WIDTH } from '../../constants/horizon'
  import { getServiceIcon, getServiceRanking } from '../../utils/services'
  import { SERVICES } from '@horizon/web-parser'

  export let viewOffset: Readable<{ x: number; y: number }>
  export let viewPort: Readable<{ x: number; y: number; w: number; h: number }>
  export let origin: Readable<{ x: number; y: number; width: number; height: number } | undefined>

  const dispatch = createEventDispatcher()

  const state = createState()
  const searchVal = writable('')
  $: search = $state.search

  let flyMenuEl: HTMLElement
  let inputEl: HTMLInputElement

  let pos = { x: 0, y: 0 }

  let flyMenuWidth = 0
  let flyMenuHeight = 0

  let cursorPos = {
    x: $origin ? $origin.x + $origin.width - flyMenuWidth : 0,
    y: $origin ? $origin.y + $origin.height - flyMenuHeight : 0
  }

  function calcPos(p: { x: number; y: number }, flyMenuWidth: number, flyMenuHeight: number) {
    const screenX = p.x - $viewOffset.x
    let x = p.x
    let y = p.y

    if (screenX < 0) x = $viewOffset.x
    if (screenX + flyMenuWidth > $viewPort.w) x = x - (screenX + flyMenuWidth - $viewPort.w)
    if (y - flyMenuHeight < 0) y = 0
    if (y + flyMenuHeight + 30 > $viewPort.h) y = y - (y + flyMenuHeight + 30 - $viewPort.h)
    //if (y + flyMenuHeight > $viewPort.h) y = y - (y + flyMenuHeight - $viewPort.h)

    return { x, y }
  }

  $: offsetFollowCursor = `left: ${calcPos(pos, flyMenuWidth, flyMenuHeight).x}px; top: ${calcPos(pos, flyMenuWidth, flyMenuHeight).y}px;`
  $: offset = $flyMenuType === 'cursor' ? offsetFollowCursor : `left: ${$viewOffset.x}px;`

  $: if ($flyMenuOpen) {
    // setTimeout(() => {
    //   inputEl.focus({ preventScroll: true })
    // }, 80)
  } else {
    $searchVal = ''
  }

  function onKeyDown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      closeFlyMenu()
      $searchVal = ''
    } else if (e.key === 'Enter' && $flyMenuOpen) {
      submit()
    }
  }
  function submit() {
    dispatch('command', {
      cmd: $state.value,
      origin: $flyMenuType,
      targetRect: $origin
    })
    closeFlyMenu()
    //state = createState()
    $state.search = ''
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

  function onClick(e: MouseEvent) {
    submit()
  }

  function onMouseMove(e: MouseEvent) {
    cursorPos = { x: e.clientX, y: e.clientY }
  }

  const filteredItems = derived([flyMenuItems, searchVal], ([_items, _searchVal]) => {
    if ($searchVal === '') return _items
    const out = []
    const query = $searchVal.toLowerCase()
    for (let item of _items) {
      if (item.value.toLowerCase().includes(query)) {
        out.push(item)
      }
    }

    // If no main items found add all services and filter those
    if (out.length === 0) {
      const services = SERVICES.map((s) => ({
        name: s.name,
        rank: getServiceRanking(s.id)
      })).filter((e) => e.name.toLowerCase().includes(query))
      for (let service of services) {
        out.push({
          type: 'app',
          value: `${service.name}`,
          icon: ''
        })
      }
    }

    return out
  })

  onDestroy(
    flyMenuOpen.subscribe((v) => {
      pos = { x: $viewOffset.x + cursorPos.x - APP_BAR_WIDTH, y: cursorPos.y }
    })
  )
  onDestroy(() => {
    closeFlyMenu()
  })
</script>

<svelte:window on:mousemove={onMouseMove} on:keydown={onKeyDown} />

<!--     transition:scale={{ duration: 100, opacity: 0, easing: quadOut }}
 -->
{#if $flyMenuOpen}
  <div
    class="flyMenuWrapper"
    class:open={$flyMenuOpen}
    class:cursorMode={$flyMenuType === 'cursor'}
    class:default={$flyMenuType === 'cmdk'}
    bind:this={flyMenuEl}
    style={offset}
    bind:clientWidth={flyMenuWidth}
    bind:clientHeight={flyMenuHeight}
    on:mousedown={onClick}
    transition:scale={{ duration: 100, opacity: 0, easing: quadOut }}
  >
    <Command.Root label="Fly Menu" class="flyMenu raycast" {state} loop shouldFilter={true}>
      <Command.List>
        <Command.Empty>No results found.</Command.Empty>

        <!--         {#key $searchVal} -->
        {#each $filteredItems as item (item.value)}
          <Command.Item value={item.value} class="item-{item.type}">
            <span class="icn">
              {#if item.type === 'app'}
                <img src={getServiceIcon(item.value.toLowerCase())} />
              {:else}
                {item.icon}
              {/if}
            </span>
            {item.value}
          </Command.Item>
        {/each}
        <!--         {/key} -->
      </Command.List>
      <!--<Command.Input
        placeholder="Type a query"
        bind:el={inputEl}
        bind:value={$searchVal}
        on:keydown={onInputKeyDown}
      />-->
    </Command.Root>
  </div>
{/if}

<style lang="scss">
</style>
