import type { Icons } from '@deta/icons'
import { ResourceJSON, ResourceNote, type Resource } from '@deta/services/resources'
import {
  ResourceTagsBuiltInKeys,
  ResourceTypes,
  type AnnotationCommentData,
  type AnnotationRangeData,
  type ResourceData,
  type ResourceDataAnnotation,
  type ResourceDataArticle,
  type ResourceDataDocument,
  type ResourceDataLink,
  type ResourceDataPost
} from '@deta/types'
import {
  conditionalArrayItem,
  getFileType,
  getHostname,
  parseStringIntoUrl,
  useLogScope
} from '@deta/utils'
import { get } from 'svelte/store'

const log = useLogScope('ResourcePreviewUtil')

export type Source = {
  text: string
  imageUrl?: string
  icon?: Icons
}

export type Author = {
  text?: string
  imageUrl?: string
  icon?: Icons
}

export type ContentMode =
  | 'full' // Try to show all available content
  | 'media' // Try to only show media if available
  | 'compact' // Try to condense the content into smaller space
  | 'inline' // Try to fit everything into a horizonal layout
export type ViewMode =
  | 'card' // Layout with auto height based on content size
  | 'responsive' // Layout filling max available width & height
  | 'inline'
  | 'full'

export type Origin = 'stuff' | 'stack' | 'homescreen' | 'homescreen-space'
export type ContentType = 'plain' | 'rich_text' | 'html' | 'markdown'

export type Annotation = {
  type: 'highlight' | 'comment'
  content: string
}

export type PreviewMetadata = {
  text?: string
  icon?: string
  imageUrl?: string
}

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

  metadata?: PreviewMetadata[]

  status?: {
    type: 'processing' | 'static'
    icon?: Icons
    text?: string
  }
}

export type PreviewOptions = {
  mode?: ContentMode
  viewMode?: ViewMode
  hideProcessing?: boolean
  showAnnotations?: boolean
  quality?: number // Only image/ resources
  maxDimension?: number // Only image/ resources
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

export const getResourcePreview = async (resource: Resource, opts?: PreviewOptions) => {
  const options = {
    mode: 'full',
    viewMode: 'full',
    hideProcessing: false,
    showAnnotations: true,
    ...opts
  } as Required<PreviewOptions>

  let resourceData: ResourceData | null = null
  let previewData: PreviewData | null = null

  const isLiveSpaceResource = !!resource.tags?.find(
    (x) => x.name === ResourceTagsBuiltInKeys.SPACE_SOURCE
  )

  const canonicalUrl = parseStringIntoUrl(
    resource.tags?.find((x) => x.name === ResourceTagsBuiltInKeys.CANONICAL_URL)?.value ||
      resource.metadata?.sourceURI ||
      ''
  )?.href

  const previewImageId = resource.tags?.find(
    (x) => x.name === ResourceTagsBuiltInKeys.PREVIEW_IMAGE_RESOURCE
  )?.value

  const annotations = resource.annotations ?? []
  const resourceState = resource.stateValue
  const userMediaResource = previewImageId ? `surf://surf/resource/${previewImageId}` : null

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
        if (!options.showAnnotations && annotations.length > 0) {
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
          image: userMediaResource ?? data.image ?? undefined,
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
        if (!options.showAnnotations && annotations.length > 0) {
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
          image: userMediaResource ?? data.images?.[0] ?? undefined,
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
          image: userMediaResource ?? imageUrl,
          url: data.url,
          source: {
            text:
              (resource.type === ResourceTypes.POST_REDDIT ? data.parent_title : data.site_name) ||
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
          image: userMediaResource ?? undefined,
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

        const source = data?.type === 'comment' ? (data.data as AnnotationCommentData).source : null
        const sourceClean =
          source === 'inline_ai' ? `Inline AI` : source === 'chat_ai' ? `Page AI` : undefined

        previewData = {
          type: resource.type,
          title: resource?.metadata?.name,
          annotations: highlightContent ? [{ type: 'highlight', content: highlightContent }] : [],
          content: commentContent,
          contentType: 'plain',
          image: userMediaResource ?? undefined,
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
          image: userMediaResource ?? data.image ?? undefined,
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
        image: userMediaResource ?? undefined,
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

      const image = userMediaResource ?? `surf://surf/resource/${resource.id}?raw`
      const imageURL = new URL(image)

      if (opts?.quality !== undefined) {
        imageURL.searchParams.set('quality', opts.quality.toString())
      }
      if (opts?.maxDimension !== undefined) {
        imageURL.searchParams.set('maxDimension', opts.maxDimension.toString())
      }

      previewData = {
        type: resource.type,
        title: undefined,
        content: undefined,
        image: imageURL.toString(),
        url: canonicalUrl ?? parseStringIntoUrl(resource.metadata?.sourceURI ?? '')?.href ?? '',
        source: {
          text: resource?.metadata?.name || hostname || canonicalUrl || getFileType(resource.type),
          imageUrl: hostname
            ? `https://www.google.com/s2/favicons?domain=${hostname}&sz=48`
            : undefined
        },
        theme: undefined
      }
    } else if (isGeneratedResource(resource)) {
      const hostname = getHostname(canonicalUrl ?? '')

      previewData = {
        type: resource.type,
        title: resource?.metadata?.name,
        content: undefined,
        image: userMediaResource ?? undefined,
        url: canonicalUrl ?? parseStringIntoUrl(resource.metadata?.sourceURI ?? '')?.href ?? '',
        source: {
          text: hostname ? `Generated on ${hostname}` : 'Surflet',
          imageUrl: undefined,
          icon: 'code-block'
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
        image: userMediaResource ?? undefined,
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

    if (resourceState === 'extracting' && !options.hideProcessing) {
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
    if (options.mode === 'media') {
      if (previewData.image !== undefined) {
        //previewData.title = undefined
        previewData.content = undefined
        previewData.metadata = undefined
      }
    } else if (options.mode === 'compact') {
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
    } else if (options.viewMode === 'inline') {
      if (previewData.title !== undefined) {
        previewData.content = undefined
      }
    }

    // Hide content if not showing annotations in stuff and we have annotations -> Content is hidden
    if (!options.showAnnotations && (previewData.annotations?.length ?? 0) > 0) {
      previewData.content = undefined
    }

    // Hide metadata for all images by default
    if (resource.type.startsWith('image/') || options.mode === 'media') {
      previewData.metadata = []
    }
  } catch (e) {
    log.error('Failed to load resource', e)
    previewData = {
      type: resource.type,
      title: resource?.metadata?.name,
      content: undefined,
      image: userMediaResource ?? undefined,
      url: canonicalUrl ?? parseStringIntoUrl(resource.metadata?.sourceURI ?? '')?.href ?? '',
      source: {
        text: canonicalUrl ?? getFileType(resource.type),
        imageUrl: undefined
      },
      theme: undefined
    }
  }

  return previewData
}

export const isGeneratedResource = (resource: Resource) => {
  return (
    (resource.tags ?? []).find(
      (x) => x.name === ResourceTagsBuiltInKeys.SAVED_WITH_ACTION && x.value === 'generated'
    ) !== undefined
  )
}
