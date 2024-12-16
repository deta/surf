<script lang="ts">
  import { createEventDispatcher, tick } from 'svelte'

  export let tabs: { id: string; label: string }[]
  export let activeTab: string

  const dispatch = createEventDispatcher()

  async function handleTabClick(tabId: string) {
    activeTab = tabId
    await tick()
    dispatch('tabChange', tabId)
  }
</script>

<div class="tab-container">
  {#each tabs as tab}
    <button
      class="tab-button"
      class:active={activeTab === tab.id}
      on:click={() => handleTabClick(tab.id)}
    >
      {tab.label}
    </button>
  {/each}
</div>
<div class="content-container">
  <slot name="content" />
</div>

<style lang="scss">
  .tab-container {
    display: flex;
    justify-content: center;
    border-radius: 1.25rem;
    padding: 0.3125rem;
    gap: 0.5rem;
  }
  .tab-button {
    background-color: transparent;
    border: none;
    padding: 0.875rem 2rem 0.95rem 2rem;
    border-radius: 2rem;

    font-family: 'Inter', sans-serif;
    font-size: 1.25rem;
    line-height: 1;
    font-weight: 500;
    color: white;
    transition:
      background-color 0.3s,
      color 0.3s;
  }
  .tab-button:hover {
    background-color: rgba(255, 255, 255, 0.2);
  }
  .tab-button.active {
    background-color: white;
    color: #4a90e2;
  }
  .content-container {
    background-color: white;
    border-radius: 1.25rem;
    padding: 1.25rem;
    min-height: 30.75rem;
    box-shadow: 0 0.125rem 0.625rem rgba(0, 0, 0, 0.1);
    font-weight: 500;
    width: 100%;
    overflow: hidden;
    height: auto;
    position: relative;
    transition: height 0.3s ease;
  }
</style>
