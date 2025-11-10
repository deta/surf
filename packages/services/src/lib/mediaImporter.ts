import {
  useLogScope,
  checkIfUrl,
  parseStringIntoUrl,
  ResourceTag,
  truncate,
  getFileKind
} from '@deta/utils'
import {
  ResourceTagsBuiltInKeys,
  type SFFSResourceMetadata,
  type SFFSResourceTag
} from '@deta/types'
import { WebParser } from '@deta/web-parser'

import { Resource, type ResourceManager } from './resources/resources.svelte'
import { type MentionItem, MentionItemType } from '@deta/editor'
import { useNotebookManager } from './notebooks'

const log = useLogScope('mediaImporter')

export enum MEDIA_TYPES {
  RESOURCE = 'space/resource'
}

export const DATA_TYPES = [
  MEDIA_TYPES.RESOURCE,
  'text/html',
  'text/plain',
  'text/uri-list',
  'text/tiptap'
]
export const SUPPORTED_MIMES = [
  'text/plain',
  'text/html',
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/svg+xml',
  'image/webp',
  'audio/mpeg',
  'audio/ogg',
  'audio/wav'
]

const processHTMLData = async (data: string) => {
  const div = document.createElement('div')
  div.innerHTML = data ?? ''
  const images = Array.from(div.querySelectorAll('img'))

  let num = 0

  const parsed = await Promise.all(
    images.map(async (img) => {
      try {
        let dataUrl = img.src.startsWith('data:')
          ? img.src
          : // @ts-ignore
            await window.api.fetchAsDataURL(img.src)

        // Convert data URL to Blob
        const [metadata, base64Data] = dataUrl.split(',')
        const mimeType = metadata.match(/:(.*?);/)?.[1] || 'image/png'
        const binaryString = atob(base64Data)
        const len = binaryString.length
        const array = new Uint8Array(len)
        for (let i = 0; i < len; i++) {
          array[i] = binaryString.charCodeAt(i)
        }

        const blob = new Blob([array], { type: mimeType })
        const file = new File([blob], `image${num}.png`, { type: blob.type })

        num++

        return file
      } catch (err) {
        log.debug('failed to create image card: ', { image: img, err: err })
        return null
      }
    })
  )

  return parsed.filter((file) => file !== null) as File[]
}

const processTextData = async (data: string) => {
  if (data.trim() === '') return false

  if (checkIfUrl(data)) {
    return new URL(data)
  } else {
    return data
  }
}

const processRichTextData = async (data: string) => {
  try {
    if (data.trim() === '') return false

    const parsed = JSON.parse(data)

    return parsed
  } catch (err) {
    log.debug('failed to parse rich text data', err)
    return false
  }
}

const processUriListData = async (data: string) => {
  const urls = data.split(/\r\n|\r|\n/)
  const parsed = urls
    .map((url) => {
      if (checkIfUrl(url)) {
        return new URL(url)
      }
    })
    .filter((url) => url !== undefined)

  return parsed as URL[]
}

export const parseFileType = (file: File) => {
  if (file.type.startsWith('image')) return 'image'
  if (file.type.startsWith('text')) return 'text'

  if (file.type === '') {
    if (file.name.endsWith('.txt') || file.name.endsWith('.md')) return 'text'
  }

  return 'unknown'
}

export const canConsume = (mimeType: string) => {
  if (!SUPPORTED_MIMES.includes(mimeType)) {
    let canConsume = false
    for (const type of SUPPORTED_MIMES) {
      if (type.includes('/*')) {
        const [typePrefix] = type.split('/')
        if (mimeType.startsWith(typePrefix)) {
          canConsume = true
        }
      }
    }

    return canConsume
  }

  return true
}

