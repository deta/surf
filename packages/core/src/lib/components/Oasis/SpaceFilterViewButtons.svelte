<script lang="ts" context="module">
  export type ViewChangeEvent = {
    viewType: ContextViewType
    viewDensity: ContextViewDensity
  }
  export type FilterChangeEvent = {
    filter: FilterItem | null
  }
  export type SortByChangeEvent = {
    sortBy: string
  }
  export type OrderChangeEvent = {
    order: string
  }
</script>

<script lang="ts">
  import { Icon } from '@deta/icons'
  import {
    ContextViewDensities,
    ContextViewTypes,
    type ContextViewDensity,
    type ContextViewType
  } from '@deta/types'
  import CustomPopover from '../Atoms/CustomPopover.svelte'
  import { writable } from 'svelte/store'
  import { createEventDispatcher } from 'svelte'
  import { RESOURCE_FILTERS, CONTEXT_FILTERS, ALL_FILTERS } from '../../constants/resourceFilters'
  import { tooltip } from '@deta/utils/dom'
  import type { FilterItem } from './FilterSelector.svelte'

  export let viewType: ContextViewType | undefined
  export let viewDensity: ContextViewDensity | undefined
  export let filter: string | null
  export let sortBy: string | undefined
  export let order: string | null
  export let hideSortingSettings: boolean = false
  export let hideFilterSettings: boolean = false
  export let showContextsFilter: boolean = false

  const dispatch = createEventDispatcher<{
    changedFilter: FilterChangeEvent
    changedView: ViewChangeEvent
    changedSortBy: SortByChangeEvent
    changedOrder: OrderChangeEvent
  }>()

  let viewTypeEl: HTMLSelectElement
  let viewDensityEl: HTMLSelectElement

  let viewFilterEl: HTMLSelectElement

  let viewSortingEl: HTMLSelectElement
  let viewOrderEl: HTMLSelectElement

  const handleViewSettingsUpdate = () => {
    dispatch('changedView', {
      viewType: viewTypeEl.value as ContextViewType,
      viewDensity: viewDensityEl.value as ContextViewDensity
    })
  }

  const handleFilterSettingsUpdate = () => {
    const value = viewFilterEl.value as string
    const filter = ALL_FILTERS.find((filter) => filter.id === value)
    if (filter) {
      dispatch('changedFilter', {
        filter
      })
    }
  }

  const handleSortingSettingsUpdate = () => {
    const value = viewSortingEl.value as string

    dispatch('changedSortBy', {
      sortBy: value
    })
  }

  const handleOrderSettingsUpdate = () => {
    const value = viewOrderEl.value as string

    dispatch('changedOrder', {
      order: value
    })
  }

  const viewPopoverOpened = writable(false)
  const filterPopoverOpen = writable(false)
</script>

{#if !hideFilterSettings}
  <CustomPopover
    position="bottom"
    openDelay={200}
    sideOffset={10}
    popoverOpened={filterPopoverOpen}
    disableTransition={false}
    forceOpen
    portal="body"
    triggerClassName="w-fit h-full"
    disableHover
    disabled={false}
  >
    <div slot="trigger" class="w-fit shrink-1">
      <button
        class:active={$filterPopoverOpen}
        use:tooltip={{
          position: 'bottom',
          text: 'Filter items by type'
        }}
      >
        <Icon name="filter" size="1.4em" />
      </button>
    </div>

    <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
    <div slot="content" class="no-drag p-4 flex flex-col gap-2" data-ignore-click-outside>
      <div class="row flex space-between">
        <span class="font-medium opacity-80">Filter by</span>
        <select
          bind:this={viewFilterEl}
          value={filter ?? 'all'}
          on:change={handleFilterSettingsUpdate}
        >
          <option value="all" selected>All Types</option>

          {#each RESOURCE_FILTERS as filter (filter.id)}
            <option value={filter.id}>{filter.label}</option>
          {/each}
          {#if showContextsFilter}
            {#each CONTEXT_FILTERS as filter (filter.id)}
              <option value={filter.id}>{filter.label}</option>
            {/each}
          {/if}
        </select>
      </div>
    </div>
  </CustomPopover>
{/if}

<CustomPopover
  position="bottom"
  openDelay={200}
  sideOffset={10}
  popoverOpened={viewPopoverOpened}
  disableTransition={false}
  forceOpen
  portal="body"
  triggerClassName="w-fit h-full"
  disableHover
  disabled={false}
>
  <div slot="trigger" class="w-fit shrink-1">
    <button
      class:active={$viewPopoverOpened}
      use:tooltip={{
        position: 'bottom',
        text: 'Change how items are shown'
      }}
    >
      <Icon name="grid" size="1.4em" />
    </button>
  </div>

  <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
  <div slot="content" class="no-drag p-4 flex flex-col gap-2" data-ignore-click-outside>
    <div class="row flex space-between">
      <span class="font-medium opacity-80">View Type</span>
      <select
        bind:this={viewTypeEl}
        value={viewType ?? ContextViewTypes.Masonry}
        on:change={handleViewSettingsUpdate}
      >
        <option value="masonry">Masonry</option>
        <option value="grid">Grid</option>
        <!--<option value="list">List</option>-->
      </select>
    </div>
    <div class="row flex space-between">
      <span class="font-medium opacity-80">Density</span>
      <select
        bind:this={viewDensityEl}
        value={viewDensity ?? ContextViewDensities.Cozy}
        on:change={handleViewSettingsUpdate}
      >
        {#each Object.entries(ContextViewDensities) as [density_name, density_value]}
          <option value={density_value}>{density_name}</option>
        {/each}
      </select>
    </div>

    {#if !hideSortingSettings}
      <hr />

      <div class="row flex space-between">
        <span class="font-medium opacity-80">Sort by</span>
        <select
          bind:this={viewSortingEl}
          value={sortBy ?? 'resource_added_to_space'}
          on:change={handleSortingSettingsUpdate}
        >
          <option value="resource_added_to_space">Added to Context</option>
          <option value="resource_created">First Saved</option>
          <option value="resource_updated">Last Modified</option>
          <option value="resource_source_published">Source Published</option>
          <!-- <option value="name">Name</option> -->
        </select>
      </div>

      <div class="row flex space-between">
        <span class="font-medium opacity-80">Order</span>
        <select
          bind:this={viewOrderEl}
          value={order ?? 'desc'}
          on:change={handleOrderSettingsUpdate}
        >
          <option value="desc"> Most Recent First </option>
          <option value="asc"> Oldest First </option>
        </select>
      </div>
    {/if}
  </div>
</CustomPopover>

<style lang="scss">
  button {
    appearance: none;
    display: flex;
    align-items: center;
    padding: 0.5em;
    border-radius: 0.75rem;
    border: none;
    font-size: 0.9rem;
    font-weight: 500;
    letter-spacing: 0.02rem;
    transition: all 123ms ease-in-out;

    color: rgb(from var(--contrast-color) r g b / 0.9);

    &:hover,
    &.active {
      color: #0369a1;
      background: rgb(232, 238, 241);
      color: var(--contrast-color);
      background: rgb(from var(--base-color) r g b / 0.4);
    }
  }

  .row {
    min-width: 28ch;
    span {
      width: 100%;
    }
    select {
      color: #646464;
      min-width: 17ch;

      &:active,
      &:focus {
        outline: none;
      }
    }
  }
</style>
