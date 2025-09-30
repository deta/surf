import { get, writable, type Writable } from 'svelte/store'

import Fuse, { type FuseResult } from 'fuse.js'
import { SFFS } from './sffs'
import { type HistoryEntry } from '@deta/types'

export type SearchHistoryEntry = {
  site: string
  hostname: string
  visitCount: number
  entry: HistoryEntry
  score: number
  fuzzy: boolean
}

export class HistoryEntriesManager {
  entries: Writable<Map<string, HistoryEntry>>
  sffs: SFFS

  constructor() {
    this.entries = writable(new Map())
    this.sffs = new SFFS()
    this.init()
  }

  // TODO: load only required state, on demand
  async init() {
    const allEntries = await this.sffs.getHistoryEntries()
    const entriesMap = new Map(allEntries.map((entry) => [entry.id, entry]))
    this.entries.set(entriesMap)
  }

  get entriesStore() {
    return this.entries
  }

  get entriesValue() {
    return get(this.entries)
  }

  getEntry(id: string): HistoryEntry | undefined {
    const entries = get(this.entries)
    return entries.get(id)
  }

  async addEntry(entry: HistoryEntry, skipStore = false): Promise<HistoryEntry> {
    const newEntry = await this.sffs.createHistoryEntry(entry)
    if (skipStore) {
      return newEntry
    }

    this.entries.update((entries) => entries.set(newEntry.id, newEntry))
    return newEntry
  }

  async updateEntry(id: string, newData: Partial<HistoryEntry>) {
    let updatedEntry: HistoryEntry | undefined
    this.entries.update((entries) => {
      const entry = entries.get(id)
      if (entry) {
        updatedEntry = { ...entry, ...newData }
        entries.set(id, updatedEntry)
      }
      return entries
    })

    if (updatedEntry) {
      await this.sffs.updateHistoryEntry(updatedEntry)
    }
  }

  async removeEntry(id: string) {
    await this.sffs.deleteHistoryEntry(id)
    this.entries.update((entries) => {
      entries.delete(id)
      return entries
    })
  }

  extractHostname(url: string): string {
    try {
      // remove the common `www.` prefix
      return new URL(url).hostname.replace('www.', '')
    } catch (error) {
      return ''
    }
  }

  extractSite(value: string): string {
    try {
      const url = new URL(value)
      const hostname = url.hostname
      const site = hostname.split('.').slice(-2, -1).join('')

      return site
    } catch (error) {
      return ''
    }
  }

  extractPathname(url: string): string {
    try {
      return new URL(url).pathname
    } catch (error) {
      return ''
    }
  }

  extractTitle(value: string): string {
    try {
      const site = this.extractSite(value)

      return site.slice(0, 1).toUpperCase() + site.slice(1)
    } catch (error) {
      return ''
    }
  }

  normalizeTitle(title: string): string {
    const degoogled = title.replace('- Google Search', '')
    const normalized = degoogled.replace(/[-_]/g, ' ').replace(/\s+/g, ' ').trim()
    return normalized.toLowerCase()
  }

  private scoreEntry(entry: HistoryEntry, query: string): number {
    query = query.toLowerCase()

    const parts = query.split(' ')

    const scorePart = (queryPart: string) => {
      let score = 0
      if (entry.url) {
        const hostname = this.extractHostname(entry.url).toLowerCase()
        const pathname = this.extractPathname(entry.url).toLowerCase()

        let hostNameMatch = false
        if (hostname === queryPart) {
          score += 1.25
          hostNameMatch = true
        } else if (hostname.startsWith(queryPart)) {
          score += 1
          hostNameMatch = true
        } else if (hostname.includes(queryPart)) {
          score += 0.75
          hostNameMatch = true
        }

        // if the query is a single word, we give a bonus to homepages
        if (hostNameMatch && parts.length === 1 && pathname === '/') {
          score += 1
        }

        if (pathname.includes(queryPart)) {
          score += 0.25
        }
      }

      const normalizedTitle = this.normalizeTitle(entry.title ?? '')
      if (normalizedTitle === queryPart) {
        score += 1
      } else if (normalizedTitle.startsWith(queryPart)) {
        score += 0.75
      } else if (normalizedTitle.includes(queryPart)) {
        score += 0.5
      }

      if (entry.searchQuery && entry.searchQuery.toLowerCase().includes(queryPart)) {
        score += 0.25
      }

      return score
    }

    // score entire query
    let score = scorePart(query)

    if (parts.length > 1) {
      // score each part
      const partScores = parts.map((queryPart) => {
        return scorePart(queryPart)
      })

      let partsScore = partScores.reduce((a, b) => a + b, 0)

      // if any part has a score of 0, we penalize the entire query
      if (partScores.some((score) => score === 0)) {
        partsScore -= 0.5
      }

      // average the score of the entire query and the parts
      score += partsScore / parts.length
    }

    return score
  }

  searchEntries(query: string, threshold: number = 0.2) {
    const seen = new Set()
    const entries = Array.from(get(this.entries).values()).filter(
      (entry) => entry.url !== undefined
    )

    const urlCount = new Map<string, number>()
    for (const entry of entries) {
      if (entry.url) urlCount.set(entry.url, (urlCount.get(entry.url) || 0) + 1)
    }

    const exactResult = entries
      .map((entry) => ({
        entry,
        score: this.scoreEntry(entry, query),
        fuzzy: false
      }))
      .filter((item) => {
        return item.score > threshold
      })

    const fuzzyResult = this.searchEntriesFuse(entries, query, threshold)

    const combined = [...exactResult, ...fuzzyResult]

    const sorted = combined
      .map((item) => ({
        ...item,
        site: item.entry.url ? this.extractSite(item.entry.url) : '',
        hostname: item.entry.url ? this.extractHostname(item.entry.url) : '',
        visitCount: item.entry.url ? urlCount.get(item.entry.url) || 0 : 0
      }))
      .sort((a, b) => {
        const diff = b.score - a.score
        return diff === 0 ? b.visitCount - a.visitCount : diff
      })
      .filter((item) => {
        const dedupKey =
          `${item.entry.url}|${item.entry.title}|${item.entry.searchQuery}`.toLowerCase()
        if (seen.has(dedupKey)) {
          return false
        } else {
          seen.add(dedupKey)
          return true
        }
      })

    return sorted as SearchHistoryEntry[]
  }

  searchEntriesFuse(entries: HistoryEntry[], query: string, threshold: number = 0.3) {
    const seen = new Set()

    const options = {
      includeScore: true,
      keys: ['title', 'url', 'searchQuery'],
      isCaseSensitive: false,
      ignoreLocation: true,
      threshold
    }

    const fuse = new Fuse(entries, options)
    const fuzzyResults = fuse.search(query)

    const filteredEntries = fuzzyResults.filter((result: FuseResult<HistoryEntry>) => {
      const dedupKey =
        `${result.item.url}|${result.item.title}|${result.item.searchQuery}`.toLowerCase()
      if (seen.has(dedupKey)) {
        return false
      } else {
        seen.add(dedupKey)
        return true
      }
    })

    return filteredEntries.map((result) => ({
      entry: result.item,
      score: result.score || 0,
      fuzzy: true
    }))
  }
}
