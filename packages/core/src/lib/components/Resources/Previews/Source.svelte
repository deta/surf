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
    color: #281b53;
    width: 1.25em;
    height: 1.25em;

    img {
      width: 1.35em;
      height: 1.35em;
      border-radius: 5.1px;
      box-shadow:
        0px 0.425px 0px 0px rgba(65, 58, 86, 0.25),
        0px 0px 0.85px 0px rgba(0, 0, 0, 0.25);
    }
  }

  .text {
    font-size: 1em;
    font-weight: 500;
    text-decoration: none;
    color: #281b53;
    opacity: 0.65;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .themed {
    .text {
      color: #ffffff;
      opacity: 1;
    }

    .icon {
      color: #ffffff;
    }
  }
</style>
