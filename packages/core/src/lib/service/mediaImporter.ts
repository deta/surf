import { hasClassOrParentWithClass } from '@horizon/tela'
import { useLogScope } from '../utils/log'
import { checkIfUrl, parseStringIntoUrl } from '../utils/url'

const log = useLogScope('mediaImporter')

export const DATA_TYPES = [
  'text/html',
  'text/plain',
  'text/uri-list',
  'text/tiptap',
  'space/resource'
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
        let source = img.src.startsWith('data:')
          ? img.src
          : // @ts-ignore
            await window.api.fetchAsDataURL(img.src)

        const response = await fetch(source)
        if (!response.ok) throw new Error('failed to fetch')
        const blob = await response.blob()
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

export type MediaParserResultText = {
  data: string
  type: 'text'
}

export type MediaParserResultURL = {
  data: URL
  type: 'url'
}

export type MediaParserResultFile = {
  data: File
  type: 'file'
}

export type MediaParserResultResource = {
  data: string
  type: 'resource'
}

export type MediaParserResultUnknown = {
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
      case 'text/html':
        const files = await processHTMLData(data)
        results.push(...files.map((file) => ({ data: file, type: 'file' }) as MediaParserResult))
        break
      case 'text/plain':
        const text = await processTextData(data)
        if (typeof text === 'string') {
          results.push({ data: text, type: 'text' })
        } else if (text instanceof URL) {
          results.push({ data: text, type: 'url' })
        }
        break
      case 'text/uri-list':
        const urls = await processUriListData(data)
        results.push(...urls.map((url) => ({ data: url, type: 'url' }) as MediaParserResult))
        break
      case 'text/tiptap':
        const richText = await processRichTextData(data)
        results.push({ data: richText, type: 'text' })
        break
      case 'space/resource':
        results.push({ data: data, type: 'resource' })
        break
    }

    // break out of the loop after handling at least one of the
    // possible data types
    if (results.length !== 0) break
  }

  return results
}

export const parseDataTransferFiles = async (dataTransfer: DataTransfer) => {
  const results: MediaParserResult[] = []

  const files = Array.from(dataTransfer?.files ?? [])
  await Promise.all(
    files.map(async (file) => {
      log.debug('file', file)

      const fileType = parseFileType(file)
      log.debug('parsed file type', fileType)

      if (fileType === 'image') {
        results.push({ data: file, type: 'file' })
      } else if (fileType === 'text') {
        const text = await file.text()
        results.push({ data: text, type: 'text' })
      } else {
        results.push({ data: null, type: 'unknown' })
      }
    })
  )

  return results
}

export const processDrop = async (e: DragEvent) => {
  const results: MediaParserResult[] = []

  const dataTransfer = e.dataTransfer
  if (!dataTransfer) return results

  // Parse data
  const data = await parseDataTransferData(dataTransfer)
  results.push(...data)

  // Parse files
  const files = await parseDataTransferFiles(dataTransfer)
  results.push(...files)

  return results
}

export const processPaste = async (e: ClipboardEvent) => {
  log.debug('paste', e)

  e.preventDefault()

  const clipboardItems = await navigator.clipboard.read()
  log.debug('clipboardItems', clipboardItems)

  let num = 0

  const blobs = await parseClipboardItems(clipboardItems)
  log.debug(
    'parsed items',
    blobs.map((blob) => blob.type)
  )

  const result: MediaParserResult[] = []

  await Promise.all(
    blobs.map(async (blob) => {
      const type = blob.type

      if (type.startsWith('image')) {
        const file = new File([blob], `image${num}.png`, { type: blob.type })
        result.push({ data: file, type: 'file' })
        num++
      } else if (type.startsWith('text')) {
        const text = await blob.text()
        log.debug('text', text)

        const url = parseStringIntoUrl(text)
        if (url) {
          result.push({ data: url, type: 'url' })
          num++
        } else {
          result.push({ data: text, type: 'text' })
          num++
        }
      } else {
        log.warn('unhandled blob type', type)
      }
    })
  )

  return result
}
