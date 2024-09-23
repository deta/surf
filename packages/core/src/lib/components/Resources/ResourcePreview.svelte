<svelte:options immutable />

<script lang="ts" context="module">
  export type PreviewData = {
    type: string
    title?: string
    content?: string
    contentType?: ContentType
    annotations?: Annotation[]
    image?: string | Blob
    url: string
    source: Source
    author?: Author
    theme?: [string, string]
  }
</script>

<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte'
  import { Icon } from '@horizon/icons'
  import { WebParser } from '@horizon/web-parser'

  import {
    ResourceJSON,
    ResourceNote,
    useResourceManager,
    type Resource
  } from '../../service/resources'
  import {
    ResourceTagsBuiltInKeys,
    ResourceTypes,
    type CreateTabOptions,
    type ResourceData,
    type ResourceDataPost
  } from '../../types'

  import { writable, get } from 'svelte/store'
  import {
    CreateTabEventTrigger,
    type AnnotationCommentData,
    type AnnotationRangeData,
    type ResourceDataAnnotation,
    type ResourceDataArticle,
    type ResourceDataDocument,
    type ResourceDataLink
  } from '@horizon/types'
  import {
    useLogScope,
    isModKeyPressed,
    getFileType,
    parseStringIntoUrl,
    getHostname,
    isMac
  } from '@horizon/utils'
  import { useTabsManager } from '../../service/tabs'
  import { contextMenu } from '../Core/ContextMenu.svelte'
  import { useOasis } from '../../service/oasis'
  import Preview, {
    type Annotation,
    type Author,
    type ContentType,
    type Mode,
    type Source
  } from './Previews/Preview.svelte'
  import { useConfig } from '@horizon/core/src/lib/service/config'

  export let resource: Resource
  export let selected: boolean = false
  export let mode: Mode = 'full'
  export let isInSpace: boolean = false // NOTE: Use to hint context menu (true -> all, delete, false -> inside space only remove link)

  const log = useLogScope('ResourcePreview')
  const resourceManager = useResourceManager()
  const tabsManager = useTabsManager()
  const oasis = useOasis()
  const config = useConfig()
  const userConfigSettings = config.settings

  const dispatch = createEventDispatcher<{
    click: string
    remove: string
    load: string
    open: string
    'created-tab': void
  }>()

  const isHovered = writable(false)
  const spaces = oasis.spaces

  $: annotations = resource.annotations ?? []

  $: isSilent = resource.tags?.find((x) => x.name === ResourceTagsBuiltInKeys.SILENT)
  $: canonicalUrl =
    resource.tags?.find((x) => x.name === ResourceTagsBuiltInKeys.CANONICAL_URL)?.value ||
    resource.metadata?.sourceURI

  $: isLiveSpaceResource = !!resource.tags?.find(
    (x) => x.name === ResourceTagsBuiltInKeys.SPACE_SOURCE
  )

  $: showOpenAsFile = !(Object.values(ResourceTypes) as string[]).includes(resource.type)

  let resourceData: ResourceData | null = null
  let previewData: PreviewData | null = null
  let dragging = false

  const cleanSource = (text: string) => {
    if (text.trim() === 'Wikimedia Foundation, Inc.') {
      return 'Wikipedia'
    } else {
      return text.trim()
    }
  }

  const loadResource = async () => {
    try {
      if (resource instanceof ResourceJSON) {
        resourceData = await resource.getParsedData()

        const summary =
          isLiveSpaceResource && resource.metadata?.userContext
            ? resource.metadata?.userContext
            : undefined

        // Workaround since for Figma it parses accessibility data instead of the actual content
        const HIDE_CONTENT_FOR_SITES = ['figma.com', 'www.figma.com']

        if (resource.type === ResourceTypes.LINK) {
          const data = resourceData as unknown as ResourceDataLink
          const hostname = getHostname(canonicalUrl ?? data.url)

          const hideContent = HIDE_CONTENT_FOR_SITES.some((site) => hostname === site)

          let annotationItems: Annotation[] = []
          if (!$userConfigSettings.show_annotations_in_oasis && annotations.length > 0) {
            const annotationData = await annotations[0].getParsedData()
            const comment = (annotationData.data as AnnotationCommentData).content_plain
            const highlight = (annotationData.anchor?.data as AnnotationRangeData).content_plain
            if (comment) {
              annotationItems.push({ type: 'comment', content: comment })
            } else if (highlight) {
              annotationItems.push({ type: 'highlight', content: highlight })
            }

            annotations
              .slice(1)
              .forEach(() => annotationItems.push({ type: 'highlight', content: '' }))
          }

          const resourceContent = data.description || data.content_plain
          const previewContent = summary || resourceContent || undefined

          previewData = {
            type: resource.type,
            title: data.title,
            content: hideContent ? undefined : previewContent,
            contentType: 'plain',
            annotations: annotationItems,
            image: data.image ?? undefined,
            url: data.url,
            source: {
              text: data.provider
                ? cleanSource(data.provider)
                : hostname || getFileType(resource.type),
              imageUrl: data.icon ?? `https://www.google.com/s2/favicons?domain=${hostname}&sz=48`,
              icon: 'link'
            },
            theme: undefined
          }
        } else if (resource.type === ResourceTypes.ARTICLE) {
          const data = resourceData as unknown as ResourceDataArticle
          const hostname = getHostname(canonicalUrl ?? data.url)

          const hideContent = HIDE_CONTENT_FOR_SITES.some((site) => hostname === site)

          let annotationItems: Annotation[] = []
          if (!$userConfigSettings.show_annotations_in_oasis && annotations.length > 0) {
            const annotationData = await annotations[0].getParsedData()
            const comment = (annotationData.data as AnnotationCommentData).content_plain
            const highlight = (annotationData.anchor?.data as AnnotationRangeData).content_plain
            if (comment) {
              annotationItems.push({ type: 'comment', content: comment })
            } else if (highlight) {
              annotationItems.push({ type: 'highlight', content: highlight })
            }

            annotations
              .slice(1)
              .forEach(() => annotationItems.push({ type: 'highlight', content: '' }))
          }

          const resourceContent = data.excerpt || data.content_plain
          const previewContent = summary || resourceContent || undefined

          previewData = {
            type: resource.type,
            title: data.title,
            content: hideContent ? undefined : previewContent,
            contentType: 'plain',
            annotations: annotationItems,
            image: data.images[0] ?? undefined,
            url: data.url,
            source: {
              text: data.site_name
                ? cleanSource(data.site_name)
                : hostname || getFileType(resource.type),
              imageUrl:
                data.site_icon ?? `https://www.google.com/s2/favicons?domain=${hostname}&sz=48`,
              icon: 'link'
            },
            // author: {
            //   text: data.author || data.site_name,
            //   imageUrl: data.author_image ?? undefined
            // },
            theme: undefined
          }
        }
        if (resource.type.startsWith(ResourceTypes.POST)) {
          const data = resourceData as unknown as ResourceDataPost
          const hostname = getHostname(canonicalUrl ?? data.url)

          // Workaround since YouTube videos sometimes have the wrong description.
          // TODO: fix the youtube parser and then remove this
          const hideContent = resource.type === ResourceTypes.POST_YOUTUBE

          let imageUrl: string | undefined
          let theme: [string, string] | undefined
          if (resource.type === ResourceTypes.POST_REDDIT) {
            theme = ['#ff4500', '#ff7947']
          } else if (resource.type === ResourceTypes.POST_TWITTER) {
            theme = ['#000', '#252525']
          } else if (resource.type === ResourceTypes.POST_YOUTUBE) {
            theme = undefined

            if (data.post_id) {
              imageUrl = `https://img.youtube.com/vi/${data.post_id}/mqdefault.jpg`
            } else {
              const url = parseStringIntoUrl(data.url)
              if (url) {
                const videoId = url.searchParams.get('v')
                if (videoId) {
                  imageUrl = `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`
                }
              }
            }

            if (!imageUrl) {
              imageUrl = data.images[0]
            }
          }

          const resourceContent = data.excerpt || data.content_plain
          const previewContent = summary || resourceContent || undefined

          previewData = {
            type: resource.type,
            title: data.title && data.title !== resourceContent ? data.title : undefined,
            content: hideContent ? undefined : previewContent,
            contentType: 'plain',
            image: imageUrl,
            url: data.url,
            source: {
              text:
                (resource.type === ResourceTypes.POST_REDDIT
                  ? data.parent_title
                  : data.site_name) ||
                hostname ||
                getFileType(resource.type),
              imageUrl: `https://www.google.com/s2/favicons?domain=${hostname}&sz=48`,
              icon: 'link'
            },
            author: {
              text: data.author || data.parent_title || undefined,
              imageUrl: data.author_image || undefined
            },
            theme: theme
          }
        } else if (resource.type.startsWith(ResourceTypes.DOCUMENT)) {
          const data = resourceData as unknown as ResourceDataDocument
          const hostname = getHostname(canonicalUrl ?? data.url)

          previewData = {
            type: resource.type,
            title: data.title || undefined,
            content:
              summary || (data.content_html && data.content_html !== '<p></p>')
                ? data.content_html
                : undefined,
            contentType: 'html',
            image: undefined,
            url: data.url,
            source: {
              text: data.editor_name,
              imageUrl: `https://www.google.com/s2/favicons?domain=${hostname}&sz=48`
            },
            author: {
              text: data.author || undefined,
              imageUrl: data.author_image ?? undefined
            },
            theme: undefined
          }
        } else if (resource.type === ResourceTypes.ANNOTATION) {
          const data = resourceData as unknown as ResourceDataAnnotation
          const hostname = getHostname(canonicalUrl ?? data.data.url ?? '')

          const commentContent = (data?.data as AnnotationCommentData).content_plain
          const highlightContent = (data.anchor?.data as AnnotationRangeData).content_plain

          const source =
            data?.type === 'comment' ? (data.data as AnnotationCommentData).source : null
          const sourceClean =
            source === 'inline_ai' ? `Inline AI` : source === 'chat_ai' ? `Page AI` : undefined

          previewData = {
            type: resource.type,
            title: undefined,
            annotations: highlightContent ? [{ type: 'highlight', content: highlightContent }] : [],
            content: commentContent,
            contentType: 'plain',
            image: undefined,
            url: canonicalUrl ?? data.data.url ?? '',
            source: {
              text: hostname ?? getFileType(resource.type),
              imageUrl: `https://www.google.com/s2/favicons?domain=${hostname}&sz=48`
            },
            author: {
              text: sourceClean || undefined,
              imageUrl: undefined
            },
            theme: undefined
          }
        }
      } else if (resource instanceof ResourceNote) {
        const data = await resource.getContent()
        const content = get(data)

        previewData = {
          type: resource.type,
          title: undefined,
          content: content && content !== '<p></p>' ? content : undefined,
          contentType: 'rich_text',
          image: undefined,
          url: canonicalUrl ?? '',
          source: {
            text: resource?.metadata?.name || 'Note',
            imageUrl: undefined,
            icon: 'docs'
          },
          theme: undefined
        }
      } else if (resource.type.startsWith('image/')) {
        const data = await resource.getData()
        const hostname = getHostname(canonicalUrl ?? '')

        previewData = {
          type: resource.type,
          title: resource?.metadata?.name,
          content: undefined,
          image: data,
          url: canonicalUrl ?? '',
          source: {
            text: hostname ?? canonicalUrl ?? getFileType(resource.type),
            imageUrl: hostname
              ? `https://www.google.com/s2/favicons?domain=${hostname}&sz=48`
              : undefined
          },
          theme: undefined
        }
      } else {
        const hostname = getHostname(canonicalUrl ?? '')

        let sourceText = getFileType(resource.type)
        if (hostname) {
          sourceText = hostname
        } else if (canonicalUrl) {
          const url = parseStringIntoUrl(canonicalUrl)
          if (url) {
            sourceText = url.hostname
          } else if (canonicalUrl.startsWith('file://')) {
            sourceText = 'Local file'
          } else if (canonicalUrl.startsWith('/Users/')) {
            sourceText = 'Local file'
          }
        }

        previewData = {
          type: resource.type,
          title: resource?.metadata?.name,
          content: undefined,
          image: undefined,
          url: canonicalUrl ?? '',
          source: {
            text: sourceText,
            imageUrl: hostname
              ? `https://www.google.com/s2/favicons?domain=${hostname}&sz=48`
              : undefined
          },
          theme: undefined
        }
      }
    } catch (e) {
      log.error('Failed to load resource', e)
      previewData = {
        type: resource.type,
        title: resource?.metadata?.name,
        content: undefined,
        image: undefined,
        url: canonicalUrl ?? '',
        source: {
          text: canonicalUrl ?? getFileType(resource.type),
          imageUrl: undefined
        },
        theme: undefined
      }
    } finally {
      dispatch('load', resource.id)
    }
  }

  const openResourceAsTab = (opts?: CreateTabOptions) => {
    tabsManager.openResourceAsTab(resource, opts)
    dispatch('created-tab')
  }

  const handleDragStart = (e: DragEvent) => {
    dragging = true
    if (resourceData) {
      if (resource.type.startsWith(ResourceTypes.POST)) {
        e.dataTransfer?.setData('text/uri-list', (resourceData as ResourceDataPost)?.url ?? '')
      }

      const content = WebParser.getResourceContent(resource.type, resourceData)
      if (content.plain) {
        e.dataTransfer?.setData('text/plain', content.plain)
      }

      if (content.html) {
        e.dataTransfer?.setData('text/html', content.html)
      }
    }
  }

  const handleClick = async (e: MouseEvent) => {
    if (dragging) {
      dragging = false
      return
    }

    if (resource.type === ResourceTypes.ANNOTATION) {
      const annotatesTag = resource.tags?.find((x) => x.name === ResourceTagsBuiltInKeys.ANNOTATES)
      if (annotatesTag) {
        dispatch('open', annotatesTag.value)
        return
      }

      return
    }

    if (e.shiftKey && !isModKeyPressed(e)) {
      log.debug('opening resource in mini browser', resource.id)
      dispatch('open', resource.id)
    } else {
      log.debug('opening resource in new tab', resource.id)
      openResourceAsTab({
        active: !isModKeyPressed(e) || e.shiftKey,
        trigger: CreateTabEventTrigger.OasisItem
      })
    }
  }

  const handleRemove = (e?: MouseEvent) => {
    e?.stopImmediatePropagation()
    dispatch('remove', resource.id)
  }

  const handleOpenAsNewTab = (e?: MouseEvent) => {
    e?.stopImmediatePropagation()

    openResourceAsTab({
      active: true,
      trigger: CreateTabEventTrigger.OasisItem
    })
  }

  const handleOpenAsFile = () => {
    if (resource.metadata?.name) {
      window.api.openResourceLocally({
        id: resource.id,
        metadata: resource.metadata,
        type: resource.type,
        path: resource.path,
        deleted: resource.deleted,
        createdAt: resource.createdAt,
        updatedAt: resource.updatedAt
      })
    } else {
      alert('Failed to open file')
    }
  }

  onMount(async () => {
    await loadResource()
  })
