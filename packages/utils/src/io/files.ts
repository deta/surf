import { isMarkdownResourceType, ResourceTypes, type SFFSRawCompositeResource } from '@deta/types'
import { fromMime } from 'human-filetypes'
import mime from 'mime-types'
import { uuidToBase62 } from '../data'

export const humanFileTypes = {
  'image/png': 'PNG',
  'image/jpeg': 'JPEG',
  'image/gif': 'GIF',
  'image/svg+xml': 'SVG',
  'image/bmp': 'BMP',
  'image/webp': 'WebP',
  'image/tiff': 'TIFF',
  'video/mp4': 'MP4',
  'video/ogg': 'OGG',
  'video/webm': 'WebM',
  'video/quicktime': 'QuickTime',
  'video/x-msvideo': 'AVI',
  'audio/mpeg': 'MP3',
  'audio/ogg': 'OGG',
  'audio/wav': 'WAV',
  'audio/webm': 'WebM',
  'text/plain': 'Text',
  'text/markdown': 'Markdown',
  'text/x-markdown': 'Markdown',
  'text/html': 'HTML',
  'text/css': 'CSS',
  'text/csv': 'CSV',
  'font/otf': 'OTF',
  'font/ttf': 'TTF',
  'font/woff': 'WOFF',
  'font/woff2': 'WOFF2',
  'application/json': 'JSON',
  'application/xml': 'XML',
  'application/pdf': 'PDF',
  'application/javascript': 'JavaScript',
  'application/zip': 'ZIP',
  'application/msword': 'Word',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'Word',
  'application/vnd.ms-excel': 'Excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'Excel',
  'application/vnd.ms-powerpoint': 'PowerPoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'PowerPoint',
  'application/epub+zip': 'EPUB',
  'application/x-rar-compressed': 'RAR',
  'application/x-7z-compressed': '7Z',
  'application/x-tar': 'TAR',
  'application/gzip': 'GZIP',
  'application/x-bzip2': 'BZIP2',
  'application/x-xz': 'XZ',
  'application/vnd.rar': 'RAR',
  'application/vnd.oasis.opendocument.text': 'OpenDocument Text',
  'application/vnd.oasis.opendocument.spreadsheet': 'OpenDocument Spreadsheet',
  'application/vnd.oasis.opendocument.presentation': 'OpenDocument Presentation',
  'application/vnd.oasis.opendocument.graphics': 'OpenDocument Graphics',
  'application/vnd.oasis.opendocument.chart': 'OpenDocument Chart',
  'application/vnd.oasis.opendocument.formula': 'OpenDocument Formula',
  'application/vnd.oasis.opendocument.database': 'OpenDocument Database',
  'application/vnd.oasis.opendocument.image': 'OpenDocument Image',
  'application/x-apple-diskimage': 'Apple Disk Image',
  [ResourceTypes.LINK]: 'Link',
  [ResourceTypes.ARTICLE]: 'Article',
  [ResourceTypes.POST]: 'Post',
  [ResourceTypes.CHAT_MESSAGE]: 'Comment',
  [ResourceTypes.CHAT_THREAD]: 'Chat',
  [ResourceTypes.DOCUMENT_SPACE_NOTE]: 'Document',
  [ResourceTypes.DOCUMENT]: 'Document',
  [ResourceTypes.TABLE_COLUMN]: 'Table Column',
  [ResourceTypes.TABLE]: 'Table',
  [ResourceTypes.ANNOTATION]: 'Annotation',
  [ResourceTypes.HISTORY_ENTRY]: 'Link'
}

export const codeFileTypes = [
  'application/javascript',
  'application/json',
  'application/xml',
  'text/markdown',
  'text/html',
  'text/css',
  'text/csv',
  'text/plain',
  'text/x-markdown'
]

export const getFileType = (fileType: string): string => {
  if (!fileType) return 'unknown'
  const parsed = (humanFileTypes as any)[fileType]
  if (!parsed) {
    const match = Object.entries(humanFileTypes).find((x) => fileType.includes(x[0]))
    if (match) {
      return match[1]
    }
  }

  return parsed || fileType
}