export const parseClipboardItems = async (clipboardItems: ClipboardItem[]) => {
  // let parsedItems: Blob[] = []

  const parsedItems = await Promise.all(
    clipboardItems.map(async (item) => {
      const supportedTypes = item.types.filter((type) => {
        return canConsume(type)
      })

      // prevent duplicate cards by removing overlapping types
      if (supportedTypes.includes('text/html') && supportedTypes.includes('text/plain')) {
        supportedTypes.splice(supportedTypes.indexOf('text/plain'), 1)
      } else if (supportedTypes.includes('image/png') && supportedTypes.includes('image/jpeg')) {
        supportedTypes.splice(supportedTypes.indexOf('image/jpeg'), 1)
      } else if (supportedTypes.includes('image/png') && supportedTypes.includes('image/webp')) {
        supportedTypes.splice(supportedTypes.indexOf('image/webp'), 1)
      } else if (supportedTypes.includes('image/jpeg') && supportedTypes.includes('image/webp')) {
        supportedTypes.splice(supportedTypes.indexOf('image/webp'), 1)
      } else if (
        supportedTypes.some((type) => type.startsWith('image/')) &&
        supportedTypes.includes('text/plain')
      ) {
        supportedTypes.splice(supportedTypes.indexOf('text/plain'), 1)
      } else if (
        supportedTypes.some((type) => type.startsWith('image/')) &&
        supportedTypes.includes('text/html')
      ) {
        supportedTypes.splice(supportedTypes.indexOf('text/html'), 1)
      }

      return Promise.all(supportedTypes.map((type) => item.getType(type)))
    })
  )

  return parsedItems.flat()
}

export interface MediaParserResultBase {
  data: any
  type: string
  metadata: Partial<SFFSResourceMetadata>
}

export interface MediaParserResultText extends MediaParserResultBase {
  data: string
  type: 'text'
}

export interface MediaParserResultURL extends MediaParserResultBase {
  data: URL
  type: 'url'
}

export interface MediaParserResultFile extends MediaParserResultBase {
  data: Blob
  type: 'file'
}

export interface MediaParserResultResource extends MediaParserResultBase {
  data: string
  type: 'resource'
}

export interface MediaParserResultUnknown extends MediaParserResultBase {
  data: null
  type: 'unknown'
}

export type MediaParserResult =
  | MediaParserResultText
  | MediaParserResultURL
  | MediaParserResultFile
  | MediaParserResultResource
  | MediaParserResultUnknown

export const parseDataTransferData = async (dataTransfer: DataTransfer) => {
  const results: MediaParserResult[] = []

  for (const type of DATA_TYPES) {
    const data = dataTransfer?.getData(type)
    if (!data || data.trim() === '') continue

    switch (type) {
      case MEDIA_TYPES.RESOURCE:
        results.push({ data: data, type: 'resource', metadata: {} })
        break
      case 'text/html':
        const files = await processHTMLData(data)
        results.push(
          ...files.map(
            (file) =>
              ({
                data: file,
                type: 'file',
                metadata: {
                  name: file.name,
                  alt: '',
                  sourceURI: (file as any).path
                }
              }) as MediaParserResult
          )
        )
        break
      case 'text/plain':
        const text = await processTextData(data)
        if (typeof text === 'string') {
          results.push({ data: text, type: 'text', metadata: {} })
        } else if (text instanceof URL) {
          results.push({ data: text, type: 'url', metadata: {} })
        }
        break
      case 'text/uri-list':
        const urls = await processUriListData(data)
        results.push(...urls.map((url) => ({ data: url, type: 'url' }) as MediaParserResult))
        break
      case 'text/tiptap':
        const richText = await processRichTextData(data)
        results.push({ data: richText, type: 'text', metadata: {} })
        break
    }

    // break out of the loop after handling at least one of the
    // possible data types
    if (results.length !== 0) break
  }

  return results
}

export const processFile = async (file: File) => {
  log.debug('file', file)

  const fileType = parseFileType(file)
  log.debug('parsed file type', fileType)

  if (file.name.startsWith('space_resource_')) {
    const id = file.name.split('_')[2]?.split('.')[0]
    if (id) {
      return {
        data: id,
        type: 'resource',
        metadata: {
          name: file.name,
          alt: '',
          sourceURI: ''
        }
      } as MediaParserResult
    }
  }

  if (fileType === 'text') {
    const text = await file.text()
    return {
      data: text,
      type: 'text',
      metadata: {
        name: file.name,
        alt: '',
        sourceURI: (file as any).path
      }
    } as MediaParserResult
  } else {
    return {
      data: file,
      type: 'file',
      metadata: {
        name: file.name,
        alt: '',
        sourceURI: (file as any).path
      }
    } as MediaParserResult
  }
}

