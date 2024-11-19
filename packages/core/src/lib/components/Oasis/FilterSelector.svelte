<script lang="ts" context="module">
  export type FilterItem = {
    id: string
    label: string
    tags: SFFSResourceTag[]
  }
</script>

<script lang="ts">
  import { createEventDispatcher } from 'svelte'
  import { derived, writable } from 'svelte/store'
  import { type SFFSResourceTag } from '@horizon/types'
  import { Icon } from '@horizon/icons'
  import { RESOURCE_FILTERS } from '../../constants/resourceFilters'

  export let selected = writable<string | null>(null)

  const dispatch = createEventDispatcher<{ change: FilterItem | null }>()

  const selectedAsString = derived(selected, ($selected) => {
    if ($selected === null) {
      return 'all'
    }

    return $selected
  })

  export const selectFilter = (id: string) => {
    selected.set(id)
  }

  const handleChange = (event: Event) => {
    const target = event.target as HTMLSelectElement
    const value = target.value

    selected.set(value)

    const filter = RESOURCE_FILTERS.find((filter) => filter.id === value) ?? null

    dispatch('change', filter)
  }
</script>

<div class="filters-wrapper">
  <div class="filter-icon">
    <Icon name="filter" />
  </div>

  <!-- <div class="filters">
    {#each filters as filter (filter.id)}
      <button
        class="filter"
        class:active={$selected === filter.id}
        on:click={() => handleClick(filter.id)}
      >
        {filter.label}
      </button>
    {/each}
  </div> -->

  <select class="filter-select" value={$selectedAsString} on:change={handleChange}>
    <option value="all" selected>All Types</option>

    {#each RESOURCE_FILTERS as filter (filter.id)}
      <option value={filter.id}>{filter.label}</option>
    {/each}
  </select>
</div>

<style lang="scss">
  .filters-wrapper {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.25rem;
    border-radius: 10px;
    color: #465b86;
    background-color: rgb(247, 252, 255);
    border: 1px solid rgb(186 230 253); // border-sky-200

    @media screen and (max-width: 1700px) {
      gap: 0;
    }

    @media screen and (max-width: 1100px) {
      padding: 0.25rem 0;
    }
  }

  .filter-icon {
    padding-left: 0.5rem;
    opacity: 0.5;

    @media screen and (max-width: 1170px) {
      display: none;
    }
  }

  .filters {
    display: flex;
    align-items: center;
    gap: 0.5rem;

    @media screen and (max-width: 1700px) {
      display: none;
    }
  }

  .filter {
    padding: 0.5rem 0.75rem;
    border-radius: calc(10px - 0.25rem);
    font-size: 1rem;
    font-weight: 400;
    cursor: pointer;
    transition: background-color 0.2s;

    &:hover {
      color: rgb(2 132 199); // text-sky-600
    }
  }

  .filter.active {
    color: rgb(7 89 133); // text-sky-800
    background: rgb(186 230 253); // bg-sky-200
  }

  .filter-select {
    padding: 0.5rem 0.5rem;
    border-radius: calc(10px - 0.25rem);
    font-size: 1rem;
    font-weight: 400;
    cursor: pointer;
    transition: background-color 0.2s;
    border: none;
    background: none;
    color: inherit;

    &:hover {
      color: rgb(2 132 199); // text-sky-600
    }

    &:focus {
      outline: none;
    }
    @media screen and (max-width: 1100px) {
      padding: 0.5rem 0.25rem;
      font-size: 0.9rem;
    }
  }
</style>
