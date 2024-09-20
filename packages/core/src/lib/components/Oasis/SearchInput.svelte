<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte'

  import { useDebounce } from '@horizon/utils'
  import { Command } from '../index'
  import { Icon } from '@horizon/icons'

  export let value: string = ''
  export let loading = false

  const dispatch = createEventDispatcher<{ search: string; chat: string; close: void }>()

  const search = () => {
    dispatch('search', value)
  }

  const debouncedSearch = useDebounce(search, 700)

  let inputRef: HTMLInputElement

  onMount(() => {
    inputRef.focus()
  })

  const handleKeyDown = (event: KeyboardEvent) => {
    event.stopPropagation()
    // check if key is searchable (alphanumeric, backspace, delete, etc.)
    if (event.key.length === 1 || event.key === 'Backspace' || event.key === 'Delete') {
      debouncedSearch()
    } else if (event.key === 'Enter') {
      dispatch('search', value)
    } else if (event.key === 'Escape') {
      dispatch('close')
    }
  }
</script>

<div class="flex items-center bg-white px-4 rounded-xl gap-2">
  {#if loading}
    <Icon name="spinner" class="shrink-0 opacity-50 icon" />
  {:else}
    <Icon name="search" class="shrink-0 opacity-50 icon" />
  {/if}
  <input
    bind:this={inputRef}
    bind:value
    type="message"
    name="message"
    placeholder="Search"
    class="placeholder:text-neutral-500 flex w-full max-w-[calc(100%-3rem)] text-xl rounded-md bg-transparent py-2.5 outline-none disabled:cursor-not-allowed disabled:opacity-50"
    on:keydown={handleKeyDown}
  />
</div>

<style lang="scss">
  .icon {
    view-transition-name: search-icon-transition;
  }

  input {
    view-transition-name: search-input-transition;
  }
</style>
