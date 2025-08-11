<script lang="ts">
  import type { PreviewMetadata } from '@horizon/core/src/lib/utils/resourcePreview'
  import { getFileKind } from '@deta/utils'

  import { Icon } from '@horizon/icons'
  import Image from '../../Atoms/Image.svelte'
  import FileIcon from './File/FileIcon.svelte'

  export let data: PreviewMetadata
  export let text: string | undefined = undefined
  export let type: string
</script>

<div class="source">
  {#if data.imageUrl}
    <div class="favicon">
      <Image src={data.imageUrl} alt={data.text ?? ''} emptyOnError fallbackIcon="link" />
    </div>
  {:else if data.icon}
    <div class="favicon">
      <Icon name={data.icon} size="100%" />
    </div>
  {:else}
    <div class="favicon">
      <FileIcon kind={getFileKind(type)} width="100%" height="100%" />
    </div>
  {/if}
  {#if text}
    <span>{text}</span>
  {/if}
</div>

<style lang="scss">
  .source {
    order: 0;
    display: flex;
    align-items: center;
    gap: 0.5em;
    font-size: 0.9em;
    max-width: 100%;
    width: 100%;

    > :global(img) {
      border-radius: 0.3em;
    }
    > span {
      font-weight: 500;
      letter-spacing: 0.2px;
      opacity: var(--text-muted-opacity);

      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
    }
  }

  .favicon {
    --size: 1.25em;
    width: var(--size);
    height: var(--size);
    max-width: var(--size);
    flex-shrink: 0;
  }
</style>
