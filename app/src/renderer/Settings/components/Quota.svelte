<script lang="ts">
  import type { Quota } from '@deta/backend/types'
  import UsageBar from './UsageBar.svelte'
  import { getFormattedDate } from '@deta/utils'

  export let label: string
  export let quota: Partial<Quota>
</script>

<div class="usage-item">
  <div class="usage-header">
    <span class="label">{label}</span>
  </div>

  <div class="progress-container">
    <UsageBar used={quota.used} total={quota.total} />
  </div>

  {#if quota.resets_at}
    <div class="reset-info">
      Resets {getFormattedDate(quota.resets_at)}
    </div>
  {/if}
</div>

<style lang="scss">
  .usage-item {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    padding: 1rem;
    border-radius: 0.5rem;
    background-color: var(--color-surface, #f9fafb);
    border: 1px solid var(--color-border, #e5e7eb);
  }

  .usage-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .label {
    font-weight: 500;
    color: var(--color-text, #111827);
  }

  .progress-container {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .reset-info {
    font-size: 0.75rem;
    color: var(--color-text-muted, #9ca3af);
  }
</style>