</script>

<!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
<div
  on:click={handleClick}
  class="resource-preview clickable"
  class:isSelected={selected}
  style="--id:{resource.id};"
  use:contextMenu={{
    items: [
      {
        type: 'action',
        icon: 'arrow.up.right',
        text: 'Open as Tab',
        action: () => handleOpenAsNewTab()
      },
      {
        type: 'action',
        icon: 'eye',
        text: 'Open in Mini Browser',
        action: () => dispatch('open', resource.id)
      },
      { type: 'separator' },
      ...(showOpenAsFile
        ? [
            {
              type: 'action',
              icon: '',
              text: `${isMac() ? 'Reveal in Finder' : 'Open in Explorer'}`,
              action: () => handleOpenAsFile()
            }
          ]
        : []),
      {
        type: 'sub-menu',
        icon: '',
        text: `Add to Space`,
        items: $spaces
          ? [
              ...$spaces
                .filter((e) => e.name.folderName !== 'Everything')
                .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
                .map((space) => ({
                  type: 'action',
                  icon: '',
                  text: space.name.folderName,
                  action: () => {
                    oasis.addResourcesToSpace(space.id, [resource.id])
                  }
                }))
            ]
          : []
      },
      { type: 'separator' },
      {
        type: 'action',
        icon: 'trash',
        text: `${!isInSpace ? 'Delete from Stuff' : 'Remove from Space'}`,
        kind: 'danger',
        action: () => handleRemove()
      }
    ]
  }}
