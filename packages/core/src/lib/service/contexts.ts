import { generateID, isDev, useLocalStorageStore, useLogScope } from '@horizon/utils'
import type { OasisService, OasisSpace } from './oasis'
import { derived, get, writable, type Readable, type Writable } from 'svelte/store'

export type ContextLinkRaw = {
  id: string
  source: string
  target: string
  used: number
  lastUsed: number
  createdAt: number
}

export type ContextLink = {
  id: string
  source: OasisSpace
  target: OasisSpace
  used: number
  lastUsed: number
  createdAt: number
}

/**
 * Service responsible for managing links between contexts and turning them into a navigable tree and UI.
 */
export class ContextService {
  static self: ContextService

  log: ReturnType<typeof useLogScope>
  oasis: OasisService

  private links: Writable<ContextLinkRaw[]>
  rankedSpaces: Readable<OasisSpace[]>

  constructor(oasis: OasisService) {
    this.log = useLogScope('ContextService')
    this.oasis = oasis
    this.links = useLocalStorageStore('space-context-links', [], true)

    this.log.debug('ContextService initialized', get(this.links))

    this.rankedSpaces = derived([this.links, this.oasis.spaces], ([$links, $spaces]) => {
      this.log.debug('Ranking spaces', $links, $spaces)
      return this.rankSpaces($links, $spaces, 10)
    })

    if (isDev) {
      // @ts-ignore
      window.oasis = this
    }
  }

  get spacesValue() {
    return get(this.oasis.spaces)
  }

  get linksValue() {
    return get(this.links)
  }

  populateLink(link: ContextLinkRaw) {
    const sourceSpace = this.spacesValue.find((space) => space.id === link.source)
    const targetSpace = this.spacesValue.find((space) => space.id === link.target)

    if (!sourceSpace || !targetSpace) {
      this.log.warn('Failed to populate link', link)
      return null
    }

    return {
      ...link,
      source: sourceSpace,
      target: targetSpace
    } as ContextLink
  }

  populateLinks(links: ContextLinkRaw[]) {
    return links.map((link) => this.populateLink(link)).filter(Boolean) as ContextLink[]
  }

  createLink(source: string, target: string) {
    const link: ContextLinkRaw = {
      id: generateID(),
      source,
      target,
      used: 0,
      lastUsed: 0,
      createdAt: Date.now()
    }

    this.links.update((links) => [...links, link])

    return this.populateLink(link)
  }

  trackLinkUse(linkOrSourceId: string, targetId?: string): void {
    this.links.update((links) =>
      links.map((link) => {
        if (targetId) {
          if (
            (link.source === linkOrSourceId && link.target === targetId) ||
            (link.source === targetId && link.target === linkOrSourceId)
          ) {
            return {
              ...link,
              used: link.used + 1,
              lastUsed: Date.now()
            }
          }
        } else {
          if (link.id === linkOrSourceId) {
            return {
              ...link,
              used: link.used + 1,
              lastUsed: Date.now()
            }
          }
        }

        return link
      })
    )
  }

  deleteLink(id: string): void {
    this.links.update((links) => links.filter((link) => link.id !== id))
  }

  listLinks(): ContextLink[] {
    return this.populateLinks(this.linksValue)
  }

  listLinksForSpace(spaceId: string): ContextLink[] {
    const links = this.linksValue.filter((link) => link.source === spaceId)

    return this.populateLinks(links)
  }

  listBackLinksForSpace(spaceId: string): ContextLink[] {
    const links = this.linksValue.filter((link) => link.target === spaceId)

    return this.populateLinks(links)
  }

  findPath(source: string, target: string): string[] | null {
    const links = this.linksValue
    const visited = new Set<string>()
    const queue: Array<{ node: string; path: string[] }> = [
      {
        node: source,
        path: [source]
      }
    ]

    while (queue.length > 0) {
      const { node, path } = queue.shift()!

      if (node === target) {
        return path
      }

      if (!visited.has(node)) {
        visited.add(node)

        const neighbors = links
          .filter((link) => link.source === node)
          .map((link) => ({
            node: link.target,
            path: [...path, link.target]
          }))

        queue.push(...neighbors)
      }
    }

    return null
  }

  getRecentLinks(limit: number = 5): ContextLink[] {
    const links = this.linksValue.sort((a, b) => b.lastUsed - a.lastUsed).slice(0, limit)

    return this.populateLinks(links)
  }

