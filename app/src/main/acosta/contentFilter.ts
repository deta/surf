import { app } from 'electron'
import { mkdir, readFile, writeFile, stat } from 'fs/promises'
import { join } from 'path'
import { useLogScope } from '@deta/utils'
import {
  CORE_FILTER_CATEGORIES,
  OPTIONAL_FILTER_CATEGORIES,
  FILTER_CATEGORY_LABELS,
  type BlockPageInfo,
  type BlockVerdict,
  type ContentCheckResponse,
  type ContentFilterSettings,
  type FilterCategory
} from '@deta/types'
import { getUserConfig } from '../config'
import { acostaApiRequest } from './api'
import { useAcostaFocusMode } from './focusMode'
import {
  NEVER_BLOCK_HOSTS,
  REMOTE_BLOCKLIST_SOURCES,
  SEED_BLOCKLISTS,
  parseHostsFile
} from './blocklists'

const log = useLogScope('AcostaContentFilter')

const BLOCKLIST_CACHE_DIR = 'acosta_blocklists'
const BLOCKLIST_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000 // refresh weekly
const AI_VERDICT_CACHE_LIMIT = 5000
const AI_CHECK_TIMEOUT_MS = 3000

// Served by the acosta:// protocol handler, which is registered on the web
// content partition (acosta-internal:// is chrome-session only).
export const BLOCK_PAGE_BASE_URL = 'acosta://core/Blocked/blocked.html'

export function buildBlockPageURL(info: BlockPageInfo): string {
  const params = new URLSearchParams({
    url: info.url,
    reason: info.reason,
    source: info.source,
    ...(info.category ? { category: info.category } : {})
  })
  return `${BLOCK_PAGE_BASE_URL}?${params.toString()}`
}

export class AcostaContentFilter {
  private static instance: AcostaContentFilter | null = null

  /** Hostname sets per category, built from seed lists then remote lists. */
  private categoryHosts = new Map<FilterCategory, Set<string>>()
  /** Cached AI verdicts keyed by origin+path. */
  private aiVerdicts = new Map<string, ContentCheckResponse>()
  private initialized = false

  static get(): AcostaContentFilter {
    if (!this.instance) this.instance = new AcostaContentFilter()
    return this.instance
  }

  async initialize(): Promise<void> {
    if (this.initialized) return
    this.initialized = true

    for (const [category, hosts] of Object.entries(SEED_BLOCKLISTS)) {
      this.categoryHosts.set(category as FilterCategory, new Set(hosts))
    }

    // Remote lists load in the background; seed lists protect in the meantime.
    this.loadRemoteBlocklists().catch((err) => log.error('Loading remote blocklists failed:', err))
  }

  private get settings(): ContentFilterSettings {
    return getUserConfig().settings.acosta.content_filter
  }

  private activeCategories(): FilterCategory[] {
    const optional = this.settings.enabled_optional_categories.filter(
      (category): category is (typeof OPTIONAL_FILTER_CATEGORIES)[number] =>
        (OPTIONAL_FILTER_CATEGORIES as readonly string[]).includes(category)
    )
    return [...CORE_FILTER_CATEGORIES, ...optional]
  }

  /**
   * Synchronous verdict from the local lists. Used on every request, so it
   * must stay cheap: host set lookups walking up the domain hierarchy.
   */
  checkUrlSync(url: string): BlockVerdict {
    let parsed: URL
    try {
      parsed = new URL(url)
    } catch {
      return { blocked: false }
    }

    if (!parsed.protocol.startsWith('http')) return { blocked: false }

    const host = parsed.hostname.toLowerCase()
    if (NEVER_BLOCK_HOSTS.has(host)) return { blocked: false }

    // Focus mode allowlist comes first: during a session everything outside
    // the allowlist is blocked, with a gentle task reminder.
    const focusVerdict = useAcostaFocusMode().checkUrl(host)
    if (focusVerdict.blocked) return focusVerdict

    const settings = this.settings
    if (matchesHostList(host, new Set(settings.custom_allowlist.map(normalizeHost)))) {
      return { blocked: false }
    }
    if (matchesHostList(host, new Set(settings.custom_blocklist.map(normalizeHost)))) {
      return {
        blocked: true,
        source: 'custom',
        reason: 'This site is on your custom block list.'
      }
    }

    for (const category of this.activeCategories()) {
      const hosts = this.categoryHosts.get(category)
      if (hosts && matchesHostList(host, hosts)) {
        return {
          blocked: true,
          source: 'blocklist',
          category,
          reason: `This site is categorised as “${FILTER_CATEGORY_LABELS[category]}”, which is filtered on Acosta Browse.`
        }
      }
    }

    // Cached AI verdicts also apply synchronously so repeat visits block instantly
    const cached = this.aiVerdicts.get(aiCacheKey(parsed))
    if (cached && !cached.safe) {
      return { blocked: true, source: 'ai', reason: cached.reason }
    }

    return { blocked: false }
  }

