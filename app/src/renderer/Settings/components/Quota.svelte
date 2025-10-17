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
    background-color: light-dark(var(--color-surface, #f9fafb), rgba(15, 23, 42, 0.6));
    border: 1px solid light-dark(var(--color-border, #e5e7eb), rgba(71, 85, 105, 0.4));
  }

  .usage-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .label {
    font-weight: 500;
    color: light-dark(var(--color-text, #111827), var(--on-surface-dark, #cbd5f5));
  }

  .progress-container {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .reset-info {
    font-size: 0.75rem;
    color: light-dark(var(--color-text-muted, #9ca3af), var(--text-subtle-dark, #94a3b8));
  }
</style>
