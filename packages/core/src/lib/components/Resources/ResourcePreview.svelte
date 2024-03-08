<!-- <svelte:options immutable={true} /> -->

<script lang="ts">
  import { createEventDispatcher } from 'svelte'
  import { Icon } from '@horizon/icons'

  import TextPreview from '../Cards/Text/TextPreview.svelte'
  import LinkPreview from '../Cards/Link/LinkPreview.svelte'
  import type {
    Resource,
    ResourceArticle,
    ResourceChatMessage,
    ResourceLink,
    ResourceNote,
    ResourcePost
  } from '../../service/resources'
  import FilePreview from '../Cards/File/FilePreview.svelte'
  import { ResourceTypes } from '../../types'
  import DateSinceNow from '../DateSinceNow.svelte'
  import { getFileKind, getFileType } from '../../utils/files'
  import FileIcon from '../Cards/File/FileIcon.svelte'
  import PostPreview from '../Cards/Post/PostPreview.svelte'
  import ChatMessagePreview from '../Cards/ChatMessage/ChatMessagePreview.svelte'
  import ArticlePreview from '../Cards/Article/ArticlePreview.svelte'
  import ArticleProperties from '@horizon/drawer/src/lib/components/properties/ArticleProperties.svelte'

  export let resource: Resource

  const dispatch = createEventDispatcher<{ click: string }>()

  const handleClick = () => {
    dispatch('click', resource.id)
  }

  // TODO: figure out better way to do this
  $: textResource = resource as ResourceNote
  $: linkResource = resource as ResourceLink
  $: postResource = resource as ResourcePost
  $: articleResource = resource as ResourceArticle
  $: chatMessageResource = resource as ResourceChatMessage
</script>

<!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
<div on:click={handleClick} class="resource-preview">
  <div
    class="preview"
    class:reddit={resource.type === 'application/vnd.space.post.reddit'}
    class:twitter={resource.type === 'application/vnd.space.post.twitter'}
    class:slack={resource.type === 'application/vnd.space.chat-message.slack'}
  >
    {#if resource.type === ResourceTypes.DOCUMENT_SPACE_NOTE}
      <TextPreview resource={textResource} />
    {:else if resource.type === ResourceTypes.LINK}
      <LinkPreview resource={linkResource} />
    {:else if resource.type.startsWith(ResourceTypes.POST)}
      <PostPreview resource={postResource} type={resource.type} />
    {:else if resource.type.startsWith(ResourceTypes.ARTICLE)}
      <ArticlePreview resource={articleResource} />
    {:else if resource.type.startsWith(ResourceTypes.CHAT_MESSAGE)}
      <ChatMessagePreview resource={chatMessageResource} type={resource.type} />
    {:else}
      <FilePreview {resource} />
      <!-- {:else}
      <div class="text-base">Unknown</div> -->
    {/if}
  </div>

  <div class="details">
    <div class="type">
      {#if resource.type === ResourceTypes.DOCUMENT_SPACE_NOTE}
        <Icon name="docs" size="20px" />
        <div class="">Note</div>
      {:else if resource.type === ResourceTypes.LINK}
        <Icon name="link" size="20px" />
        <div class="">Bookmark</div>
      {:else if resource.type.startsWith(ResourceTypes.POST)}
        <Icon name="link" size="20px" />
        <div class="">Post</div>
      {:else if resource.type.startsWith(ResourceTypes.ARTICLE)}
        <ArticleProperties resource={articleResource} />
      {:else if resource.type.startsWith(ResourceTypes.CHAT_MESSAGE)}
        <Icon name="docs" size="20px" />
        <div class="">Message</div>
      {:else}
        <FileIcon kind={getFileKind(resource.type)} width="20px" height="20px" />
        <div class="">{getFileType(resource.type) ?? 'File'}</div>
      {/if}
    </div>

    <!-- <div class="date">last changed <DateSinceNow date={resource.updatedAt} /></div> -->
  </div>

  <!-- {#if resource.image_url}
      <img src={resource.image_url} alt="preview" class="w-full rounded-lg overflow-hidden max-h-48 object-cover" />
  {:else if resource.app_type === 'text' && resource.subtitle}
      <div class="text-background">
          {@html resource.subtitle.replace(resource.title, '')}
      </div>
  {/if}

  <div class="">
      <div class="text-lg line-clamp-1 font-medium">{resource.title}</div>
  

      <div class="flex items-center justify-between">
          <div class="flex items-center gap-2 opacity-75">
              <div class="w-5 h-5">
                  <Avatar name={resource.app_name} icon={resource.app_icon_url} background={resource.app_placeholder_icon_config?.css_background} size="xs" />
              </div>
              <div class="text-base truncate">{resource.app_name}</div>
          </div>

          {#if resource.app_type === 'link' && resource.url}
              <a href={resource.url} target="_blank" class="flex items-center gap-1 opacity-75">
                  <Icon name="LINK" />
                  <div class="text-base truncate">{formatURL(resource.url)}</div>
              </a>
          {:else if resource.app_type === 'text'}
              <div class="flex items-center gap-1 opacity-75">
                  <Icon name="DOCS" />
                  <div class="text-base truncate">Note</div>
              </div>
          {:else if resource.app_type === 'file' && resource.subtitle}
              <div class="flex items-center gap-1 opacity-75">
                  <Icon name="FILE" />
                  <div class="text-base truncate">{resource.subtitle}</div>
              </div>
          {/if}
      </div>
  </div> -->
</div>

<style lang="scss">
  .resource-preview {
    display: flex;
    gap: 8px;
    flex-direction: column;
    border-radius: 8px;
    overflow: hidden;
    cursor: pointer;
  }

  .preview {
    border-radius: 6px;
    border: 1px solid rgba(228, 228, 228, 0.75);
    box-shadow:
      0px 1px 0px 0px rgba(65, 58, 86, 0.25),
      0px 0px 1px 0px rgba(0, 0, 0, 0.25);
    background: rgba(255, 255, 255, 0.75);
    &.twitter {
      border: 1px solid rgba(255, 255, 255, 0.2);
      background: radial-gradient(100% 100% at 50% 0%, #000 0%, #252525 100%) !important;
    }
    &.slack {
      border: 1px solid rgba(255, 255, 255, 0.2);
      background: radial-gradient(100% 100% at 50% 0%, #d5ffed 0%, #ecf9ff 100%);
    }
    &.reddit {
      border: 1px solid rgba(255, 255, 255, 0.2);
      background: radial-gradient(100% 100% at 50% 0%, #ff4500 0%, #ff7947 100%);
    }
  }

  .details {
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    align-items: center;
    padding: 0.25rem 0.5rem 0.75rem 0.5rem;
    gap: 0.5rem;
    color: var(--color-text-muted);
  }

  .type {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 1rem;
    font-weight: 500;
    color: #281b53;
  }

  .date {
    font-size: 0.9rem;
    color: var(--color-text-secondary);
  }
</style>