export const processText = async (text: string): Promise<MediaParserResult[]> => {
  // Immediately resolve with the structured result
  return Promise.resolve([
    {
      data: text,
      type: 'text',
      metadata: {
        name: '',
        alt: '',
        sourceURI: ''
      }
    }
  ])
}

export const parseDataTransferFiles = async (dataTransfer: DataTransfer) => {
  const results: MediaParserResult[] = []

  const files = Array.from(dataTransfer?.files ?? [])
  await Promise.all(
    files.map(async (file) => {
      log.debug('file', file)

      const processed = await processFile(file)
      results.push(processed)
    })
  )

  return results
}

export const processDrop = async (e: DragEvent) => {
  const results: MediaParserResult[] = []

  const dataTransfer = e.dataTransfer
  if (!dataTransfer) return results

  const source = dataTransfer.getData('text/space-source')
  log.debug('dataTransfer source', source)

  // Parse data
  const data = await parseDataTransferData(dataTransfer)
  results.push(...data)

  // Parse files
  const files = await parseDataTransferFiles(dataTransfer)
  results.push(...files)

  if (source) {
    return results.map((result) => {
      if (!result.metadata.sourceURI) {
        result.metadata.sourceURI = source
      }

      return result
    })
  }

  return results
}

export const processPaste = async (e: ClipboardEvent) => {
  log.debug('paste', e)

  e.preventDefault()

  const result: MediaParserResult[] = []

  // Manual fix to allow reading files, dont want to change the clipboard methods yet so nothing breaks
  const clipboardDataItems = Array.from(e.clipboardData?.items || [])

  if (clipboardDataItems.length > 0) {
    for (const item of clipboardDataItems) {
      if (item.kind === 'file') {
        const file = item.getAsFile()
        if (file) {
          result.push({
            data: file as Blob,
            type: 'file',
            metadata: {
              name: file?.name || 'pasted-file',
              alt: '',
              sourceURI: (file as any)?.path
            }
          })
        }
      }
    }
    // Only return early if we actually found files
    // Otherwise fall through to the navigator.clipboard.read() method
    if (result.length > 0) {
      return result
    }
  }

  // Old way we got the items which breaks for files tho
  try {
    const clipboardItems = await navigator.clipboard.read()

    let num = 0

    const blobs = await parseClipboardItems(clipboardItems)

    await Promise.all(
      blobs.map(async (blob) => {
        const type = blob.type

        if (type.startsWith('image')) {
          const file = new File([blob], `image${num}.png`, { type: blob.type })
          result.push({
            data: file,
            type: 'file',
            metadata: {
              name: file.name,
              alt: '',
              sourceURI: (file as any).path
            }
          })
          num++
        } else if (type.startsWith('text')) {
          const text = await blob.text()
          log.debug('text', text)

          const url = parseStringIntoUrl(text)
          if (url) {
            result.push({
              data: url,
              type: 'url',
              metadata: {}
            })
            num++
          } else {
            result.push({
              data: text,
              type: 'text',
              metadata: {}
            })
            num++
          }
        } else {
          log.warn('unhandled blob type', type)
        }
      })
    )
  } catch (error) {
    log.error('Error reading from navigator.clipboard:', error)
  }

  return result
}

export const createResourcesFromMediaItems = async (
  resourceManager: ResourceManager,
  parsed: MediaParserResult[],
  userGeneratedText: string,
  tags: SFFSResourceTag[] = [ResourceTag.dragLocal()]
) => {
  const resources = await Promise.all(
    parsed.map(async (item) => {
      log.debug('processed item', item)
      log.debug('usercontext', userGeneratedText)
      item.metadata.userContext = userGeneratedText

      let resource
      if (item.type === 'text') {
        resource = await resourceManager.createResourceNote(item.data, item.metadata, tags, false)
      } else if (item.type === 'url') {
        const parsed = await extractAndCreateWebResource(
          resourceManager,
          item.data.href,
          item.metadata,
          [ResourceTag.canonicalURL(item.data.href), ...tags]
        )
        resource = parsed.resource
      } else if (item.type === 'file') {
        resource = await resourceManager.createResourceOther(item.data, item.metadata, tags)
      } else if (item.type === 'resource') {
        resource = await resourceManager.getResource(item.data)
      } else {
        log.warn('unhandled item type', item.type)
        return
      }

      log.debug('Created resource', resource)

      return resource
    })
  )

  return resources.filter((resource) => resource) as Resource[]
}

