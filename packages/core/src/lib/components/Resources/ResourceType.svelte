<script lang="ts">
  import { Icon } from '@horizon/icons'
  import { ResourceTypes } from '@deta/types'
  import FileIcon from './Previews/File/FileIcon.svelte'
  import { getFileKind, getFileType } from '@deta/utils'

  export let type: string
</script>

<div class="type">
  {#if type === ResourceTypes.LINK}
    <Icon name="link" size="20px" />
    <div class="label">Link</div>
  {:else if type.startsWith(ResourceTypes.ARTICLE)}
    <Icon name="link" size="20px" />
    <div class="label">Article</div>
  {:else if type.startsWith(ResourceTypes.CHAT_MESSAGE)}
    <Icon name="docs" size="20px" />
    <div class="label">Message</div>
  {:else if type.startsWith(ResourceTypes.CHAT_THREAD)}
    <Icon name="link" size="20px" />
    <div class="label">Thread</div>
  {:else if type.startsWith(ResourceTypes.DOCUMENT)}
    <Icon name="docs" size="20px" />
    <div class="label">Document</div>
  {:else}
    <FileIcon kind={getFileKind(type)} width="20px" height="20px" />
    <div class="">{getFileType(type) ?? 'File'}</div>
  {/if}
</div>

<style lang="scss">
  .type {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    font-size: 1rem;
    font-weight: 500;
    color: inherit;
  }
</style>
