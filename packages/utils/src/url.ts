import { isIP } from 'is-ip'
import { isWindows } from './system'

export const prependProtocol = (url: string, secure = true) => {
  try {
    if (!url.startsWith('http')) {
      return secure ? `https://${url}` : `http://${url}`
    }

    const urlObj = new URL(url)
    if (urlObj.protocol === 'http:') {
      return secure ? urlObj.href.replace('http:', 'https:') : urlObj.href
    }

    return url
  } catch (e) {
    return url
  }
}

export const parseURL = (url: string) => {
  try {
    return new URL(url)
  } catch (e) {
    return null
  }
}

export const makeAbsoluteURL = (urlOrPath: string, base: URL) => {
  try {
    return new URL(urlOrPath, base.origin).href
  } catch (e) {
    return null
  }
}

export const checkIfUrl = (url: string) => {
  try {
    new URL(url)
    return true
  } catch (_) {
    return false
  }
}

export const optimisticCheckIfUrl = (url: string) => {
  const pattern = /^(?:https?:\/\/)?(?:[\w-]+\.)+[a-zA-Z]{2,}(?:\/[^\s]*)?$/
  return pattern.test(url)
}

export const optimisticCheckIfURLOrIPorFile = (url: string) => {
  return (
    optimisticCheckIfUrl(url) ||
    isIP(url) ||
    url.startsWith('file://') ||
    url.startsWith('data:') ||
    url.startsWith('blob:') ||
    checkIfLocalhost(url)
  )
}

export const stringToURLList = (input: string) => {
  const urlPattern =
    /(\bhttps?:\/\/[\w-]+(\.[\w-]+)+\.?(:\d+)?(\/\S*)?)|\bwww\.[\w-]+(\.[\w-]+)+\.?(:\d+)?(\/\S*)?|\b[\w-]+(\.[\w-]+)+\.[a-z]{2,}(:\d+)?(\/\S*)?/gi

  const matches = input.match(urlPattern)

  let urls

  if (matches) {
    urls = matches.map((url) => {
      if (!/^https?:\/\//i.test(url)) {
        return `http://${url}`
      }
      return url
    })
  }

  return urls
}

export const parseStringIntoUrl = (raw: string, base?: URL) => {
  try {
    const isValidURL = optimisticCheckIfUrl(raw)
    if (!isValidURL) {
      return null
    }

    const text = prependProtocol(raw, true)
    return base ? new URL(text, base.origin) : new URL(text)
  } catch (_) {
    return null
  }
}

export const checkIfYoutubeUrl = (url: string) => {
  const youtubeRegex = /^(https?:\/\/)?(www\.)?(m\.)?(youtube(-nocookie)?\.com|youtu\.?be)\/.+$/

  return youtubeRegex.test(url)
}

