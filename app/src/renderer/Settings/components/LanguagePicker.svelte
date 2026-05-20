<script lang="ts">
  import { createEventDispatcher } from 'svelte'

  export let value: 'en-US' | 'zh-CN' = 'en-US'
  const dispatch = createEventDispatcher<{ update: 'en-US' | 'zh-CN' }>()

  const AVAILABLE_LANGUAGES = [
    { code: 'en-US' as const, name: 'English' },
    { code: 'zh-CN' as const, name: '中文 (Chinese)' }
  ]
</script>

<div class="wrapper">
  <div class="text">
    <h3>Language</h3>
    <p class="description">Select the display language for the application.</p>
  </div>
  <select bind:value on:change={(e) => dispatch('update', e.target.value as 'en-US' | 'zh-CN')}>
    {#each AVAILABLE_LANGUAGES as lang}
      <option value={lang.code}>{lang.name}</option>
    {/each}
  </select>
</div>

<style lang="scss">
  .wrapper {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
  }

  .text {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  h3 {
    line-height: 1;
    font-size: 1.2rem;
    font-weight: 500;
    color: light-dark(var(--color-text), var(--on-surface-dark, #cbd5f5));
    margin: 0;
  }

  .description {
    font-size: 0.9rem;
    color: light-dark(var(--color-text-muted), var(--text-subtle-dark, #94a3b8));
    margin: 0;
  }

  select {
    font-size: 1.1rem;
    line-height: 1;
    padding: 0.5rem;
    border-radius: 8px;
    border: 1px solid light-dark(var(--color-border), rgba(71, 85, 105, 0.4));
    background: light-dark(var(--color-background), var(--surface-elevated-dark, #1b2435));
    color: light-dark(var(--color-text), var(--on-surface-dark, #cbd5f5));
    min-width: 20ch;
  }
</style>
