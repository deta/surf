<script lang="ts">
  import { Icon } from '@horizon/icons'
  import FileIcon from './File/FileIcon.svelte'
  import type { Source } from './Preview.svelte'
  import { getFileKind } from '@horizon/utils'
  import Image from '../../Atoms/Image.svelte'

  export let type: string
  export let source: Source
  export let themed: boolean = false
</script>

<div class="source" class:themed>
  <div class="icon">
    {#if source.imageUrl}
      <Image src={source.imageUrl} alt={source.text} fallbackIcon="link" />
    {:else if source.icon}
      <Icon name={source.icon} />
    {:else}
      <FileIcon kind={getFileKind(type)} width="100%" height="100%" />
    {/if}
  </div>

  <div class="text">
    {source.text}
  </div>
</div>

<style lang="scss">
  .source {
    display: flex;
    align-items: center;
    gap: 0.5em;
  }

  .icon {
    flex-shrink: 0;
    width: 1.25em;
    height: 1.25em;
  }

  .text {
    font-size: 1em;
    font-weight: 500;
    text-decoration: none;
    opacity: 0.65;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .themed {
    .text {
      opacity: 1;
    }
  }
</style>
