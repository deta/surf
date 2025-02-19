<script lang="ts" context="module">
  export type ViewChangeEvent = {
    viewType: ContextViewType
    viewDensity: ContextViewDensity
  }
</script>

<script lang="ts">
  import { writable } from 'svelte/store'
  import { Icon } from '@horizon/icons'
  import CustomPopover from '../../Atoms/CustomPopover.svelte'
  import {
    ContextViewDensities,
    ContextViewTypes,
    type ContextViewDensity,
    type ContextViewType
  } from '@horizon/types'
  import { createEventDispatcher } from 'svelte'

  export let open = writable(false)
  export let viewType: ContextViewType | undefined
  export let viewDensity: ContextViewDensity | undefined

  const dispatch = createEventDispatcher<{ change: ViewChangeEvent }>()

  let viewTypeEl: HTMLSelectElement
  let viewDensityEl: HTMLSelectElement

  const handleViewSettingsUpdate = () => {
    dispatch('change', {
      viewType: viewTypeEl.value as ContextViewType,
      viewDensity: viewDensityEl.value as ContextViewDensity
    })
  }
</script>

<CustomPopover
  position="top"
  openDelay={200}
  sideOffset={10}
  popoverOpened={open}
  disableTransition={false}
  forceOpen
  portal="body"
  triggerClassName="w-fit h-full px-2"
  disableHover
  disabled={false}
>
  <div slot="trigger" class="w-fit shrink-1">
    <div class="w-min shrink-1"><Icon name="grid" size="1.22em" /></div>
  </div>

  <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
  <div
    slot="content"
    class="no-drag data-vaul-no-drag p-4 flex flex-col gap-2"
    data-ignore-click-outside
  >
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
  </div>
</CustomPopover>

<style lang="scss">
  .row {
    min-width: 23ch;
    span {
      width: 100%;
    }
    select {
      min-width: 12ch;

      &:active,
      &:focus {
        outline: none;
      }
    }
  }
</style>