// @Felix: flag for extraction of factory tab
export const extractAndCreateWebResource = async (
  resourceManager: ResourceManager,
  url: string,
  metadata?: Partial<SFFSResourceMetadata>,
  tags?: SFFSResourceTag[]
) => {
  log.debug('Extracting resource from', url)

  const additionalTags: SFFSResourceTag[] = []

  const existingCanoncialUrlTag = tags?.find(
    (t) => t.name === ResourceTagsBuiltInKeys.CANONICAL_URL
  )
  if (!existingCanoncialUrlTag) {
    additionalTags.push(ResourceTag.canonicalURL(url))
  }

  const allTags = [...(tags ?? []), ...additionalTags]

  const fullMetadata = {
    sourceURI: url,
    ...metadata
  }

  const webParser = new WebParser(url)

  // Extract a resource from the web page using a webview, this should happen only when saving the resource
  const extractedResource = await webParser.extractResourceUsingWebview(document)
  log.debug('extractedResource', extractedResource)

  if (!extractedResource) {
    log.debug('No resource extracted, saving as link')

    const resource = await resourceManager.createResourceLink({ url: url }, metadata, allTags)

    return {
      resource,
      content: undefined
    }
  }

  const title = (extractedResource.data as any)?.title ?? ''
  metadata = {
    name: title,
    sourceURI: url,
    ...metadata
  }
  const resource = await resourceManager.createDetectedResource(
    extractedResource,
    metadata,
    allTags
  )

  const content = WebParser.getResourceContent(extractedResource.type, extractedResource.data)

  return {
    resource,
    content
  }
}

export const createResourcesFromFiles = async (files: File[], resourceManager: ResourceManager) => {
  const processedFiles = await Promise.all(
    files.map(async (file) => {
      log.debug('file', file)

      const processed = await processFile(file)
      return processed
    })
  )

  const newResources = await createResourcesFromMediaItems(resourceManager, processedFiles, '')

  return newResources
}

export const promptUserToSelectFiles = async (
  opts?: Electron.OpenDialogOptions
): Promise<File[]> => {
  // @ts-ignore
  const files = await window.api.showOpenDialog({
    ...opts,
    properties: ['openFile', 'multiSelections']
  })
  log.debug('Import files:', files)
  if (!files) return []

  return files
}

export const promptForFilesAndTurnIntoResources = async (
  resourceManager: ResourceManager,
  notebookId?: string
) => {
  const files = await promptUserToSelectFiles({
    title: 'Select File to Use as Context',
    buttonLabel: 'Import to Surf',
    filters: [
      {
        name: 'Files',
        extensions: [
          'pdf',
          'png',
          'jpeg',
          'jpg'

          // We don't support proeper conversion on import yet
          //'txt', 'html', 'md'
        ]
      }
    ]
  })

  if (files.length === 0) {
    log.debug('No files selected')
    return
  }

  log.debug('Files selected:', files)

  const resources = await createResourcesFromFiles(files, resourceManager)
  if (resources.length === 0) {
    log.warn('No resources created from selected files')
    return
  }

  log.debug('Resources created:', resources)

  if (notebookId && notebookId !== 'drafts') {
    log.debug(`Adding resources to notebook ${notebookId}`)
    const notebookManager = useNotebookManager()
    await notebookManager.addResourcesToNotebook(
      notebookId,
      resources.map((r) => r.id)
    )
  }

  return resources
}

export const promptForFilesAndTurnIntoResourceMentions = async (
  resourceManager: ResourceManager
) => {
  const resources = await promptForFilesAndTurnIntoResources(resourceManager)
  if (!resources) return []

  return resources.map((resource) => {
    const url = resource.url
    const mentionItem: MentionItem = {
      id: resource.id,
      type: MentionItemType.RESOURCE,
      label: truncate(
        resource.metadata?.name || url || `${resource.id} - ${resource.type}` || 'Undefined',
        30
      ),
      icon: url ? `favicon;;${url}` : `file;;${getFileKind(resource.type)}`,
      data: {
        resourceId: resource.id
      }
    }
    return mentionItem
  })
}
