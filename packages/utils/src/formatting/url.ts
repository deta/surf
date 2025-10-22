import { isIP } from 'is-ip'
import { isWindows, isDev } from '../system/system'
import { ViewType } from '@deta/types'

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

export const stripTrailingSlash = (url: string): string =>
  url.endsWith('/') ? url.slice(0, -1) : url

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

export const optimisticCheckIfUrl = (url: string, base?: URL) => {
  try {
    const u = new URL(url, base?.origin)
    // NOTE: must have a hostname
    //  new URL('localhost:9000') doesn't throw an error but hostname is empty
    if (u.hostname) {
      return u
    }
  } catch {
    // NOTE: using http here to parse incomplete URLs like example.com
    // we default to using http as sites will usually redirect to https if supported
    // but we don't want to assume https
    try {
      const u = new URL(`http://${url}`, base?.origin)
      // at least one dot and valid TLD (2+ chars)
      if (/^[\w-]+\.[\w-]{2,}/.test(u.hostname)) {
        return u
      }
    } catch {
      return null
    }
  }
  return null
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
    const validURL = optimisticCheckIfUrl(raw, base)
    if (validURL) {
      return validURL
    }
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

export const checkIfLocalhost = (url: string | URL) => {
  try {
    const _url = url instanceof URL ? url : new URL(prependProtocol(url, false))
    return _url.hostname === 'localhost' || _url.hostname === '127.0.0.1'
  } catch (error) {
    return false
  }
}

export const checkIfIPAddress = (raw: string) => {
  return isIP(raw)
}

export const parseStringIntoBrowserLocation = (raw: string) => {
  const url = optimisticCheckIfUrl(raw)
  if (url) {
    return url.href
  }

  const isLocalhost = checkIfLocalhost(raw)
  if (isLocalhost) {
    return prependProtocol(raw, false)
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

export const isInternalViewerURL = (url: string, entryPoint: string) => {
  if (!url || !entryPoint) return false

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

export interface ResourceViewerParams {
  path: string
  resourceId?: string
}

export interface NotebookViewerParams {
  path: string
  notebookId?: string
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
 * Surf protocol URL format: surf://surf/resource/<id>
 * @deprecated This is no longer valid with having other surf paths not only resource
 * @param rawUrl The URL to parse
 * @returns resourceId or null if the URL is not a surf protocol URL
 */
export const parseSurfProtocolURL = (rawUrl: URL | string) => {
  const url = typeof rawUrl === 'string' ? parseURL(rawUrl) : rawUrl
  if (!url) {
    return null
  }

  if (url.protocol === 'surf:') {
    const resourceId = url.pathname.split('/')[2]
    if (!resourceId) {
      return null
    }

    return resourceId
  }

  return null
}

/**
 * Returns whether a given URL if it is part of the internal "renderer" i.e:
 *  in DEV: http://localhost:XXXX/...html
 *  in PROD: file:///Users/max/Programming/Deta/surf/app/dist/mac-arm64/Surf.app/Contents/Resources/app.asar/out/renderer/Notebook/notebook.html?path=surf%3A%2F%2Fnotebook%2Fb75c4bc4-fbf9-46a0-ab35-2eca431f38e4&notebookId=b75c4bc4-fbf9-46a0-ab35-2eca431f38e4
 *
 */
export function isInternalRendererURL(url: string | URL): URL | null {
  try {
    const _url = url instanceof URL ? url : new URL(url)
    if (_url.protocol === 'surf:') return _url

    const devPartialPaths = [
      '/Resource/resource.html',
      '/Overlay/overlay.html',
      '/PDF/pdf.html',
      '/Settings/settings.html',
      '/Setup/setup.html',
      '/Core/core.html'
    ]

    if (isDev && checkIfLocalhost(_url) && devPartialPaths.includes(_url.pathname)) {
      const rendererURL = new URL(
        _url.searchParams.get('path') ??
          (() => {
            throw new Error('Invalid renderer path!')
          })()
      )

      return rendererURL
    }

    const prodPartialPaths = ['/out/renderer/Resource/resource.html', '/out/renderer/PDF/pdf.html']

    // TODO: Improve prod path
    if (
      _url.protocol === 'file:' &&
      prodPartialPaths.some((partial) => _url.pathname.includes(partial))
    ) {
      const rendererURL = new URL(
        _url.searchParams.get('path') ??
          (() => {
            throw new Error('Invalid renderer path!')
          })()
      )

      return rendererURL
    }
    return null
  } catch {
    return null
  }
}

export const getViewTypeData = (url: string) => {
  const internalUrl = isInternalRendererURL(url)
  const canonicalUrl = parseUrlIntoCanonical(url)

  if (!internalUrl) return { type: ViewType.Page, id: canonicalUrl }

  if (internalUrl.pathname === '/notebook') {
    return { type: ViewType.NotebookHome, id: null }
  }

  if (internalUrl.pathname.startsWith('/notebook/')) {
    const notebookId = internalUrl.pathname.split('/')[2]
    return { type: ViewType.Notebook, id: notebookId }
  }

  if (internalUrl.pathname.startsWith('/resource/')) {
    const raw =
      internalUrl.searchParams.has('raw') && internalUrl.searchParams.get('raw') !== 'false'
    const resourceId = internalUrl.pathname.split('/')[2]
    return { type: ViewType.Resource, id: resourceId, raw }
  }

  return { type: ViewType.Internal, id: null }
}

export const getViewType = (url: string) => {
  return getViewTypeData(url).type
}

export const getCleanHostname = (url: string) => {
  try {
    const viewType = getViewType(url)
    if (viewType === ViewType.Resource) {
      return 'Resource'
    } else if (viewType === ViewType.Notebook) {
      return 'Notebook'
    } else if (viewType === ViewType.NotebookHome) {
      return 'Surf'
    } else {
      return getHostname(url) || url
    }
  } catch {
    return url
  }
}

export const cleanupPageTitle = (title: string) => {
  try {
    if (!title.startsWith('surf://')) {
      return title
    }

    const viewType = getViewType(title)
    if (viewType === ViewType.Resource) {
      return 'Resource'
    } else if (viewType === ViewType.Notebook) {
      return 'Notebook'
    } else if (viewType === ViewType.NotebookHome) {
      return 'Surf'
    } else {
      return title
    }
  } catch {
    return title
  }
}
