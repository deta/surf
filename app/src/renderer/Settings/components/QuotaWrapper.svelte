<script lang="ts" context="module">
  import type { Quota } from '@deta/backend/types'

  // prettier-ignore
  export type ParsedQuota = {
        daily: {
            input: Quota,
            output: Quota
        },
        monthly: {
            input: Quota
            output: Quota
        }
    };
</script>

<script lang="ts">
  export let name: string
</script>

<div class="wrapper">
  <div class="flex items-center justify-between gap-2">
    <h3 class="text-lg font-medium">{name}</h3>

    <slot name="tabs"></slot>
  </div>

  <slot></slot>
</div>

<style lang="scss">
  .wrapper {
    width: 100%;
    border-radius: 0.75rem;
    color: var(--color-text);
    display: flex;
    flex-direction: column;
    gap: 1rem;
    padding: 1.25rem;
    background: #e6e6e6;
  }
</style>