export const getYoutubeVideoId = (url: URL) => {
  const youtubeVideoIdRegex =
    /(?:youtube(?:-nocookie)?\.com\/(?:[^/\n\s]+\/\S+\/|(?:v|e(?:mbed)?)\/|\S*?[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/

  if (checkIfYoutubeUrl(url.href)) {
    return url.toString().match(youtubeVideoIdRegex)?.[1] ?? null
  }
  return null
}

export const getInstanceAlias = (url: URL) => {
  const subdomain = url.hostname.split('.')[0]
  if (subdomain.endsWith('-embed')) {
    return subdomain.split('-embed')[0]
  }

  return subdomain
}

export const generateRootDomain = (urlInput: string | URL) => {
  if (!urlInput) {
    return ''
  }

  let url
  try {
    if (typeof urlInput === 'string') {
      if (/^https?:\/\/[^ "]+$/.test(urlInput)) {
        url = new URL(urlInput)
      } else {
        throw new Error('Invalid URL format')
      }
    } else {
      url = urlInput
    }

    const domain = url.hostname
    const elems = domain.split('.')
    if (elems.length < 2) {
      return domain
    }

    const iMax = elems.length - 1
    const elem1 = elems[iMax - 1]
    const elem2 = elems[iMax]
    const isSecondLevelDomain = iMax >= 3 && (elem1 + elem2).length <= 5

    return (isSecondLevelDomain ? elems[iMax - 2] + '.' : '') + elem1 + '.' + elem2
  } catch (error) {
    console.error('Error parsing URL:', error)
    return '' // or return some default error indication as needed
  }
}

export const checkIfSpaceApp = (url: URL) => {
  return (
    url.hostname.endsWith('deta.app') ||
    url.hostname.endsWith('deta.pizza') ||
    url.hostname.endsWith('deta.dev')
  )
}

export const checkIfLocalhost = (raw: string) => {
  try {
    const url = new URL(prependProtocol(raw, false))
    return url.hostname === 'localhost' || url.hostname === '127.0.0.1'
  } catch (error) {
    return false
  }
}

export const checkIfIPAddress = (raw: string) => {
  return isIP(raw)
}

export const parseStringIntoBrowserLocation = (raw: string) => {
  const isLocalhost = checkIfLocalhost(raw)
  if (isLocalhost) {
    return prependProtocol(raw, false)
  }

  const isURL = checkIfUrl(raw)
  if (isURL) {
    return raw
  }

  const url = parseStringIntoUrl(raw)
  if (url) {
    return url.href
  }

  const isIPAddress = checkIfIPAddress(raw)
  if (isIPAddress) {
    return prependProtocol(raw, false)
  }

  return null
}

export const normalizeURL = (url: string): string => {
  // Remove protocol (http, https), www, and trailing slash from the root domain for consistent comparison
  // Keep path and query string intact
  return url
    .replace(/^(https?:\/\/)?(www\.)?/, '') // Remove protocol and www
    .replace(/\/+$/, '') // Remove trailing slash(es) from the root domain, not affecting paths
}

/**
 * Truncates the URL path and query params so the hostname and beggining and end of the URL are always visible
 */
export const truncateURL = (url: string, maxLength = 75) => {
  try {
    if (!url) {
      return ''
    }

    const { hostname, pathname, search, protocol } = new URL(url)

    let fullPath = pathname + search

    const decodedPath = decodeURIComponent(fullPath)
    const internationalPath = new Intl.Segmenter().segment(decodedPath)
    fullPath = Array.from(internationalPath, (segment) => segment.segment).join('')

    if (fullPath === '/') {
      fullPath = ''
    }

    const prefix = protocol === 'https:' ? hostname : `http://${hostname}`
    const remainingLength = maxLength - prefix.length

    if (fullPath.length <= remainingLength) {
      return prefix + fullPath
    }

    const ellipsis = '...'
    // Add 1 to start chunk to use any remaining character from odd-length remaining space
    const startChunkSize = Math.ceil((remainingLength - ellipsis.length) / 2)
    const endChunkSize = Math.floor((remainingLength - ellipsis.length) / 2)
    const start = fullPath.slice(0, startChunkSize)
    const end = fullPath.slice(-endChunkSize)

    return `${prefix}${start}${ellipsis}${end}`
  } catch (error) {
    return ''
  }
}

export const getHostname = (raw: string) => {
  try {
    const url = new URL(raw)
    return url.hostname
  } catch (error) {
    return null
  }
}

export const getNormalizedHostname = (raw: string) => {
  try {
    const url = new URL(raw)
    return normalizeURL(url.hostname)
  } catch (error) {
    return null
  }
}

export const getURLBase = (raw: string) => {
  try {
    const url = new URL(raw)
    return `${url.protocol}//${url.hostname}`
  } catch (error) {
    return null
  }
}

export const checkIfSecureURL = (url: string) => {
  try {
    const isLocalhost = checkIfLocalhost(url)
    if (isLocalhost) {
      return true
    }

    const parsed = new URL(url)

    // Any protocol other than http is considered secure here (https, ftp, etc)
    return parsed.protocol !== 'http:'
  } catch (error) {
    return false
  }
}

export const parseUrlIntoCanonical = (value: string | URL) => {
  let url: URL
  if (typeof value === 'string') {
    const parsed = parseStringIntoUrl(value)
    if (!parsed) {
      return null
    }

    url = parsed
  } else {
    url = value
  }

  const cleanHostname = normalizeURL(url.hostname)

  if (cleanHostname === 'notion.so') {
    const pathParts = url.pathname.split('/')
    const lastPart = pathParts[pathParts.length - 1]
    const notionPageRegex = /^(.*?)-([a-f0-9]{32})$/i

    if (notionPageRegex.test(lastPart)) {
      const pageId = lastPart.split('-').pop()
      url.pathname = `${pathParts[1]}/${pageId}`
      url.hostname = 'notion.so'
      return url.toString()
    }
  } else if (cleanHostname === 'youtube.com') {
    // if video URL remove unecessary search params
    if (url.pathname.startsWith('/watch')) {
      const videoId = url.searchParams.get('v')
      if (videoId) {
        url.pathname = `/watch`
        url.search = ''
        url.searchParams.set('v', videoId)
      }
    }
  }

  const normalized = normalizeURL(url.href)
  if (!normalized.startsWith(url.protocol)) {
    return `${url.protocol}//${normalized}`
  }

  return normalized
}

export const isPDFViewerURL = (url: string, entryPoint: string) => {
  if (url.startsWith(entryPoint)) return true
  if (
    isWindows() &&
    url.startsWith(encodeURI(entryPoint.replaceAll('\\', '/').replace('file://', 'file:///')))
  )
    return true
  return false
}

export const compareURLs = (a: string, b: string) => {
  try {
    return new URL(a).href === new URL(b).href
  } catch {
    return a === b
  }
}

export interface PDFViewerParams {
  path: string
  pathOverride?: string
  loading?: boolean
  error?: string
  page?: number
  filename?: string
}

export const parsePDFViewerParams = (url: string | URL): PDFViewerParams => {
  const searchParams =
    typeof url === 'string'
      ? new URLSearchParams(new URL(url).search)
      : new URLSearchParams(url.search)

  const params = Object.fromEntries(searchParams)

  if (!params.path) {
    throw new Error('missing required path parameter')
  }

  return {
    path: decodeURIComponent(params.path),
    pathOverride: params.pathOverride ? decodeURIComponent(params.pathOverride) : undefined,
    loading: params.loading === 'true',
    error: params.error ? decodeURIComponent(params.error) : undefined,
    page: params.page ? parseInt(params.page, 10) : undefined,
    filename: params.filename ? decodeURIComponent(params.filename) : undefined
  }
}

export const appendURLPath = (url: string, path: string) => {
  try {
    const urlObj = new URL(url)
    urlObj.pathname = urlObj.pathname.replace(/\/$/, '') + '/' + path.replace(/^\//, '')
    return urlObj.href
  } catch {
    return url
  }
}

/**
 * Try to parse a surf protocol URL and return the resourceId
 * Surf protocol URL format: surf://resource/<id>
 * @param rawUrl The URL to parse
 * @returns resourceId or null if the URL is not a surf protocol URL
 */
export const parseSurfProtocolURL = (rawUrl: URL | string) => {
  const url = typeof rawUrl === 'string' ? parseURL(rawUrl) : rawUrl
  if (!url) {
    return null
  }

  if (url.protocol === 'surf:') {
    const resourceId = url.pathname.replace('/', '')
    if (!resourceId) {
      return null
    }

    return resourceId
  }

  return null
}