  /**
   * Full verdict including the api.acosta.ai/content-check screening.
   * Falls back to the blocklist verdict when the endpoint is unreachable.
   */
  async checkUrl(url: string): Promise<BlockVerdict> {
    const syncVerdict = this.checkUrlSync(url)
    if (syncVerdict.blocked) return syncVerdict

    if (!this.settings.ai_screening_enabled) return { blocked: false }

    let parsed: URL
    try {
      parsed = new URL(url)
    } catch {
      return { blocked: false }
    }
    if (!parsed.protocol.startsWith('http')) return { blocked: false }
    if (NEVER_BLOCK_HOSTS.has(parsed.hostname.toLowerCase())) return { blocked: false }

    const key = aiCacheKey(parsed)
    let verdict = this.aiVerdicts.get(key)

    if (!verdict) {
      const response = await acostaApiRequest<ContentCheckResponse>(
        'POST',
        '/content-check',
        { url },
        { timeoutMs: AI_CHECK_TIMEOUT_MS }
      )

      // Unreachable or erroring endpoint → fail open, rely on blocklists only
      if (!response.ok || !response.data || typeof response.data.safe !== 'boolean') {
        return { blocked: false }
      }

      verdict = response.data
      this.cacheAiVerdict(key, verdict)
    }

    if (!verdict.safe) {
      return {
        blocked: true,
        source: 'ai',
        reason: verdict.reason || 'Acosta AI flagged this page as unsuitable for studying.'
      }
    }
    return { blocked: false }
  }

  private cacheAiVerdict(key: string, verdict: ContentCheckResponse): void {
    if (this.aiVerdicts.size >= AI_VERDICT_CACHE_LIMIT) {
      // Drop the oldest entry (Map preserves insertion order)
      const oldest = this.aiVerdicts.keys().next().value
      if (oldest) this.aiVerdicts.delete(oldest)
    }
    this.aiVerdicts.set(key, verdict)
  }

  /* ------------------------------------------------------------------ */
  /* Remote blocklist loading                                            */
  /* ------------------------------------------------------------------ */

  private async loadRemoteBlocklists(): Promise<void> {
    const cacheDir = join(app.getPath('userData'), BLOCKLIST_CACHE_DIR)
    await mkdir(cacheDir, { recursive: true })

    await Promise.all(
      Object.entries(REMOTE_BLOCKLIST_SOURCES).map(async ([category, url]) => {
        const filterCategory = category as FilterCategory
        const cachePath = join(cacheDir, `${category}.hosts`)

        let contents: string | null = null

        const cacheIsFresh = await isFileFresh(cachePath, BLOCKLIST_MAX_AGE_MS)
        if (cacheIsFresh) {
          contents = await readFile(cachePath, 'utf8').catch(() => null)
        }

        if (!contents) {
          contents = await fetchBlocklist(url)
          if (contents) {
            await writeFile(cachePath, contents, 'utf8').catch((err) =>
              log.warn(`Caching ${category} blocklist failed:`, err)
            )
          } else {
            // Network failed — fall back to a stale cache if one exists
            contents = await readFile(cachePath, 'utf8').catch(() => null)
          }
        }

        if (!contents) {
          log.warn(`No remote blocklist available for ${category}; using seed list only`)
          return
        }

        const hosts = parseHostsFile(contents)
        for (const seed of SEED_BLOCKLISTS[filterCategory] ?? []) hosts.add(seed)
        this.categoryHosts.set(filterCategory, hosts)
        log.log(`Loaded ${hosts.size} hosts for category ${category}`)
      })
    )
  }
}

const normalizeHost = (host: string): string =>
  host
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\/.*$/, '')
    .replace(/^www\./, '')

/** True when the host or any of its parent domains is in the list. */
function matchesHostList(host: string, list: Set<string>): boolean {
  if (list.size === 0) return false
  let current = host.replace(/^www\./, '')
  while (current.includes('.')) {
    if (list.has(current)) return true
    current = current.slice(current.indexOf('.') + 1)
  }
  return false
}

const aiCacheKey = (url: URL): string => `${url.origin}${url.pathname}`

async function isFileFresh(path: string, maxAgeMs: number): Promise<boolean> {
  try {
    const stats = await stat(path)
    return Date.now() - stats.mtimeMs < maxAgeMs
  } catch {
    return false
  }
}

async function fetchBlocklist(url: string): Promise<string | null> {
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    return await res.text()
  } catch (err) {
    log.warn(`Fetching blocklist ${url} failed:`, err instanceof Error ? err.message : err)
    return null
  }
}

export const useAcostaContentFilter = (): AcostaContentFilter => AcostaContentFilter.get()
