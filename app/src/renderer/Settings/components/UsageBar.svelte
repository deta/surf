<script lang="ts">
  export let used: number
  export let total: number
  export let label: string = ''
  export let showPercentage: boolean = true
  export let showValues: boolean = false
  export let size: 'sm' | 'md' | 'lg' = 'md'

  $: percentage = Math.round((used / total) * 100)
  $: remaining = total - used

  $: status = percentage >= 90 ? 'danger' : percentage >= 75 ? 'warning' : 'good'
</script>

<div class="usage-bar size-{size}">
  {#if label || showPercentage || showValues}
    <div class="bar-header">
      {#if label}
        <span class="label">{label}</span>
      {/if}
      <div class="bar-info">
        {#if showPercentage}
          <span class="percentage status-{status}">{percentage}%</span>
        {/if}
        {#if showValues}
          <span class="values">{used} / {total}</span>
        {/if}
      </div>
    </div>
  {/if}

  <div class="bar-container">
    <div class="bar-track">
      <div class="bar-fill status-{status}" style="width: {Math.min(percentage, 100)}%">
        <div class="bar-shine"></div>
      </div>
    </div>
  </div>

  {#if showValues && !label && !showPercentage}
    <div class="bar-footer">
      <span>{used} used</span>
      <span>{remaining} remaining</span>
    </div>
  {/if}
</div>

<style lang="scss">
  :root {
    --usage-good: light-dark(#10b981, #34d399);
    --usage-warning: light-dark(#f59e0b, #fbbf24);
    --usage-danger: light-dark(#ef4444, #f87171);
    --usage-bg: light-dark(#e5e7eb, rgba(51, 65, 85, 0.5));
    --usage-text: light-dark(#374151, #cbd5f5);
    --usage-text-muted: light-dark(#6b7280, #94a3b8);
    --usage-white: light-dark(#ffffff, #e5edff);
  }

  .usage-bar {
    width: 100%;

    &.size-sm {
      font-size: 0.75rem;

      .bar-track {
        height: 6px;
      }

      .bar-header,
      .bar-footer {
        margin-bottom: 0.375rem;
      }
    }

    &.size-md {
      font-size: 0.875rem;

      .bar-track {
        height: 8px;
      }
    }

    &.size-lg {
      font-size: 1rem;

      .bar-track {
        height: 12px;
      }

      .bar-header,
      .bar-footer {
        margin-bottom: 0.75rem;
      }
    }
  }

  .bar-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.5rem;

    .label {
      font-weight: 500;
      color: var(--usage-text);
    }

    .bar-info {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }

    .percentage {
      font-weight: 600;
    }

    .values {
      color: var(--usage-text-muted);
      font-size: 0.8em;
    }
  }

  .bar-container {
    width: 100%;
  }

  .bar-track {
    width: 100%;
    background: var(--usage-bg);
    border-radius: 9999px;
    overflow: hidden;
    position: relative;
    box-shadow: inset 0 1px 3px light-dark(rgba(0, 0, 0, 0.1), rgba(0, 0, 0, 0.3));
  }

  .bar-fill {
    height: 100%;
    border-radius: 9999px;
    position: relative;
    transition: width 0.6s cubic-bezier(0.4, 0, 0.2, 1);
    overflow: hidden;

    &.status-good {
      background: linear-gradient(90deg, var(--usage-good), #059669);
    }

    &.status-warning {
      background: linear-gradient(90deg, var(--usage-warning), #d97706);
    }

    &.status-danger {
      background: linear-gradient(90deg, var(--usage-danger), #dc2626);
    }
  }

  .bar-shine {
    position: absolute;
    top: 0;
    left: -100%;
    width: 100%;
    height: 100%;
    background: linear-gradient(
      90deg,
      transparent 0%,
      rgba(255, 255, 255, 0.4) 50%,
      transparent 100%
    );
  }

  .bar-footer {
    display: flex;
    justify-content: space-between;
    margin-top: 0.5rem;
    font-size: 0.75em;
    color: var(--usage-text-muted);
  }
</style>
