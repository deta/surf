<script lang="ts">
  import type { Quota } from '@horizon/backend/types'
  import UsageBar from './UsageBar.svelte'
  import { getFormattedDate, getFormattedTime, tooltip } from '@horizon/utils'

  export let label: string
  export let quota: Quota

  $: percentUsed = Math.min(Math.floor((quota.used / quota.total) * 100), 100)
  $: limitReached = quota.used >= quota.total
  $: resetsAt = `${getFormattedDate(quota.resets_at)} ${getFormattedTime(quota.resets_at, false)}`

  // convert LLM token counts like 1000000 to 1M or 431901 to 432K
  const humanReadableTokenCount = (num: number) => {
    const tier = (Math.log10(num) / 3) | 0
    const suffix = ['', 'K', 'M', 'B', 'T']
    const scale = Math.pow(10, tier * 3)
    const scaled = num / scale
    return scaled.toFixed(1) + suffix[tier]
  }
</script>

<div class="space-y-3">
  <div class="flex items-center justify-between">
    <div class="font-medium">
      {label}
    </div>

    <div class="flex items-center gap-1">
      <div
        class="tabular-nums text-black/50"
        use:tooltip={{
          text: `Used ${humanReadableTokenCount(quota.used)} out of ${humanReadableTokenCount(quota.total)} Tokens`
        }}
      >
        {percentUsed}%
      </div>

      <!-- <div class="text-black/50">/</div> -->

      <!-- <div class="tabular-nums text-black/50" use:tooltip={{ text: `Total ${humanReadableTokenCount(quota.total)} Tokens` }}>
        100
      </div> -->
    </div>
  </div>

  <UsageBar used={quota.used} total={quota.total} />

  {#if limitReached}
    <div class="text-red-500 text-sm">
      Limit reached, this tier is no longer available until the next cycle ({resetsAt})
    </div>
  {/if}
</div>
