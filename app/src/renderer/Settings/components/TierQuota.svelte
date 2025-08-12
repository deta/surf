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
  import { writable } from 'svelte/store'
  import QuotaItem from './Quota.svelte'
  import QuotaWrapper from './QuotaWrapper.svelte'

  export let name: string
  export let parsedQuota: ParsedQuota

  const tab = writable<'daily' | 'monthly'>('daily')
</script>

<QuotaWrapper {name}>
  <div slot="tabs" class="flex items-center gap-6">
    <button on:click={() => tab.set('daily')} class="tab" class:active={$tab === 'daily'}
      >Daily</button
    >
    <button on:click={() => tab.set('monthly')} class="tab" class:active={$tab === 'monthly'}
      >Monthly</button
    >
  </div>

  {#if $tab === 'daily'}
    <div class="tier">
      <QuotaItem label="Input Tokens" quota={parsedQuota.daily.input} />
      <QuotaItem label="Output Tokens" quota={parsedQuota.daily.output} />
    </div>
  {:else}
    <div class="tier">
      <QuotaItem label="Input Tokens" quota={parsedQuota.monthly.input} />
      <QuotaItem label="Output Tokens" quota={parsedQuota.monthly.output} />
    </div>
  {/if}
</QuotaWrapper>

<style lang="scss">
  .tab {
    padding: 0.25rem 0.5rem;
    font-size: 1rem;
    color: var(--color-text);
    border-bottom: 2px solid transparent;
    outline: none;

    opacity: 0.5;
    transition: opacity 0.2s ease;

    &.active {
      opacity: 0.8;
      border-color: var(--color-text-muted);
    }

    &:hover {
      opacity: 1;
    }
  }

  .tier {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }
</style>
