import { ResourceTypes } from '@horizon/types'
import { fromMime } from 'human-filetypes'

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

/**
 * truncate filename if it's too long but make sure the extension is preserved
 */
export const shortenFilename = (raw: string, max = 30) => {
  const extension = raw.slice(raw.lastIndexOf('.'))
  const name = raw.slice(0, raw.lastIndexOf('.'))

  return name.length > max ? `${name.slice(0, max)}[...]${extension}` : raw
}
