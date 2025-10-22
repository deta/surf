<script lang="ts">
  import { Icon, type Icons } from '@deta/icons'
  import type { ImportStatus } from './ImporterV2.svelte'

  export let label: string
  export let icon: Icons
  export let status: ImportStatus = 'idle'
  export let count: number = 0
  export let checked: boolean = false
  export let disabled: boolean = false
</script>

<!-- svelte-ignore a11y-label-has-associated-control -->
<label class="data-item" class:data-item--disabled={disabled}>
  <div class="data-label">
    <Icon name={icon} size="22px" />
    <div class="data-name">{label}</div>
  </div>

  {#if disabled}
    <div>
      {#if status === 'idle'}
        Not supported yet
      {:else}
        Skipped
      {/if}
    </div>
  {:else if status === 'idle'}
    <input type="checkbox" bind:checked />
  {:else if status === 'importing'}
    <Icon name="spinner" size="20px" />
  {:else if status === 'done'}
    <div class="data-label">
      <div class="data-count">
        {count} imported
      </div>
      <Icon name="check" size="20px" />
    </div>
  {:else if status === 'error'}
    <Icon name="alert-triangle" size="20px" className="text-orange-500" />
  {/if}
</label>

<style lang="scss">
  .data-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1rem;
    border-radius: 12px;
    background-color: #f3f4f6;
    color: #000000;

    :global(.dark) & {
      color: #e5e5e5;
      background-color: #2a2a2a;
    }

    &.data-item--disabled {
      opacity: 0.5;
    }

    input[type='checkbox'] {
      cursor: pointer;
      width: 20px;
      height: 20px;
      margin-left: auto;

      &:disabled {
        opacity: 0.5;
      }
    }

    .data-label {
      display: flex;
      align-items: center;
      gap: 1rem;

      .data-name {
        font-size: 1.2rem;
        font-weight: 500;
      }
    }
  }
</style>
