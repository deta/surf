<script lang="ts">
  import { createEventDispatcher } from 'svelte'
  import { Icon } from '@horizon/icons'
  import { WebParser } from '@horizon/web-parser'

  import TextPreview from '../Cards/Text/TextPreview.svelte'
  import LinkPreview from '../Cards/Link/LinkPreview.svelte'
  import type {
    Resource,
    ResourceAnnotation,
    ResourceArticle,
    ResourceChatMessage,
    ResourceChatThread,
    ResourceDocument,
    ResourceLink,
    ResourceNote,
    ResourcePost
  } from '../../service/resources'
  import FilePreview from '../Cards/File/FilePreview.svelte'
  import { ResourceTypes, type ResourceData, type ResourceDataPost } from '../../types'
  import { getFileKind, getFileType } from '../../utils/files'
  import FileIcon from '../Cards/File/FileIcon.svelte'
  import PostPreview from '../Cards/Post/PostPreview.svelte'
  import ChatMessagePreview from '../Cards/ChatMessage/ChatMessagePreview.svelte'
  import ArticlePreview from '../Cards/Article/ArticlePreview.svelte'
  import DocumentPreview from '../Cards/Document/DocumentPreview.svelte'
  import ArticleProperties from '@horizon/drawer/src/lib/components/properties/ArticleProperties.svelte'
  import ChatThreadPreview from '../Cards/ChatThread/ChatThreadPreview.svelte'
  import YoutubePreview from '../Cards/Post/YoutubePreview.svelte'
  import { useDrawer } from '@horizon/drawer'
  import AnnotationPreview from '../Cards/Annotation/AnnotationPreview.svelte'

  export let resource: Resource
  export let isSelected: boolean

  const { viewState } = useDrawer()

  const dispatch = createEventDispatcher<{ click: string; remove: string; load: string }>()

  const handleClick = () => {
    dispatch('click', resource.id)
  }

  const handleRemove = (e: MouseEvent) => {
    e.stopImmediatePropagation()
    dispatch('remove', resource.id)
  }

  // TODO: figure out better way to do this
  $: textResource = resource as ResourceNote
  $: linkResource = resource as ResourceLink
  $: postResource = resource as ResourcePost
  $: articleResource = resource as ResourceArticle
  $: chatMessageResource = resource as ResourceChatMessage
  $: chatThreadResource = resource as ResourceChatThread
  $: documentResource = resource as ResourceDocument
  $: annotationResource = resource as ResourceAnnotation

  let data: ResourceData | null = null
  const handleData = (e: CustomEvent<ResourceData>) => {
    data = e.detail
  }

  const handleDragStart = (e: DragEvent) => {
    e.dataTransfer?.setData('application/json', JSON.stringify({ id: resource.id }))

    const dragElement = e.target as HTMLElement
    const clone = dragElement.cloneNode(true) as HTMLElement

    // Apply initial styles
    clone.style.position = 'absolute'
    clone.style.top = '-200px'
    clone.style.left = '-200px'
    clone.style.width = '200px'
    clone.style.height = 'fit-content'
    clone.style.maxWidth = '200px'
    clone.style.maxHeight = '300px'
    clone.style.opacity = '0.7'
    clone.style.pointerEvents = 'none'
    clone.style.transform = 'scale(0.8)'
    clone.style.transition = 'transform 0.2s ease-out'

    document.body.appendChild(clone)
    e.dataTransfer?.setDragImage(clone, clone.clientWidth / 2, clone.clientHeight / 2)

    // Trigger reflow
    clone.offsetHeight // Reading this property will trigger a reflow

    // Apply the final transformation
    clone.style.transform = 'scale(1)'

    const handleDragEnd = () => {
      clone.remove()
      dragElement.removeEventListener('dragend', handleDragEnd)
    }

    clone.addEventListener('transitionend', handleDragEnd)
  }

  const handleLoad = () => {
    dispatch('load', resource.id)
  }
</script>

<!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
<div
  on:click={handleClick}
  class="resource-preview"
  class:details={$viewState === 'details'}
  class:isSelected
  style="--id:{resource.id};"
  on:dragstart={handleDragStart}
  draggable="true"
