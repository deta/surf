import { session } from 'electron'
import { useLogScope } from '@deta/utils'
import { getWebRequestManager } from '../webRequestManager'

const log = useLogScope('AcostaSafeSearch')

/**
 * Safe-search enforcement for the web content session. Two mechanisms:
 *
 * 1. URL rewriting (onBeforeRequest redirect) to force the safe-search query
 *    parameter on Google, Bing and DuckDuckGo result pages.
 * 2. Request headers (onBeforeSendHeaders) for YouTube restricted mode and
 *    Google's SafeSearch enforcement header, which also cover embedded
 *    content and API-driven UIs where URL rewriting can't reach.
 *
 * This is a school product: enforcement is unconditional and has no UI toggle.
 */
export function enforceSafeSearch(partition: string): void {
  const targetSession = session.fromPartition(partition)
  const webRequestManager = getWebRequestManager()

  webRequestManager.addBeforeRequest(targetSession, (details, callback) => {
    if (details.resourceType !== 'mainFrame') return callback({})

    const rewritten = rewriteForSafeSearch(details.url)
    if (rewritten && rewritten !== details.url) {
      return callback({ redirectURL: rewritten })
    }
    callback({})
  })

  webRequestManager.addBeforeSendHeaders(targetSession, (details, callback) => {
    let host: string
    try {
      host = new URL(details.url).hostname.toLowerCase()
    } catch {
      return callback({})
    }

    const headers: Record<string, string> = {}

    if (host.endsWith('youtube.com') || host.endsWith('youtubekids.com')) {
      headers['YouTube-Restrict'] = 'Moderate'
    }
    if (host.endsWith('google.com') || host.endsWith('google.com.au')) {
      // Forces SafeSearch across Google web + image search regardless of account settings
      headers['Preference'] = 'SafeSearch=2'
    }
    if (host.endsWith('bing.com')) {
      headers['X-Search-Safesearch'] = 'Strict'
    }
    if (host.endsWith('duckduckgo.com')) {
      headers['X-DuckDuckGo-SafeSearch'] = 'Strict'
    }

    if (Object.keys(headers).length === 0) return callback({})
    callback({ requestHeaders: { ...details.requestHeaders, ...headers } })
  })

  log.log(`Safe search enforcement active on partition ${partition}`)
}

/** Returns a rewritten URL with safe search forced, or null when not applicable. */
export function rewriteForSafeSearch(rawUrl: string): string | null {
  let url: URL
  try {
    url = new URL(rawUrl)
  } catch {
    return null
  }

  const host = url.hostname.toLowerCase()

  // Google web/image/video search
  if (
    (host.endsWith('google.com') || host.endsWith('google.com.au')) &&
    url.pathname === '/search'
  ) {
    if (url.searchParams.get('safe') !== 'active') {
      url.searchParams.set('safe', 'active')
      return url.toString()
    }
    return null
  }

  // Bing
  if (host.endsWith('bing.com') && url.pathname.startsWith('/search')) {
    if (url.searchParams.get('adlt') !== 'strict') {
      url.searchParams.set('adlt', 'strict')
      return url.toString()
    }
    return null
  }

  // DuckDuckGo: kp=1 is strict safe search
  if (host === 'duckduckgo.com' && url.searchParams.has('q')) {
    if (url.searchParams.get('kp') !== '1') {
      url.searchParams.set('kp', '1')
      return url.toString()
    }
    return null
  }

  return null
}