  getMostUsedLinks(limit: number = 5): ContextLink[] {
    const links = this.linksValue.sort((a, b) => b.used - a.used).slice(0, limit)

    return this.populateLinks(links)
  }

  /**
   * Returns the most relevant high level spaces based on the number of links to other spaces.
   *
   * Implements a version of the PageRank algorithm to rank spaces based on the number of links to other spaces
   * as well as the number of links pointing to it. Also takes into account the *quality* of the links (how often they are used).
   *
   */
  rankSpaces(links: ContextLinkRaw[], spaces: OasisSpace[], limit?: number): OasisSpace[] {
    const CONNECTIVITY_WEIGHT = 10
    const QUALITY_WEIGHT = 14

    const spaceMap = new Map<string, number>()
    const spaceQualityMap = new Map<string, number>()
    const totalUsage = links.reduce((acc, link) => acc + link.used, 0)

    for (const link of links) {
      spaceMap.set(link.source, (spaceMap.get(link.source) || 0) + 1)

      spaceQualityMap.set(link.source, (spaceQualityMap.get(link.source) || 0) + link.used)
      // spaceQualityMap.set(link.target, (spaceQualityMap.get(link.target) || 0) + link.used)
    }

    const filterdSpaces = spaces
      .filter((space) => spaceMap.has(space.id)) // Filter out spaces not used as a source
      .map((space) => {
        const numConnections = spaceMap.get(space.id) || 0
        const numUsed = spaceQualityMap.get(space.id) || 0

        const connectivityScore = numConnections * CONNECTIVITY_WEIGHT
        const qualityScore = (numUsed / (totalUsage || 1)) * QUALITY_WEIGHT

        return {
          name: space.dataValue.folderName,
          rank: connectivityScore + qualityScore,
          connectivityScore,
          qualityScore,
          numConnections,
          numUsed,
          totalUsage,
          space
        }
      })
      .sort((a, b) => b.rank - a.rank)
      .slice(0, limit || this.spacesValue.length)

    this.log.debug('Ranked spaces', filterdSpaces)
    return filterdSpaces.map((item) => item.space)
  }

  useSpaceLinks(
    spaceId: string,
    type: 'all' | 'back' | 'forward' = 'all',
    depth: number = 1
  ): Readable<ContextLink[]> {
    return derived(this.links, ($links) => {
      const seen = new Set<string>()
      const result: ContextLinkRaw[] = []

      // First get back links
      const getLinks = (currentSpace: string, currentDepth: number, isBackLink: boolean) => {
        if (currentDepth > depth) return

        const filtered = $links.filter((link) => {
          if (isBackLink) {
            return link.target === currentSpace
          } else if (type === 'all') {
            return link.source === currentSpace
          } else if (type === 'forward') {
            return link.source === currentSpace
          }
          return false
        })

        for (const link of filtered) {
          if (!seen.has(link.id)) {
            seen.add(link.id)
            result.push(link)

            if (isBackLink) {
              getLinks(link.source, currentDepth + 1, true)
            } else {
              getLinks(link.target, currentDepth + 1, false)
            }
          }
        }
      }

      // Get back links first
      if (type !== 'forward') {
        getLinks(spaceId, 1, true)
      }

      // Then get forward/other links
      if (type !== 'back') {
        getLinks(spaceId, 1, false)
      }

      const rankedSpaces = this.rankSpaces(this.linksValue, this.spacesValue)

      this.log.debug('ranked spaces', rankedSpaces)

      const links = this.populateLinks(result)

      this.log.debug('links', links)

      return links.sort((a, b) => {
        const aRank = rankedSpaces.findIndex((space) =>
          a.source.id === spaceId ? space.id === a.target.id : space.id === a.source.id
        )
        const bRank = rankedSpaces.findIndex((space) =>
          b.source.id === spaceId ? space.id === b.target.id : space.id === b.source.id
        )

        if (a.target.id === spaceId && b.target.id !== spaceId) {
          return -1
        } else if (a.target.id !== spaceId && b.target.id === spaceId) {
          return 1
        }

        return aRank - bRank
      })
    })
  }

  getRankedSpaces(limit?: number) {
    return this.rankSpaces(this.linksValue, this.spacesValue, limit)
  }

  static provide(oasis: OasisService): ContextService {
    if (!ContextService.self) {
      ContextService.self = new ContextService(oasis)
    }
    return ContextService.self
  }

  static use(): ContextService {
    return ContextService.self
  }
}

export const createContextService = (oasis: OasisService) => ContextService.provide(oasis)
export const useContextService = () => ContextService.use()