>
  {#if previewData}
    <Preview
      {resource}
      type={previewData.type}
      title={previewData.title}
      content={previewData.content}
      contentType={previewData.contentType}
      annotations={previewData.annotations}
      image={previewData.image}
      url={previewData.url}
      source={previewData.source}
      author={previewData.author}
      theme={previewData.theme}
      {mode}
    />
  {:else}
    <div class="preview background">
      <div class="details">
        <div class="title">Loading...</div>
        <div class="subtitle">Please wait</div>
      </div>
    </div>
  {/if}

  <!-- {#if interactive}
    <div class="remove-wrapper">
      {#if showOpenAsFile}
        <div class="remove" on:click|stopPropagation={handleOpenAsFile}>
          <Icon name="file" color="#AAA7B1" />
        </div>
      {/if}

      <div class="remove rotated" on:click|stopPropagation={handleOpenAsNewTab}>
        <Icon name="arrow.right" color="#AAA7B1" />
      </div>

      <div class="remove" on:click|stopPropagation={handleRemove}>
        <Icon name="close" color="#AAA7B1" />
      </div>
    </div>
  {/if} -->
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
    /* animation: 280ms fade-in-up cubic-bezier(0.25, 0.46, 0.45, 0.94); */
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

    &.clickable {
      cursor: pointer;
    }

    &.isSelected {
      .preview {
        outline: 4px solid rgba(0, 123, 255, 0.75);
      }
    }

    &.background {
      background: rgb(255, 255, 255);
      border: 1px solid rgba(228, 228, 228, 0.75);
      box-shadow:
        0px 1px 0px 0px rgba(65, 58, 86, 0.25),
        0px 0px 1px 0px rgba(0, 0, 0, 0.25);

      .preview:not(.slack):not(.reddit):not(.twitter):not(.notion) {
        background: rgba(255, 255, 255, 0.75);
        border: none;
        box-shadow: none;
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
    position: relative;
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
    display: flex;
    gap: 0.75rem;
    top: 0;
    padding: 1rem;
    right: -2rem;
    transform: translateY(-45%);
    opacity: 0;
    margin-left: 0.5rem;
    cursor: default;
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
      &.rotated {
        transform: rotate(-45deg);
      }
      &:hover {
        outline: 3px solid rgba(0, 0, 0, 0.15);
      }
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

  .annotations {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.9rem;
    color: rgb(12 74 110/0.9);
  }

  .resource-source {
    position: absolute;
    bottom: 1rem;
    right: 1rem;
    display: flex;
    align-items: center;
    background: rgba(255, 255, 255, 0.85);
    backdrop-filter: blur(4px);
    box-shadow: 0px 0.425px 0px 0px rgba(65, 58, 86, 0.25);
    padding: 0.4rem;
    border-radius: 0.5rem;
    font-size: 0.85rem;
    font-weight: 600;
    color: rgb(12 74 110/0.9);

    &.hover {
      background: rgba(255, 255, 255);
      color: rgb(12 74 110);
    }
  }

  .favicon {
    width: 1rem;
    height: 1rem;
    border-radius: 5.1px;
    box-shadow:
      0px 0.425px 0px 0px rgba(65, 58, 86, 0.25),
      0px 0px 0.85px 0px rgba(0, 0, 0, 0.25);
  }

  .summary-wrapper {
    padding: 0.5rem 1rem;
  }

  .summary {
    font-size: 1rem;
    color: rgb(12 74 110/0.9);
    letter-spacing: 0.0175rem;
    font-weight: 500;
    text-wrap: pretty;
    display: -webkit-box;
    overflow: hidden;
    line-height: 1.5;
    word-break: break-word;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    -webkit-line-clamp: 15;
    -webkit-box-orient: vertical;
  }
</style>