>
  <div
    class="preview"
    class:reddit={resource.type === 'application/vnd.space.post.reddit'}
    class:twitter={resource.type === 'application/vnd.space.post.twitter'}
    class:slack={resource.type === 'application/vnd.space.chat-message.slack'}
    class:notion={resource.type === 'application/vnd.space.document.notion'}
  >
    {#if resource.type === ResourceTypes.DOCUMENT_SPACE_NOTE}
      <TextPreview resource={textResource} on:data={handleData} on:load={handleLoad} />
    {:else if resource.type === ResourceTypes.LINK}
      <LinkPreview resource={linkResource} on:data={handleData} on:load={handleLoad} />
    {:else if resource.type.startsWith(ResourceTypes.POST_YOUTUBE)}
      <YoutubePreview
        resource={postResource}
        type={resource.type}
        on:data={handleData}
        on:load={handleLoad}
      />
    {:else if resource.type.startsWith(ResourceTypes.POST)}
      <PostPreview
        resource={postResource}
        type={resource.type}
        on:data={handleData}
        on:load={handleLoad}
      />
    {:else if resource.type.startsWith(ResourceTypes.ARTICLE)}
      <ArticlePreview resource={articleResource} on:data={handleData} on:load={handleLoad} />
    {:else if resource.type.startsWith(ResourceTypes.CHAT_MESSAGE)}
      <ChatMessagePreview
        resource={chatMessageResource}
        type={resource.type}
        on:data={handleData}
        on:load={handleLoad}
      />
    {:else if resource.type.startsWith(ResourceTypes.CHAT_THREAD)}
      <ChatThreadPreview
        resource={chatThreadResource}
        type={resource.type}
        on:data={handleData}
        on:load={handleLoad}
      />
    {:else if resource.type.startsWith(ResourceTypes.DOCUMENT)}
      <DocumentPreview
        resource={documentResource}
        type={resource.type}
        on:data={handleData}
        on:load={handleLoad}
      />
    {:else if resource.type.startsWith(ResourceTypes.ANNOTATION)}
      <AnnotationPreview
        resource={annotationResource}
        type={resource.type}
        on:data={handleData}
        on:load={handleLoad}
      />
    {:else}
      <FilePreview {resource} on:load={handleLoad} />
    {/if}
  </div>

  <div class="details">
    <div class="type">
      {#if resource.type === ResourceTypes.DOCUMENT_SPACE_NOTE}
        <!-- <Icon name="docs" size="20px" />
        <div class="label">Note</div> -->
      {:else if resource.type === ResourceTypes.LINK}
        <div class="label">{resource.metadata.name ?? 'Link'}</div>
      {:else if resource.type.startsWith(ResourceTypes.POST_YOUTUBE)}
        <!-- <Icon name="link" size="20px" />
        <div class="label">Post</div> -->
        <ArticleProperties resource={articleResource} />
      {:else if resource.type.startsWith(ResourceTypes.ARTICLE)}
        <ArticleProperties resource={articleResource} />
      {:else if resource.type.startsWith(ResourceTypes.CHAT_MESSAGE)}
        <!-- <Icon name="docs" size="20px" />
        <div class="label">Message</div> -->
      {:else if resource.type.startsWith(ResourceTypes.CHAT_THREAD)}
        <!-- <Icon name="link" size="20px" />
        <div class="label">Thread</div> -->
      {:else if resource.type.startsWith(ResourceTypes.DOCUMENT)}
        <Icon name="docs" size="20px" />
        <div class="">Document</div>
      {:else if resource.type.startsWith(ResourceTypes.ANNOTATION)}
        <Icon name="marker" size="20px" />
        <div class="">Annotation</div>
      {:else}
        <!-- <FileIcon kind={getFileKind(resource.type)} width="20px" height="20px" />
        <div class="label">{getFileType(resource.type) ?? 'File'}</div> -->
      {/if}
    </div>
  </div>
  {#if $viewState !== 'details'}
    <div class="remove-wrapper" on:click={handleRemove}>
      <div class="remove">
        <Icon name="close" color="#AAA7B1" />
      </div>
    </div>
  {/if}
</div>

<style lang="scss">
  @keyframes fade-in-up {
    0% {
      opacity: 0;
      transform: translateY(30px);
    }
    100% {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .resource-preview {
    position: relative;
    display: flex;
    gap: 8px;
    flex-direction: column;
    border-radius: 16px;
    overflow: visible;
    cursor: default;
    animation: 280ms fade-in-up cubic-bezier(0.25, 0.46, 0.45, 0.94);
    animation-delay: 20ms;
    animation-fill-mode: forwards;
    animation-iteration-count: 1;
    &:hover {
      .remove-wrapper {
        animation: fade-in 120ms forwards;
        animation-iteration-count: 1;
        animation-delay: 60ms;
      }
    }

    &.isSelected {
      .preview {
        outline: 4px solid rgba(0, 123, 255, 0.75);
      }
    }

    &.details {
      .preview:hover {
        outline: 0;
      }
    }

    & * {
      user-select: none;
      -webkit-user-drag: none;
    }
  }

  .preview {
    width: 100%;
    border-radius: 16px;
    border: 1px solid rgba(228, 228, 228, 0.75);
    box-shadow:
      0px 1px 0px 0px rgba(65, 58, 86, 0.25),
      0px 0px 1px 0px rgba(0, 0, 0, 0.25);
    background: rgba(255, 255, 255, 0.75);
    transition: 60ms ease-out;
    &:hover {
      outline: 3px solid rgba(0, 0, 0, 0.15);
    }
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
    &.notion {
      border: 1px solid rgba(255, 255, 255, 0.2);
      background: radial-gradient(100% 100% at 50% 0%, #fff 0%, #fafafa 100%);
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
    width: 100%;
  }

  .remove-wrapper {
    position: absolute;
    top: 0;
    padding: 1rem;
    right: 0;
    transform: translateX(45%) translateY(-45%);
    opacity: 0;
    margin-left: 0.5rem;
    cursor: default;
    &:hover {
      .remove {
        outline: 3px solid rgba(0, 0, 0, 0.15);
      }
    }
    .remove {
      display: flex;
      justify-content: center;
      align-items: center;
      width: 2rem;
      height: 2rem;
      flex-shrink: 0;
      border-radius: 50%;
      border: 0.5px solid rgba(0, 0, 0, 0.15);
      transition: 60ms ease-out;
      background: white;
    }
  }

  @keyframes fade-in {
    0% {
      opacity: 0;
    }
    100% {
      opacity: 1;
    }
  }

  .type {
    display: flex;
    align-items: start;
    gap: 0.5rem;
    font-size: 1rem;
    font-weight: 500;
    color: #281b53;
  }

  .label {
    font-size: 1.1rem;
    line-height: 1.4;
    padding: 0 0.25rem 0 0.25rem;
    margin-bottom: 1.5rem;
    text-wrap: balance;
  }

  .dragging {
    position: absolute;
    width: 200px;
    height: 200px;
    max-width: 200px;
    max-height: 200px;
    opacity: 0.7;
    pointer-events: none;
    animation: initial-drag 0.2s ease-out;
  }

  @keyframes initial-drag {
    from {
      transform: scale(0.8);
    }
    to {
      transform: scale(1);
    }
  }
</style>
