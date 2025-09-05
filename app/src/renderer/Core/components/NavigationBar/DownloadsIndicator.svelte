<script lang="ts">
  import { Icon } from '@deta/icons'
  import { useDownloadsManager } from '@deta/services'
  import type { DownloadState } from '@deta/types'
  import { Button } from '@deta/ui'

  const downloadsManager = useDownloadsManager()

  let downloadState = $derived<DownloadState>(downloadsManager.downloadState)
  let downloadProgress = $derived(downloadsManager.downloadProgress)
</script>

{#if downloadState !== 'idle'}
  <Button size="md" style="padding-block: 6px;padding-inline: 8px;">
    {#if downloadState === 'completed'}
      <div class="download-indicator-label">
        <Icon name="check" />
        Download completed
      </div>
    {:else if downloadState === 'progressing'}
      <div class="download-indicator-label">
        <svg class="progress-ring" width="15" height="15" viewBox="0 0 24 24">
          <circle
            class="progress-ring__background"
            stroke="currentColor"
            stroke-width="3"
            fill="transparent"
            r="10"
            cx="12"
            cy="12"
          />
          <circle
            class="progress-ring__circle"
            stroke="currentColor"
            stroke-width="3"
            fill="transparent"
            r="10"
            cx="12"
            cy="12"
            style="stroke-dashoffset: {(1 - downloadProgress / 100) * 62.8}px"
          />
        </svg>
        <div>
          {downloadProgress}%
        </div>
      </div>
    {:else if downloadState === 'interrupted' || downloadState === 'cancelled'}
      <Icon name="warning" />
    {/if}
  </Button>
{/if}

<style lang="scss">
  .download-indicator {
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .download-indicator-label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.875rem;
    font-variant-numeric: tabular-nums;
  }

  .progress-ring {
    transform: rotate(-90deg);

    &__background {
      opacity: 0.2;
    }

    &__circle {
      stroke-dasharray: 62.8; // Approximately 2 * PI * 10 (radius)
      transition: stroke-dashoffset 0.1s ease;
    }
  }
</style>
