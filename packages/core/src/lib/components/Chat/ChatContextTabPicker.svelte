<script lang="ts">
  import { Command, createState } from '@horizon/cmdk-sv'
  import { cn } from '../../utils/tailwind'
  import type { Tab } from '../../types'
  import { createEventDispatcher, onMount } from 'svelte'
  import SpaceIcon from '../Atoms/SpaceIcon.svelte'
  import { tooltip } from '@horizon/utils'
  import { useOasis } from '../../service/oasis'

  export let tabItems: Tab[] = []
  const oasis = useOasis()

  const dispatch = createEventDispatcher<{
    'include-tab': string
    close: void
  }>()

  let ref: HTMLDivElement
  const state = createState({
    value: `${tabItems[0].title};;${tabItems[0].type === 'page' ? `${tabItems[0].currentLocation};;` : ''}${tabItems[0].id}`
  })
  let search = ''

  async function handleSubmitItem() {
    dispatch('include-tab', $state.value.split(';;')[$state.value.split(';;').length - 1])
    search = ''
    const inpEl = ref.querySelector('input') as HTMLInputElement
    inpEl?.focus()
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      dispatch('close')
    } else if (e.key === 'Enter') {
      e.preventDefault()
      e.stopPropagation()
      handleSubmitItem()
    }
  }

  async function handleMouseUp(e: MouseEvent) {
    // bit crude to ignore if open button butt well
    function hasClassOrParentWithClass(el: Element, className: string) {
      if (el.classList.contains(className)) return true
      if (el.parentElement) return hasClassOrParentWithClass(el.parentElement, className)
      return false
    }

    // NOTE: e.target === window if passthrough from webview
    if (
      e.target === window ||
      (ref &&
        !ref.contains(e.target as Node) &&
        !hasClassOrParentWithClass(e.target as Element, 'open-tab-picker'))
    ) {
      dispatch('close')
      return
    }
    const inpEl = ref.querySelector('input') as HTMLInputElement
    inpEl?.focus()
  }

  onMount(() => {
    // wtf are we doing at this point.. svelte component libaries which dont fucking expose their stuf.f.. aaa
    ref = document.querySelector('.chat [data-cmdk-root]') as HTMLDivElement
  })
</script>

<svelte:window on:mouseup={handleMouseUp} />

<!-- NOTE: NIE id=...!! CMDvK breakt sondt >:( -->
<Command.Root
  loop
  {state}
  label="chat-add-context-tabs"
  class={cn('bg-sky-100 shadow-xl p-2 border-sky-200 border-2 rounded-xl')}
>
  {#if tabItems.length > 0}
    <button
      on:click={() => {
        for (const t of tabItems) {
          dispatch('include-tab', t.id)
        }
        dispatch('close')
      }}
      class="add-app-btn active:scale-95 shadow-xl appearance-none w-fit mx-auto border-0 group margin-0 flex items-center px-3 py-1 bg-sky-200 hover:bg-sky-200 transition-colors duration-200 rounded-xl text-sky-800 cursor-pointer text-xs"
      use:tooltip={{
        text: '⌘ + Shift + A',
        position: 'left'
      }}
    >
      Add all
    </button>
  {/if}
  <Command.List>
    <Command.Empty>No tabs to add.</Command.Empty>
    {#each tabItems as tab}
      <Command.Item
        value={`${tab.title};;${tab.type === 'page' ? `${tab.currentLocation};;` : ''}${tab.id}`}
        on:click={handleSubmitItem}
      >
        <div
          style="width: 14px; aspect-ratio: 1 / 1; display: block; user-select: none; flex-shrink: 0;"
        >
          {#if tab.type !== 'space'}
            <img
              src={tab.icon}
              alt={tab.title}
              class="w-full h-full object-contain"
              style="transition: transform 0.3s;"
              loading="lazy"
            />
          {:else}
            {#await oasis.getSpace(tab.spaceId) then fetchedSpace}
              {#if fetchedSpace}
                <SpaceIcon folder={fetchedSpace} />
              {/if}
            {/await}
          {/if}
        </div>
        <span class="truncate">{tab.title}</span>
      </Command.Item>
    {/each}
  </Command.List>
  <Command.Input
    bind:value={search}
    autofocus
    on:keydown={handleKeyDown}
    class={cn('rounded-lg px-2 py-1 mt-2')}
  />
</Command.Root>

<style lang="scss">
  /* NOTE: WHyyyy only tailwind? cant select anything by a meaningful name any more :') */
  :global([aria-labelledby='chat'] [data-cmdk-root]) {
    position: absolute;
    /* we should just use isolation: isolate for contained things like the sidebar insted of these zindices */
    z-index: 99999999;
    top: -0.75rem;
    right: 0;
    transform: translateY(-100%);
    min-width: 30ch;
    max-width: 30ch;

    :global([data-cmdk-empty]) {
      opacity: 0.8;
    }

    :global([data-cmdk-list]) {
      height: var(--cmdk-list-height);
      max-height: 310px;
      transition: height 100ms ease-out;
      scroll-padding-block-start: 8px;
      scroll-padding-block-end: 8px;
      overflow: hidden;
      overflow-y: auto;
      font-size: 0.9em;
    }

    :global(input[type='text']) {
      width: 100%;

      &:focus {
        outline: 1.5px solid rgba(202, 205, 212, 1);
      }
    }

    :global([data-cmdk-item]) {
      padding: 0.25rem 0.5rem;
      border-radius: 0.5rem;
      user-select: none;
      display: flex;
      align-items: center;
      gap: 0.4rem;

      :global(.color-icon) {
        min-width: unset;
        min-height: unset;
      }
    }

    :global([data-selected='true']) {
      background-color: rgba(0, 0, 0, 0.1);
    }

    :global(.add-app-btn) {
      position: absolute;
      top: 0;
      left: 50%;
      transform: translate(-50%, -50%);
      padding-block: 0.3rem;
    }
  }
</style>
