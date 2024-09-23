import { isIP } from 'is-ip'

export const normalizeElectronUserAgent = (current: string): string => {
  return current
    .split(' ')
    .filter((part) => !part.startsWith('Surf/') && !part.startsWith('Electron/'))
    .join(' ')
}

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
  return raw.startsWith('localhost') || raw === '127.0.0.1'
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

// truncate the URL path and query params so the beggining and end of the URL are always visible, max length is 50. Make sure the full hostname is always visible
export const truncateURL = (url: string, maxLength = 75) => {
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

  if (fullPath.length <= maxLength) {
    if (protocol === 'https:') {
      return hostname + fullPath
    } else {
      return `http://${hostname}${fullPath}`
    }
  }

  const start = fullPath.slice(0, maxLength / 2)
  const end = fullPath.slice(-maxLength / 2)

  // if the URL is https, we don't need to show the protocol
  if (protocol === 'https:') {
    return `${hostname}${start}...${end}`
  } else {
    return `http://${hostname}${start}...${end}`
  }
}

export const isGoogleSignInUrl = (url: string) => {
  return (
    url?.startsWith('https://accounts.google.com/v3/signin') ||
    url?.startsWith('https://accounts.google.com/InteractiveLogin') ||
    url?.startsWith('https://accounts.google.com/AddSession')
  )
}

export const getHostname = (raw: string) => {
  try {
    const url = new URL(raw)
    return url.hostname
  } catch (error) {
    return null
  }
}
