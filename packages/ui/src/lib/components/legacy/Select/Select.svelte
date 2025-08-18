<script lang="ts">
  import { createEventDispatcher } from 'svelte'
  import { type Writable } from 'svelte/store'

  export let selectedFilter: Writable<string>
  const dispatch = createEventDispatcher()

  function handleChange() {
    dispatch('change', selectedFilter)
  }
</script>

<div class="select-wrapper">
  <select
    bind:value={$selectedFilter}
    on:change={handleChange}
    class="bg-transparent focus:outline-none"
  >
    <slot />
  </select>
</div>

<style lang="scss">
  .select-wrapper {
    border-radius: 0.5rem;
    background-color: white;
    height: fit-content;
    padding: 0.5rem;
    position: relative;
    border: 1px solid transparent;
    color: #586884;
    font-weight: 500;
    background-image: linear-gradient(white, white), linear-gradient(180deg, #00376430, #00376460);
    background-origin: border-box;
    background-clip: padding-box, border-box;
    box-shadow:
      0px 13px 4px 0px,
      0px 8px 3px 0px rgba(0, 55, 100, 0.01),
      0px 5px 3px 0px rgba(0, 55, 100, 0.03),
      0px 2px 2px 0px rgba(0, 55, 100, 0.05),
      0px 1px 1px 0px rgba(0, 55, 100, 0.06);
    box-shadow:
      0px 13px 4px 0px color(display-p3 0.0078 0.2118 0.3804 / 0),
      0px 8px 3px 0px color(display-p3 0.0078 0.2118 0.3804 / 0.01),
      0px 5px 3px 0px color(display-p3 0.0078 0.2118 0.3804 / 0.03),
      0px 2px 2px 0px color(display-p3 0.0078 0.2118 0.3804 / 0.05),
      0px 1px 1px 0px color(display-p3 0.0078 0.2118 0.3804 / 0.06);
  }
</style>
