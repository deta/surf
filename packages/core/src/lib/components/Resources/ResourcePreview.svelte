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

    metadata?: {
      text?: string
      icon?: string
      imageUrl?: string
    }[]
  }
</script>

<script lang="ts">
  import { createEventDispatcher, onDestroy, onMount } from 'svelte'
  import { Icon } from '@horizon/icons'

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
    type ResourceDataPost,
    SpaceEntryOrigin,
    type DragTypes,
    DragTypeNames
  } from '../../types'

  import { writable, get, derived } from 'svelte/store'
  import {
    CreateTabEventTrigger,
    OpenResourceEventFrom,
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
    hover,
    isMac,
    copyToClipboard,
    truncateURL,
    conditionalArrayItem
  } from '@horizon/utils'
  import { PAGE_TABS_RESOURCE_TYPES, useTabsManager } from '../../service/tabs'
  import { contextMenu, type CtxItem } from '../Core/ContextMenu.svelte'
  import { useOasis } from '../../service/oasis'
  import {
    type Annotation,
    type Author,
    type ContentType,
    type Mode,
    type Origin,
    type Source
  } from './Previews/Preview.svelte'
  import Preview, { type ContentMode, type ViewMode } from './Previews/PreviewV2.svelte'
  import { slide } from 'svelte/transition'
  import { useConfig } from '@horizon/core/src/lib/service/config'
  import { useToasts } from '@horizon/core/src/lib/service/toast'
  import {
    selectedItemIds,
    addSelectionById
  } from '@horizon/core/src/lib/components/Oasis/utils/select'
  import { DragculaDragEvent, HTMLDragItem } from '@horizon/dragcula'
  import { WebParser } from '@horizon/web-parser'

  export let resource: Resource
  export let selected: boolean = false
  export let interactive: boolean = false
  export let draggable = interactive
  export let frameless: boolean = false
  export let titleEditable = interactive

  /// View
  export let mode: ContentMode = 'full'
  export let viewMode: ViewMode = 'card'

  export let origin: Origin = 'stuff'
  export let isInSpace: boolean = false // NOTE: Use to hint context menu (true -> all, delete, false -> inside space only remove link)
  export let resourcesBlacklistable: boolean = false
  export let resourceBlacklisted: boolean = false

  export let processingText: string | undefined = undefined
  export let failedText: string | undefined = undefined
  export let hideProcessing: boolean = false

  const log = useLogScope('ResourcePreview')
  const resourceManager = useResourceManager()
  const tabsManager = useTabsManager()
  const oasis = useOasis()
  const toasts = useToasts()
  const config = useConfig()
  const userConfigSettings = config.settings

  const dispatch = createEventDispatcher<{
    click: string
    remove: { ids: string; deleteFromStuff: boolean }
    load: string
    open: string
    'open-and-chat': string
    'created-tab': void
    'whitelist-resource': string
    'blacklist-resource': string
    'set-resource-as-background': string
    'remove-from-homescreen': void
    'set-resource-as-space-icon': string
  }>()

  const spaces = oasis.spaces
  const resourceState = resource.state

  let interactiveProp = interactive

  const isHovered = writable(false)
  const customTitleValue = writable(resource.metadata?.name ?? '')

  const contextMenuSpaces = derived(spaces, (spaces) => {
    return spaces
      .filter(
        (e) =>
          e.id !== 'all' &&
          e.id !== 'inbox' &&
          e.dataValue?.folderName?.toLowerCase() !== '.tempspace' &&
          !e.dataValue.builtIn
      )
      .map(
        (space) =>
          ({
            type: 'action',
            icon: space,
            text: space.dataValue.folderName,
            action: async () => {
              try {
                await oasis.addResourcesToSpace(
                  space.id,
                  [resource.id],
                  SpaceEntryOrigin.ManuallyAdded
                )

                toasts.success(`Added to ${space.dataValue.folderName}`)
              } catch (e) {
                toasts.error(`Failed to add to ${space.dataValue.folderName}`)
              }
            }
          }) as CtxItem
      )
  })

  $: annotations = resource.annotations ?? []

  $: isSilent = resource.tags?.find((x) => x.name === ResourceTagsBuiltInKeys.SILENT)
  $: canonicalUrl = parseStringIntoUrl(
    resource.tags?.find((x) => x.name === ResourceTagsBuiltInKeys.CANONICAL_URL)?.value ||
      resource.metadata?.sourceURI ||
      ''
  )?.href

  $: isLiveSpaceResource = !!resource.tags?.find(
    (x) => x.name === ResourceTagsBuiltInKeys.SPACE_SOURCE
  )

  $: showOpenAsFile =
    resource.type === ResourceTypes.PDF ||
    !(Object.values(ResourceTypes) as string[]).includes(resource.type)

  $: processingSource =
    (canonicalUrl
      ? truncateURL(canonicalUrl, 25) || getFileType(resource.type)
      : getFileType(resource.type)) || resource.type

  $: if ($resourceState === 'extracting') {
    handleUpdating()
  }

  $: if (interactiveProp) {
    if ($selectedItemIds.length > 0) {
      interactive = false
    } else {
      interactive = interactiveProp
    }
  }

  $: canBeRefreshed =
    (Object.values(ResourceTypes) as string[]).includes(resource.type) && canonicalUrl !== undefined

  $: sourceURL = parseStringIntoUrl(resource.metadata?.sourceURI ?? '')

  /*
    Show source URL if it's different from the canonical URL or if the resource is not a web page (e.g. image).
    For live space resources, only show the source URL if it's from Hacker News as it doesn't make sense to link to RSS feeds.
  */
  $: showSourceURL =
    sourceURL &&
    (sourceURL.href !== canonicalUrl ||
      !PAGE_TABS_RESOURCE_TYPES.some((x) => resource.type.startsWith(x))) &&
    (isLiveSpaceResource ? sourceURL.hostname === 'news.ycombinator.com' : true)

  let resourceData: ResourceData | null = null
  let previewData: PreviewData | null = null
  let dragging = false
  let showEditMode = false

  const handleUpdating = () => {
    log.debug('Resource is updating', resource.id)

    const unsubscribe = resourceState.subscribe((state) => {
      if (state === 'idle') {
        log.debug('Resource is done updating, refreshing preview', resource.id)
        loadResource()
        unsubscribe()
      } else if (state === 'error') {
        log.error('Resource failed to update', resource.id)
        unsubscribe()
      }
    })
  }

  const cleanSource = (text: string) => {
    if (text.trim() === 'Wikimedia Foundation, Inc.') {
      return 'Wikipedia'
    } else {
      return text.trim()
    }
  }

  const cleanContent = (text: string, hostname: string | null) => {
    if (!text) {
      return null
    }

    if (hostname === 'github.com') {
      const regex = /Contribute to ([\w-]+\/[\w-]+) development by creating an account on GitHub\./
      const match = text.match(regex)
      if (match) {
        return null
      }

      return text
    }

    return text
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

          const resourceContent = cleanContent(data.description || '', hostname)
          const previewContent = summary || resourceContent || undefined

          previewData = {
            type: resource.type,
            title: resource?.metadata?.name || data.title,
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

          const resourceContent = cleanContent(data.excerpt || data.content_plain, hostname)
          const previewContent = summary || resourceContent || undefined

          previewData = {
            type: resource.type,
            title: resource?.metadata?.name || data.title,
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
        } else if (resource.type.startsWith(ResourceTypes.POST)) {
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
            title:
              (resource?.metadata?.name && resource?.metadata?.name !== resourceContent) ||
              (data.title && data.title !== resourceContent)
                ? resource?.metadata?.name || data.title || undefined
                : undefined,
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
            title: resource?.metadata?.name || data.title || undefined,
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
            title: resource?.metadata?.name,
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
        } else {
          const data = resourceData as any
          const hostname = getHostname(canonicalUrl ?? data.url)

          previewData = {
            type: resource.type,
            title: resource?.metadata?.name || data.title || getFileType(resource.type),
            content: data.content_plain,
            contentType: 'plain',
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
        const hostname = getHostname(canonicalUrl ?? '')

        previewData = {
          type: resource.type,
          title: undefined,
          content: undefined,
          image: `surf://resource/${resource.id}`,
          url: canonicalUrl ?? parseStringIntoUrl(resource.metadata?.sourceURI ?? '')?.href ?? '',
          source: {
            text:
              resource?.metadata?.name || hostname || canonicalUrl || getFileType(resource.type),
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
            sourceText = `Local ${getFileType(resource.type)}`
          } else if (canonicalUrl.startsWith('/Users/')) {
            sourceText = `Local ${getFileType(resource.type)}`
          }
        }

        previewData = {
          type: resource.type,
          title: resource?.metadata?.name,
          content: undefined,
          image: undefined,
          url: canonicalUrl ?? parseStringIntoUrl(resource.metadata?.sourceURI ?? '')?.href ?? '',
          source: {
            text: sourceText,
            imageUrl: hostname
              ? `https://www.google.com/s2/favicons?domain=${hostname}&sz=48`
              : undefined
          },
          theme: undefined
        }
      }

      if ($resourceState === 'extracting' && !hideProcessing) {
        previewData.metadata = [
          ...conditionalArrayItem(true, {
            text: previewData?.author?.text,
            icon: !canonicalUrl ? 'file' : undefined,
            imageUrl: canonicalUrl
              ? `https://www.google.com/s2/favicons?domain=${getHostname(canonicalUrl)}&sz=48`
              : undefined
          })
        ]
      } else {
        previewData.metadata = [
          ...conditionalArrayItem(
            previewData.source !== undefined &&
              resource.type !== 'application/vnd.space.post.youtube',
            {
              text: previewData.source?.text,
              icon: previewData.source?.icon,
              imageUrl: previewData.source?.imageUrl
            }
          ),
          ...conditionalArrayItem(previewData.author?.text !== undefined, {
            text: previewData.author?.text,
            icon: previewData.author?.icon,
            imageUrl: previewData.author?.imageUrl
          })
        ]
      }

      // Adjust preview data based on content view mode
      if (mode === 'media') {
        if (previewData.image !== undefined) {
          //previewData.title = undefined
          previewData.content = undefined
          previewData.metadata = undefined
        }
      } else if (mode === 'compact') {
        if (previewData.image !== undefined) {
          previewData.content = undefined
          previewData.metadata[0].text = previewData.title
          previewData.title = ''
        } else if (
          (previewData.title !== undefined && previewData.title.length > 0) ||
          previewData.content !== undefined
        ) {
          previewData.image = undefined
        }
      } else if (viewMode === 'inline') {
        if (previewData.title !== undefined) {
          previewData.content = undefined
        }
      }

      // Hide content if not showing annotations in stuff and we have annotations -> Content is hidden
      if (
        !$userConfigSettings.show_annotations_in_oasis &&
        (previewData.annotations?.length ?? 0) > 0
      ) {
        previewData.content = undefined
      }

      // Hide metadata for all images by default
      if (resource.type.startsWith('image/') || mode === 'media') {
        previewData.metadata = []
      }
    } catch (e) {
      log.error('Failed to load resource', e)
      previewData = {
        type: resource.type,
        title: resource?.metadata?.name,
        content: undefined,
        image: undefined,
        url: canonicalUrl ?? parseStringIntoUrl(resource.metadata?.sourceURI ?? '')?.href ?? '',
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

  const openResourceAsTab = (resourceId: string, opts?: CreateTabOptions) => {
    tabsManager.openResourceAsTab(resourceId, opts)
    dispatch('created-tab')
  }

  const handleClick = async (e: MouseEvent) => {
    // TOOD: @felix replace this with interactive prop
    if (resourcesBlacklistable) {
      handleBlacklisting()
      return
    }

    if (dragging) {
      dragging = false
      return
    }

    if ($selectedItemIds.length > 0) {
      return
    }

    if (showEditMode) {
      return
    }

    let resourceToOpen = resource.id

    if (resource.type === ResourceTypes.ANNOTATION) {
      const annotatesTag = resource.tags?.find((x) => x.name === ResourceTagsBuiltInKeys.ANNOTATES)
      if (annotatesTag) {
        resourceToOpen = annotatesTag.value
      }
    }

    if (!interactive) {
      return
    }

    if (e.shiftKey && !isModKeyPressed(e)) {
      log.debug('opening resource in mini browser', resourceToOpen)
      dispatch('open', resourceToOpen)
    } else {
      log.debug('opening resource in new tab', resourceToOpen)
      openResourceAsTab(resourceToOpen, {
        active: !isModKeyPressed(e) || e.shiftKey,
        trigger:
          origin === 'homescreen'
            ? CreateTabEventTrigger.Homescreen
            : origin === 'homescreen-space'
              ? CreateTabEventTrigger.HomescreenSpace
              : CreateTabEventTrigger.OasisItem
      })
    }

    resourceManager.telemetry.trackOpenResource(
      resource.type,
      origin === 'homescreen'
        ? OpenResourceEventFrom.Homescreen
        : origin === 'stack'
          ? OpenResourceEventFrom.Stack
          : isInSpace
            ? OpenResourceEventFrom.Space
            : OpenResourceEventFrom.Oasis
    )
  }

  const handleTitleClick = (e: CustomEvent<MouseEvent>) => {
    handleClick(e.detail)
  }

  const handleRemove = async (e?: MouseEvent, deleteFromStuff = false) => {
    e?.stopImmediatePropagation()
    dispatch('remove', { ids: resource.id, deleteFromStuff })
  }

  const handleBlacklisting = () => {
    resourceBlacklisted = !resourceBlacklisted

    if (resourceBlacklisted) {
      // Handle removing from blacklist
      dispatch('blacklist-resource', resource.id)
    } else {
      // Handle adding to blacklist
      dispatch('whitelist-resource', resource.id)
    }
  }

  const openSourceURL = () => {
    if (!sourceURL) return
    tabsManager.addPageTab(sourceURL.href, {
      active: true
    })
  }

  const handleOpenAsNewTab = (e?: MouseEvent) => {
    e?.stopImmediatePropagation()

    openResourceAsTab(resource.id, {
      active: false,
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

  const handleUseAsSpaceIcon = () => {
    dispatch('set-resource-as-space-icon', resource.id)
  }

  const handleToggleBlacklisted = () => {
    resourceBlacklisted = !resourceBlacklisted
  }

  const handleCopyToClipboard = () => {
    if (canonicalUrl) {
      copyToClipboard(canonicalUrl)
      toasts.success('Copied URL to clipboard!')
    }
  }

  const handleEditTitle = async (e: CustomEvent<string>) => {
    const title = e.detail

    showEditMode = false

    // If the resource doesn't store a title separately we don't want to allow setting the name to empty values
    if (
      !title &&
      (resource.type === ResourceTypes.DOCUMENT_SPACE_NOTE ||
        !Object.values<string>(ResourceTypes).includes(resource.type))
    ) {
      return
    }

    // update `surf://resource` tabs to have the new title if they
    // don't have a custom name given to them by the PDF renderer
    tabsManager.updateSurfResourceTabs(resource.id, { title })

    // update the local resource first for instant feedback
    resource.updateMetadata({ name: title })

    // TODO: only update the relevant fields
    loadResource()

    // after the resource is updated, update the metadata in the database
    await resourceManager.updateResourceMetadata(resource.id, { name: title })
  }

  const handleStartEditTitle = async () => {
    if (!titleEditable) return
    log.debug('Starting to edit title', resource.id, interactive)
    if (interactive) {
      showEditMode = true
    }
  }

  const refreshResourceData = async () => {
    const resourceType = getFileType(resource.type)
    const toast = toasts.loading(`Refreshing ${resourceType}`)

    try {
      await resourceManager.refreshResourceData(resource)
      toast.success(`Refreshed ${resourceType}!`)
    } catch (e) {
      log.error('Failed to refresh resource', e)
      toast.error(`Failed to refresh ${resourceType}`)
    }
  }

  const handleDragStart = (drag: DragculaDragEvent<DragTypes>) => {
    drag.item!.data.setData(DragTypeNames.SURF_RESOURCE, resource)
    drag.dataTransfer?.setData('application/vnd.space.dragcula.resourceId', resource.id)
    drag.item!.data.setData(DragTypeNames.SURF_RESOURCE_ID, resource.id)

    drag.continue()
  }
  $: contextMenuItems = [
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
    ...conditionalArrayItem<CtxItem>($selectedItemIds.length === 0 && origin !== 'homescreen', {
      type: 'action',
      icon: 'circle.check',
      text: 'Select',
      action: () => {
        addSelectionById(resource.id)
      }
    }),
    ...conditionalArrayItem<CtxItem>(!!canonicalUrl, {
      type: 'action',
      icon: 'copy',
      text: 'Copy URL',
      action: () => handleCopyToClipboard()
    }),
    ...conditionalArrayItem<CtxItem>(!!showSourceURL, [
      { type: 'separator' },
      {
        type: 'action',
        icon: 'link',
        text: 'Open Source',
        action: () => openSourceURL()
      }
    ]),
    {
      type: 'action',
      icon: 'chat',
      text: 'Open in Chat',
      action: () => dispatch('open-and-chat', resource.id)
    },
    ...conditionalArrayItem<CtxItem>(
      origin === 'homescreen' && resource.type.startsWith('image/'),
      {
        type: 'action',
        icon: 'screenshot',
        text: 'Set as Background',
        action: () => dispatch('set-resource-as-background', resource.id)
      }
    ),
    { type: 'separator' },
    ...conditionalArrayItem<CtxItem>($contextMenuSpaces.length > 0, [
      {
        type: 'sub-menu',
        icon: '',
        disabled: $contextMenuSpaces.length === 0,
        text: 'Add to Context',
        items: $contextMenuSpaces
      },
      { type: 'separator' }
    ]),
    ...conditionalArrayItem<CtxItem>(!!showOpenAsFile, [
      {
        type: 'action',
        icon: '',
        text: `${isMac() ? 'Reveal in Finder' : 'Open in Explorer'}`,
        action: () => handleOpenAsFile()
      },
      { type: 'separator' }
    ]),
    ...conditionalArrayItem(isInSpace && resource.type.startsWith('image/'), {
      type: 'action',
      icon: 'screenshot',
      text: 'Use as Context Icon',
      action: () => handleUseAsSpaceIcon()
    }),
    ...conditionalArrayItem<CtxItem>(
      mode === 'full' ||
        mode === 'content' ||
        mode === 'compact' ||
        (mode === 'media' && !previewData?.image),
      {
        type: 'action',
        icon: 'edit',
        text: previewData?.title || resource?.metadata?.name ? 'Edit Title' : 'Add Title',
        action: () => {
          showEditMode = true
        }
      }
    ),
    ...conditionalArrayItem<CtxItem>(canBeRefreshed, {
      type: 'action',
      disabled: $resourceState === 'extracting',
      icon: 'reload',
      text: 'Refresh Content',
      action: () => refreshResourceData()
    }),
    ...(origin !== 'homescreen'
      ? [
          {
            type: isInSpace ? 'sub-menu' : 'action',
            icon: 'trash',
            text: isInSpace ? 'Delete' : 'Delete from Stuff',
            kind: 'danger',
            ...(isInSpace
              ? {
                  items: [
                    {
                      type: 'action',
                      icon: 'close',
                      text: 'Remove from Context',
                      kind: 'danger',
                      action: () => handleRemove(undefined, false)
                    },
                    {
                      type: 'action',
                      icon: 'trash',
                      text: 'Delete from Stuff',
                      kind: 'danger',
                      action: () => handleRemove(undefined, true)
                    }
                  ]
                }
              : { action: () => handleRemove(undefined, true) })
          }
        ]
      : [
          {
            type: 'action',
            icon: 'trash',
            text: 'Remove from Homescreen',
            kind: 'danger',
            action: () => dispatch('remove-from-homescreen')
          }
        ])
  ] as CtxItem[]

  onMount(async () => {
    await loadResource()
  })

  onDestroy(() => {
    resource.releaseData()
  })
</script>

<!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
<article
  id="resource-preview-{resource.id}-{Math.floor(Math.random() * 100000)}"
  style="--id:{resource.id}; opacity: {resourceBlacklisted ? '20%' : '100%'};"
  class="resource-preview content-{mode} view-{viewMode}"
  class:frame={!frameless}
  class:selected
  data-origin={origin}
  data-resource-type={resource.type}
  data-resource-id={resource.id}
  data-selectable
  data-selectable-id={resource.id}
  data-vaul-no-drag
  data-tooltip-target="stuff-example-resource"
  on:DragStart={handleDragStart}
  on:click={handleClick}
  on:mouseup={(e) => {
    if (e.button === 1) {
      // Middle mouse button
      e.preventDefault()
      openResourceAsTab(resource.id)
    }
  }}
  {draggable}
  use:HTMLDragItem.action={{}}
  use:contextMenu={{
    canOpen: interactive,
    items: contextMenuItems
  }}
>
  {#if $resourceState === 'extracting' && !hideProcessing}
    <Preview
      {resource}
      {interactive}
      {origin}
      {viewMode}
      type={resource.type}
      url={canonicalUrl}
      media={previewData?.image}
      title={previewData?.title}
      content={previewData?.content}
      contentType={previewData?.contentType}
      annotations={previewData?.annotations}
      status={failedText ? 'static' : 'processing'}
      statusText={failedText}
      metadata={previewData?.metadata}
    />
  {:else if previewData}
    <Preview
      {resource}
      {interactive}
      {origin}
      {viewMode}
      {titleEditable}
      type={previewData.type}
      url={previewData.url}
      media={previewData?.image}
      title={previewData?.title}
      content={previewData?.content}
      contentType={previewData?.contentType}
      annotations={previewData?.annotations}
      metadata={previewData?.metadata}
      bind:editTitle={showEditMode}
      bind:titleValue={$customTitleValue}
      on:edit-title={handleEditTitle}
      on:start-edit-title={handleStartEditTitle}
      on:click={handleTitleClick}
      on:highlightWebviewText
      on:seekToTimestamp
    />
  {:else}
    <div class="loading-box">
      <span><!--<Icon name="spinner" size="12px" />-->Loading…</span>
    </div>
  {/if}

  {#if resourcesBlacklistable}
    <div class="resource-blacklistable" use:hover={isHovered}>
      <Icon name="check" size="16px" />
      {#if $isHovered}
        <div class="whitespace-nowrap ml-2 leading-4" transition:slide={{ axis: 'x' }}>
          Selected
        </div>
      {/if}
    </div>
  {/if}
</article>

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

  .resource-blacklistable {
    position: absolute;
    top: 1rem;
    right: 1rem;
    display: flex;
    align-items: center;
    background: rgba(0, 123, 255, 0.85);
    backdrop-filter: blur(4px);
    box-shadow: 0px 0.425px 0px 0px rgba(0, 83, 172, 0.25);
    padding: 0.4rem;
    border-radius: 0.5rem;
    font-size: 0.85em;
    font-weight: 600;
    color: rgb(255, 255, 255);

    /*&.hover {
      background: rgba(255, 255, 255);
      color: rgb(12 74 110);
    }*/
  }

  @keyframes fade-in {
    0% {
      opacity: 0;
    }
    100% {
      opacity: 1;
    }
  }

  /// New resource previews // TODO: Clean up old styles
  article.resource-preview {
    --section-padding-inline: 1.4em;
    --section-padding-block: 1.2em;

    --MAX_title_lines: 4;
    --MAX_content_lines: 4;

    --background: #fff;
    --text-color: #281b53;
    --text-muted-opacity: 0.7;

    :global(.dark) & {
      --background: #1f2937;
      --text-color: #fff;
    }

    position: relative;
    width: 100%;
    height: auto;
    &.view-responsive {
      height: 100%;
    }

    color: var(--text-color);

    transition: outline 125ms ease;

    :global(*) {
      user-select: none;
      -webkit-user-drag: none;
    }

    &.frame {
      background: var(--background);
      border-radius: 1.1em;
      border: 1px solid rgba(50, 50, 50, 0.075);
      box-shadow:
        0 0 0 1px rgba(50, 50, 93, 0.06),
        0 2px 5px 0 rgba(50, 50, 93, 0.04),
        0 1px 1.5px 0 rgba(0, 0, 0, 0.01);
      overflow: hidden;
      outline: 0px solid transparent;

      &:not(.frameless):hover,
      &:global(:not(.frameless)[data-context-menu-anchor]) {
        outline: 2px solid rgba(50, 50, 50, 0.175);
      }

      &:global(.selected) {
        outline: 3px solid rgba(0, 123, 255, 0.4) !important;
      }

      :global(.dark) & {
        border-color: rgba(250, 250, 250, 0.075);
        box-shadow:
          0 0 0 1px rgba(205, 205, 161, 0.06),
          0 2px 5px 0 rgba(205, 205, 161, 0.04),
          0 1px 1.5px 0 rgba(255, 255, 255, 0.01);

        &:not(.frameless):hover {
          outline-color: rgba(250, 250, 250, 0.2);
        }

        &:global(.selected) {
          outline-color: rgba(10, 143, 255, 0.4) !important;
        }
      }

      /// Special resource type overrides
      // NOTE: I only override them in the framed mode, so that the color changes etc dont override sth
      // e.g. inside the command menu.
      &[data-resource-type='application/vnd.space.post.twitter'] {
        --text-color: #fff;
        --text-muted-opacity: 0.9;
        --background: radial-gradient(100% 100% at 50% 0%, #000 0%, #252525 100%);
      }
      &[data-resource-type='application/vnd.space.post.reddit'] {
        --text-color: #fff;
        --text-muted-opacity: 0.9;
        --color1: #ff4500;
        --color2: #ff7947;
        --background: radial-gradient(100% 100% at 50% 0%, var(--color1) 0%, var(--color2) 100%);
      }
      &[data-resource-type^='application/vnd.space.document.notion'] {
        --text-muted-opacity: 0.9;
        --color1: #fff;
        --color2: #fafafa;
        :global(.dark) & {
          --text-color: #fff;
          --color1: #222;
          --color2: #1a1a1a;
        }

        --background: radial-gradient(100% 100% at 50% 0%, var(--color1) 0%, var(--color2) 100%);
      }
      &[data-resource-type^='application/vnd.space.chat-thread.slack'] {
        --text-muted-opacity: 0.9;
        --color1: #d5ffed;
        --color2: #ecf9ff;
        --background: radial-gradient(100% 100% at 50% 0%, var(--color1) 0%, var(--color2) 100%);
      }
      &[data-resource-type^='application/vnd.space.post.youtube'] {
        // TODO: Custom Style
      }
    }

    &.interactive {
    }

    /// Loading state
    .loading-box {
      padding: var(--section-padding-block);
      > span {
        display: flex;
        align-items: center;
        gap: 0.5em;
        font-size: 0.9em;
        max-width: 100%;
        font-weight: 500;
        letter-spacing: 0.2px;
        opacity: var(--text-muted-opacity);
      }
      &:not(:has(.failed)) {
        animation: breathe 1.75s infinite ease;
      }
    }
  }

  /* Dragcula Dragging */
  :global(.resource-preview[data-drag-preview]) {
    box-shadow: none;
    max-width: 27ch;
    overflow: hidden;
    pointer-events: none;

    //width: var(--drag-width, auto) !important;
    //height: var(--drag-height, auto) !important;
  }
  :global(.drag-item[data-drag-preview] .resource-preview .preview) {
    box-shadow:
      rgba(50, 50, 93, 0.2) 0px 13px 27px -5px,
      rgba(0, 0, 0, 0.25) 0px 8px 16px -8px;
  }

  /// Animations
  @keyframes breathe {
    0% {
      opacity: 0.8;
    }
    50% {
      opacity: 0.5;
    }
    100% {
      opacity: 0.8;
    }
  }
</style>