export const getFileKind = (fileType: string) => {
  const parsed = fromMime(fileType)
  if (!parsed || parsed === 'unknown') {
    if (codeFileTypes.includes(fileType)) {
      return 'code'
    }

    const match = Object.entries(humanFileTypes).find((x) => fileType.includes(x[0]))
    if (match) {
      return match[1].toLowerCase().replace(/\s/g, '-')
    }
  }

  return parsed || 'unknown'
}

export const toHumanFileSize = (bytes: number, si = true, dp = 1) => {
  const thresh = si ? 1000 : 1024

  if (Math.abs(bytes) < thresh) {
    return bytes + ' B'
  }

  const units = si
    ? ['kB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB']
    : ['KiB', 'MiB', 'GiB', 'TiB', 'PiB', 'EiB', 'ZiB', 'YiB']
  let u = -1
  const r = 10 ** dp

  do {
    bytes /= thresh
    ++u
  } while (Math.round(Math.abs(bytes) * r) / r >= thresh && u < units.length - 1)

  return bytes.toFixed(dp) + ' ' + units[u]
}

export const formatCodeLanguage = (lang: string) => {
  if (lang === 'javascript') return 'JS'
  if (lang === 'typescript') return 'TS'
  if (lang === 'html') return 'HTML'
  if (lang === 'css') return 'CSS'
  if (lang === 'scss') return 'SCSS'
  if (lang === 'json') return 'JSON'
  if (lang === 'bash') return 'Bash'
  if (lang === 'shell') return 'Shell'
  if (lang === 'plaintext') return 'Text'
  if (lang === 'markdown') return 'MD'
  if (lang === 'yaml') return 'YAML'
  if (lang === 'xml') return 'XML'
  if (lang === 'sql') return 'SQL'
  if (lang === 'graphql') return 'GraphQL'
  if (lang === 'python') return 'Python'
  if (lang === 'java') return 'Java'
  if (lang === 'csharp') return 'C#'
  if (lang === 'cpp') return 'C++'
  if (lang === 'c') return 'C'
  if (lang === 'ruby') return 'Ruby'
  if (lang === 'php') return 'PHP'
  if (lang === 'perl') return 'Perl'
  if (lang === 'rust') return 'Rust'
  if (lang === 'go') return 'Go'
  if (lang === 'swift') return 'Swift'
  if (lang === 'kotlin') return 'Kotlin'
  if (lang === 'dart') return 'Dart'
  if (lang === 'elixir') return 'Elixir'
  return lang
}

export const codeLanguageToMimeType = (code: string) => {
  const parsed = code.toLowerCase()
  if (parsed === 'plaintext') return 'text/plain'
  return `text/${parsed}`
}

export const mimeTypeToCodeLanguage = (mimeType: string) => {
  if (mimeType === 'text/plain') return 'plaintext'

  const type = mimeType.split('/')[1]
  return type
}

/**
 * truncate filename if it's too long but make sure the extension is preserved
 */
export const shortenFilename = (raw: string, max = 30) => {
  const extension = raw.slice(raw.lastIndexOf('.'))
  const name = raw.slice(0, raw.lastIndexOf('.'))

  return name.length > max ? `${name.slice(0, max)}[...]${extension}` : raw
}

export const getResourceFileExtension = (type: string) => {
  if (isMarkdownResourceType(type)) {
    return 'md'
  }

  const mimeType = mime.extension(type)
  if (mimeType) {
    return mimeType
  }

  return 'json'
}

export const getResourceFileName = (resource: SFFSRawCompositeResource) => {
  if (resource.metadata?.name) {
    const shortName = resource.metadata.name
      .slice(0, 150)
      .replace(/[<>:"\/\\|?*\x00-\x1F]/g, '-')
      .replace(/^\.+/, '') // Remove leading periods
      .replace(/\s+/g, ' ') // Normalize spaces
    const shortID = uuidToBase62(resource.resource.id)
    return `${shortName}-${shortID}`
  }

  return resource.resource.id
}
