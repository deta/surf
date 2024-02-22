import { get, writable, type Readable, type Writable, derived } from 'svelte/store'
import type { Card, CardPosition, HistoryEntry, Optional } from '../types/index'
import type { API } from './api'
import type { Resource, HorizonState, HorizonData } from '../types/index'
import { useLogScope, type ScopedLogger } from '../utils/log'
import { initDemoHorizon } from '../utils/demoHorizon'
import { HorizonDatabase, LocalStorage } from './storage'
import { Telemetry, EventTypes, type TelemetryConfig } from './telemetry'
import { moveToStackingTop, type IBoard, clamp, type IBoardSettings } from '@horizon/tela'
import { quintOut, expoOut } from 'svelte/easing'

import Fuse, { type FuseResult } from 'fuse.js'

// how many horizons to keep in the dom
const HOT_HORIZONS_THRESHOLD = 8

export class Horizon {
  readonly id: string
  state: HorizonState
  inStateSince: number
  lastUsed: number
  data: HorizonData
  cards: Writable<Writable<Card>[]>
  activeCardId: Writable<string | null>
  stackingOrder: Writable<string[]>
  adblockerState: Writable<boolean>
  signalChange: (horizon: Horizon) => void
  board: IBoard<any, any> | null
  telaSettings: Writable<IBoardSettings> | null
  previewImageObjectURL: string | undefined

  api: API
  log: ScopedLogger
  storage: HorizonDatabase
  telemetry: Telemetry
  historyEntriesManager: HistoryEntriesManager

  constructor(
    id: string,
    data: HorizonData,
    api: API,
    telemetry: Telemetry,
    historyEntriesManager: HistoryEntriesManager,
    adblockerState: Writable<boolean>,
    previewImageResource: Resource | undefined,
    signalChange: (horizon: Horizon) => void
  ) {
    this.id = id
    this.api = api
    this.log = useLogScope(`Horizon ${id}`)
    this.storage = new HorizonDatabase()
    this.telemetry = telemetry
    this.historyEntriesManager = historyEntriesManager

    this.state = 'cold'
    this.inStateSince = Date.now()
    this.lastUsed = Date.now()

    this.data = data
    this.cards = writable([])
    this.activeCardId = writable(null)
    data.stackingOrder = data.stackingOrder || []
    this.stackingOrder = writable(data.stackingOrder)
    this.signalChange = signalChange
    this.board = null
    this.telaSettings = null

    this.adblockerState = adblockerState
    if (previewImageResource) {
      this.previewImageObjectURL = URL.createObjectURL(previewImageResource.blob)
    }

    this.log.debug(`Created`)
  }

  attachBoard(board: IBoard<any, any>) {
    this.log.debug(`Attaching board`)
    this.board = board
  }

  detachBoard() {
    this.log.debug(`Detaching board`)
    this.board = null
  }

  attachSettings(settings: Writable<IBoardSettings>) {
    this.log.debug(`Attaching settings`)
    this.telaSettings = settings
  }

  detachSettings() {
    this.log.debug(`Detaching settings`)
    this.telaSettings = null
  }

  getState() {
    return this.state
  }

  changeState(state: HorizonState) {
    this.log.debug(`Changing state to ${state}`)
    this.state = state
    this.inStateSince = Date.now()
    this.signalChange(this)
  }

  markAsUsed() {
    this.log.debug(`Marking as used`)
    this.lastUsed = Date.now()
  }

  async refreshData() {
    // this.api.getHorizon(this.id)
  }

  async loadCards() {
    this.log.debug(`Loading cards`)

    // load cards from storage and persist any future changes
    // const storedCards = await this.storage.cards.all() ?? []
    const storedCards = (await this.storage.getCardsByHorizonId(this.data.id)) ?? []
    this.cards.set(storedCards.map((c) => writable(c)))
    this.signalChange(this)
  }

  // async storeCards() {
  //   const cards = get(this.cards)
  //   this.log.debug(`Persisting ${cards.length} cards`)
  //   this.storage.set(cards.map((c) => get(c)))
  // }

  async updateData(updates: Partial<HorizonData>) {
    this.data = { ...this.data, ...updates }
    this.signalChange(this)
    return this.data
  }

  async getCard(id: string) {
    const localCard = get(this.cards).find((c) => get(c).id === id)
    if (localCard) return get(localCard)

    // TODO: maybe check storage as fallback?
    return null
  }

  moveCardToStackingTop(id: string) {
    if (!this.board) {
      console.warn('[Horizon Service] setActiveCard called with board === undefined!')
      moveToStackingTop(this.stackingOrder, id)
      return
    }

    moveToStackingTop(get(this.board?.state).stackingOrder, id)
    this.signalChange(this)
  }

  setActiveCard(id: string | null) {
    if (get(this.activeCardId) === id) return
    if (id) {
      this.moveCardToStackingTop(id)
    }
    this.activeCardId.set(id)
  }

  async setPreviewImage(newPreviewImage: Blob) {
    if (this.data.previewImage) {
      this.storage.resources.update(this.data.previewImage, { blob: newPreviewImage })
    } else {
      const resource = await this.storage.resources.create({ blob: newPreviewImage })
      this.data.previewImage = resource.id
      this.signalChange(this)
    }

    if (this.previewImageObjectURL) URL.revokeObjectURL(this.previewImageObjectURL)
    this.previewImageObjectURL = URL.createObjectURL(newPreviewImage)
  }

  async updateCard(id: string, updates: Partial<Card>) {
    const card = await this.getCard(id)
    if (!card) throw new Error(`Card ${id} not found`)

    this.cards.update((c) => {
      const card = c.find((c) => get(c).id === id)
      if (!card) return c
      card.update((c) => ({ ...c, ...updates }))
      return c
    })
    await this.storage.cards.update(id, updates)
    this.log.debug(`Updated card ${id}`)
    this.signalChange(this)
    await this.telemetry.trackEvent(
      EventTypes.UpdateCard,
      this.telemetry.extractEventPropertiesFromCard(updates)
    )
  }

  async deleteCard(idOrCard: string | Card) {
    const card = typeof idOrCard !== 'string' ? idOrCard : await this.getCard(idOrCard)
    if (!card) throw new Error(`Card ${idOrCard} not found`)

    this.cards.update((c) => c.filter((c) => get(c).id !== card.id))
    await this.storage.deleteCardWithResource(card)

    this.log.debug(`Deleted card ${card.id}`)
    this.signalChange(this)
    await this.telemetry.trackEvent(EventTypes.DeleteCard, { horizonId: this.id, id: card.id })
  }

  async freeze() {
    this.log.debug(`Freezing`)
    this.cards.set([])
    this.changeState('cold')
  }

  async coolDown() {
    this.log.debug(`Cooling down`)
    this.changeState('warm')
  }

  async warmUp() {
    this.log.debug(`Warming up`)
    // TODO: rely on cache to only fetch cards that are not already in memory
    await this.loadCards()

    this.changeState('warm')
  }

  createResource(data: Blob) {
    return this.storage.resources.create({
      data: data
    })
  }

  getResource(id: string) {
    return this.storage.resources.read(id)
  }

  async addCard(
    data: Optional<Card, 'id' | 'stacking_order'>,
    makeActive: boolean = false,
    duplicated: boolean = false
  ) {
    const card = await this.storage.cards.create({
      horizon_id: this.data.id,
      //stacking_order: 1,
      hoisted: true,
      ...data
    })

    const cardStore = writable(card)
    this.cards.update((c) => [...c, cardStore])

    if (makeActive) {
      this.log.debug(`Making card ${card.id} active`)
      this.setActiveCard(card.id)
    } else {
      this.moveCardToStackingTop(card.id)
    }

    this.signalChange(this)
    await this.telemetry.trackEvent(
      EventTypes.AddCard,
      this.telemetry.extractEventPropertiesFromCard(card, duplicated)
    )
    return cardStore
  }

  addCardBrowser(
    location: string,
    position: CardPosition,
    makeActive: boolean = false,
    duplicated: boolean = false
  ) {
    return this.addCard(
      {
        ...position,
        type: 'browser',
        data: {
          initialLocation: location,
          historyStackIds: [] as string[],
          currentHistoryIndex: -1
        }
      },
      makeActive,
      duplicated
    )
  }

  addCardText(
    content: string,
    position: CardPosition,
    makeActive: boolean = false,
    duplicated: boolean = false
  ) {
    return this.addCard(
      {
        ...position,
        type: 'text',
        data: {
          content: content
        }
      },
      makeActive,
      duplicated
    )
  }

  addCardLink(
    url: string,
    position: CardPosition,
    makeActive: boolean = false,
    duplicated: boolean = false
  ) {
    return this.addCard(
      {
        ...position,
        type: 'link',
        data: {
          url: url
        }
      },
      makeActive,
      duplicated
    )
  }

  async addCardFile(
    data: Blob,
    position: CardPosition,
    makeActive: boolean = false,
    duplicated: boolean = false
  ) {
    const resource = await this.createResource(data)
    return this.addCard(
      {
        ...position,
        type: 'file',
        data: {
          name: 'Untitled',
          mimetype: data.type,
          resourceId: resource.id
        }
      },
      makeActive,
      duplicated
    )
  }

  async duplicateCard(
    idOrCard: Card | string,
    position: CardPosition,
    makeActive: boolean = false
  ) {
    const card = typeof idOrCard !== 'string' ? idOrCard : await this.getCard(idOrCard)
    if (!card) throw new Error(`Card ${idOrCard} not found`)

    return this.addCard(
      {
        ...position,
        type: card.type,
        data: card.data
      },
      makeActive,
      true
    )
  }

  async duplicateCardWithoutData(
    idOrCard: Card | string,
    position: CardPosition,
    makeActive: boolean = false
  ) {
    const card = typeof idOrCard !== 'string' ? idOrCard : await this.getCard(idOrCard)
    if (!card) throw new Error(`Card ${idOrCard} not found`)

    if (card.type === 'text') {
      return this.addCardText('', position, makeActive, true)
    } else if (card.type === 'browser') {
      return this.addCardBrowser('', position, makeActive, true)
    } else if (card.type === 'link') {
      return this.addCardLink('', position, makeActive, true)
    } else if (card.type === 'file') {
      return this.addCardFile(new Blob(), position, makeActive, true)
    } else {
      throw new Error(`Unknown card type ${card.type}`)
    }
  }

  async scrollToCard(idOrCard: Card | string) {
    const board = this.board
    if (!board) {
      this.log.warn('scrollToCard called with missing board')
      return
    }

    const card = typeof idOrCard !== 'string' ? idOrCard : await this.getCard(idOrCard)
    if (!card) throw new Error(`Card ${idOrCard} not found`)

    this.log.debug(`Scrolling board to card ${card.id}`)

    const settings = this.telaSettings ? get(this.telaSettings) : null
    const state = get(board.state)
    const viewportWidth = get(state.viewPort).w

    const cardRightEdge = card.x + card.width
    const newOffsetX = cardRightEdge - viewportWidth + 100

    const clampedOffsetX = clamp(newOffsetX, 0, settings?.BOUNDS?.maxX ?? 1000)

    state.viewOffset.update(
      (viewOffset) => ({
        x: clampedOffsetX,
        y: viewOffset.y
      }),
      { duration: 100, easing: quintOut }
    )
  }

  async scrollToCardCenter(idOrCard: Card | string) {
    const board = this.board
    if (!board) {
      this.log.warn('scrollToCardCenter called with missing board')
      return
    }

    const card = typeof idOrCard !== 'string' ? idOrCard : await this.getCard(idOrCard)
    if (!card) throw new Error(`Card ${idOrCard} not found`)

    this.log.debug(`Centering board to card ${card.id}`)

    const settings = this.telaSettings ? get(this.telaSettings) : null
    const state = get(board.state)
    const viewportWidth = get(state.viewPort).w

    // Calculate the horizontal center of the card
    const cardCenter = card.x + card.width / 2

    // Calculate the new offsetX to center the card in the viewport
    // The idea is to subtract half of the viewport width from the card's center position
    const newOffsetX = cardCenter - viewportWidth / 2

    // Clamp the newOffsetX to ensure it's within the bounds (if specified in settings)
    const clampedOffsetX = clamp(newOffsetX, 0, settings?.BOUNDS?.maxX ?? 1000)

    // Update the viewOffset to center the card
    state.viewOffset.update(
      (viewOffset) => ({
        x: clampedOffsetX,
        y: viewOffset.y
      }),
      { duration: 640, easing: expoOut }
    )
  }
}

export class HistoryEntriesManager {
  entries: Writable<Map<string, HistoryEntry>>
  db: HorizonDatabase

  constructor() {
    this.entries = writable(new Map())
    this.db = new HorizonDatabase()
    this.init()
  }

  // TODO: load only required state, on demand
  async init() {
    const allEntries = await this.db.historyEntries.all()
    const entriesMap = new Map(allEntries.map((entry) => [entry.id, entry]))
    this.entries.set(entriesMap)
  }

  get entriesStore() {
    return this.entries
  }

  getEntry(id: string): HistoryEntry | undefined {
    let entry
    this.entries.subscribe((entries) => (entry = entries.get(id)))()
    return entry
  }

  async addEntry(entry: HistoryEntry): Promise<HistoryEntry> {
    const newEntry = await this.db.historyEntries.create(entry)
    this.entries.update((entries) => entries.set(newEntry.id, newEntry))
    return newEntry
  }

  async updateEntry(id: string, newData: Partial<HistoryEntry>) {
    await this.db.historyEntries.update(id, newData)
    this.entries.update((entries) => {
      const entry = entries.get(id)
      if (entry) {
        entries.set(id, { ...entry, ...newData })
      }
      return entries
    })
  }

  async removeEntry(id: string) {
    await this.db.historyEntries.delete(id)
    this.entries.update((entries) => {
      entries.delete(id)
      return entries
    })
  }

  // extractHostname(url: string): string {
  //   try {
  //     // remove the common `www.` prefix
  //     return new URL(url).hostname.replace('www.', '')
  //   } catch (error) {
  //     return ''
  //   }
  // }

  // private scoreEntry(entry: HistoryEntry, query: string): number {
  //   query = query.toLowerCase()
  //   let score = 0

  //   if (entry.url) {
  //     const hostname = this.extractHostname(entry.url).toLowerCase()
  //     if (hostname.includes(query)) {
  //       score += hostname.startsWith(query) ? 1 : 0.75
  //     }
  //   }
  //   if (entry.title && entry.title.toLowerCase().includes(query)) {
  //     score += 0.5
  //   }
  //   if (entry.searchQuery && entry.searchQuery.toLowerCase().includes(query)) {
  //     score += 0.5
  //   }

  //   return score / 2
  // }

  // searchEntries(query: string, threshold: number = 0.2): HistoryEntry[] {
  //   const seen = new Set()
  //   const entries = Array.from(get(this.entries).values())

  //   const urlCount = new Map<string, number>()
  //   for (const entry of entries) {
  //     if (entry.url) urlCount.set(entry.url, (urlCount.get(entry.url) || 0) + 1)
  //   }

  //   const result = Array.from(get(this.entries).values())
  //     .map((entry) => ({
  //       entry,
  //       score: this.scoreEntry(entry, query),
  //       visitCount: entry.url ? urlCount.get(entry.url) || 0 : 0
  //     }))
  //     .filter((item) => {
  //       return item.score > threshold
  //     })
  //     .sort((a, b) => {
  //       const diff = b.score - a.score
  //       return diff === 0 ? b.visitCount - a.visitCount : diff
  //     })
  //     .map((item) => item.entry)
  //     .filter((entry) => {
  //       const dedupKey = `${entry.url}|${entry.title}|${entry.searchQuery}`.toLowerCase()
  //       if (seen.has(dedupKey)) {
  //         return false
  //       } else {
  //         seen.add(dedupKey)
  //         return true
  //       }
  //     })

  //   return result
  // }

  searchEntries(query: string, threshold: number = 0.3): HistoryEntry[] {
    const seen = new Set()
    const entries = Array.from(get(this.entries).values())

    const urlCount = new Map<string, number>()
    for (const entry of entries) {
      if (entry.url) urlCount.set(entry.url, (urlCount.get(entry.url) || 0) + 1)
    }

    const options = {
      includeScore: true,
      keys: ['url', 'title', 'searchQuery'],
      isCaseSensitive: false,
      threshold
    }

    const fuse = new Fuse(entries, options)
    const fuzzyResults = fuse.search(query)

    const filteredEntries = fuzzyResults
      .filter((result: FuseResult<HistoryEntry>) => {
        const dedupKey =
          `${result.item.url}|${result.item.title}|${result.item.searchQuery}`.toLowerCase()
        if (seen.has(dedupKey)) {
          return false
        } else {
          seen.add(dedupKey)
          return true
        }
      })
      .sort((a, b) => {
        const diff = (b.score ?? 0) - (a.score ?? 0)
        const aCnt = a.item.url ? urlCount.get(a.item.url) || 0 : 0
        const bCnt = b.item.url ? urlCount.get(b.item.url) || 0 : 0
        return diff === 0 ? bCnt - aCnt : diff
      })
      .map((result) => result.item)

    return filteredEntries
  }
}

export class HorizonsManager {
  activeHorizonId: Writable<string | null>
  horizons: Writable<Horizon[]>

  activeHorizon: Readable<Horizon | null>
  hotHorizons: Readable<Horizon[]>
  coldHorizons: Readable<Horizon[]>
  sortedHorizons: Readable<string[]>

  hotHorizonsThreshold: number

  api: API
  log: ScopedLogger
  storage: HorizonDatabase
  telemetry: Telemetry
  historyEntriesManager: HistoryEntriesManager
  activeHorizonStorage: LocalStorage<string>
  adblockerState: Writable<boolean>
  adblockerStateStorage: LocalStorage<boolean>

  constructor(api: API, telemetryConfig: TelemetryConfig) {
    this.api = api
    this.log = useLogScope(`HorizonService`)
    this.storage = new HorizonDatabase()
    this.telemetry = new Telemetry(this.storage, telemetryConfig)
    this.adblockerState = writable(true)

    this.historyEntriesManager = new HistoryEntriesManager()

    // TODO: replace this with something
    // that stores application state
    this.activeHorizonStorage = new LocalStorage<string>('active_horizon')
    this.adblockerStateStorage = new LocalStorage<boolean>('adblocker_state')

    this.adblockerState.set(this.adblockerStateStorage.get() ?? true)
    // @ts-ignore
    window.api.setAdblockerState('persist:horizon', get(this.adblockerState))

    this.activeHorizonId = writable(null)
    this.horizons = writable([])

    this.hotHorizonsThreshold = HOT_HORIZONS_THRESHOLD

    this.hotHorizons = derived([this.horizons], ([horizons]) => {
      return horizons.filter((h) => {
        return h?.state === 'hot'
      })
      // .sort((a, b) => {
      //     const aState = horizonStates.get(a.id)
      //     const bState = horizonStates.get(b.id)
      //     if (!aState || !bState) return 0
      //     return bState.since.getTime() - aState.since.getTime()
      // })
    })

    this.coldHorizons = derived([this.horizons], ([horizons]) => {
      return horizons.filter((h) => {
        return h?.state !== 'hot'
      })
    })

    this.sortedHorizons = derived([this.horizons], ([horizons]) => {
      return [...horizons]
        .sort((a, b) => {
          const aState = a
          const bState = b
          if (!aState || !bState) return 0
          return bState.inStateSince - aState.inStateSince
        })
        .map((h) => h.id)
    })

    this.activeHorizon = derived(
      [this.horizons, this.activeHorizonId],
      ([horizons, activeHorizonId]) => {
        if (!activeHorizonId) return null
        const horizon = horizons.find((h) => h.id === activeHorizonId) ?? null
        if (horizon?.state === 'cold') {
          this.log.warn(`Active horizon ${activeHorizonId} is cold`)
        }
        return horizon
      }
    )
  }

  async init() {
    this.log.debug(`Initializing`)
    await this.telemetry.init()
    const horizons = await this.loadHorizons()

    let storedHorizonId = this.activeHorizonStorage.getRaw()
    this.log.debug(`Stored active horizon`, storedHorizonId)

    const storedActiveHorizon = horizons.find((h) => h.id === storedHorizonId)
    if (!storedActiveHorizon) {
      this.log.warn(`Stored active horizon not found`)
      storedHorizonId = null
    }

    let switchedTo = null
    if (horizons.length === 0) {
      this.log.debug(`No horizons found, creating new one`)
      const newHorizon = await this.createHorizon('Welcome to Horizon 🌻')
      initDemoHorizon(newHorizon)
      await this.createHorizon('Horizon 1')
      await this.switchHorizon(newHorizon)
      switchedTo = newHorizon.id
    } else if (!storedHorizonId) {
      this.log.debug(`No active horizon found, using first one`)
      const newHorizon = horizons[0]
      await this.switchHorizon(newHorizon.id)
      switchedTo = newHorizon.id
    } else {
      await this.switchHorizon(storedHorizonId)
      switchedTo = storedHorizonId
    }

    this.activeHorizonId.subscribe((id) => this.activeHorizonStorage.setRaw(id ?? ''))
    this.adblockerState.subscribe((state) => {
      // @ts-ignore
      window.api.setAdblockerState('persist:horizon', state)
      this.adblockerStateStorage.set(state)
    })

    return switchedTo
  }

  handleHorizonChange(horizon: Horizon) {
    this.log.debug(`Horizon changed`, horizon)
    this.horizons.update((h) => {
      const index = h.findIndex((h) => h.id === horizon.id)
      if (index === -1) return h
      h[index] = horizon
      return h
    })
    this.persistHorizon(horizon)
  }

  async loadHorizons() {
    const storedHorizons = (await this.storage.horizons.all()) ?? []
    this.log.debug(`Loading ${storedHorizons.length} stored horizons`)

    const horizons = await Promise.all(
      storedHorizons.map(async (data) => {
        let previewImageResource: Resource | undefined
        if (data.previewImage) {
          try {
            previewImageResource = await this.storage.resources.read(data.previewImage)
          } catch {}
        }

        return new Horizon(
          data.id,
          data,
          this.api,
          this.telemetry,
          this.historyEntriesManager,
          this.adblockerState,
          previewImageResource,
          this.handleHorizonChange.bind(this)
        )
      })
    )

    this.horizons.set(horizons)
    return horizons
  }

  persistHorizon(horizon: Horizon) {
    this.log.debug(`Persisting Horizon ${horizon.id}`)
    this.storage.horizons.update(horizon.id, horizon.data)
  }

  getHorizon(id: string) {
    const horizon = get(this.horizons).find((h) => h.id === id)
    if (!horizon) {
      throw new Error(`Horizon ${id} not found`)
    }

    return horizon
  }

  async warmUpHorizon(idOrHorizon: string | Horizon) {
    const horizon = typeof idOrHorizon === 'string' ? this.getHorizon(idOrHorizon) : idOrHorizon
    await horizon.warmUp()
  }

  async coolDownHorizon(idOrHorizon: string | Horizon) {
    const horizon = typeof idOrHorizon === 'string' ? this.getHorizon(idOrHorizon) : idOrHorizon
    await horizon.coolDown()
  }

  async switchHorizon(idOrHorizon: string | Horizon) {
    const horizon = typeof idOrHorizon === 'string' ? this.getHorizon(idOrHorizon) : idOrHorizon

    const oldHorizonState = horizon.state ?? 'cold'

    if (oldHorizonState === 'cold') {
      await horizon.warmUp()
    }

    horizon.changeState('hot')

    // only if the horizon was not already hot
    if (oldHorizonState !== 'hot') {
      // cool down other older hot horizons
      if (get(this.hotHorizons).length > this.hotHorizonsThreshold) {
        this.log.debug(`Cooling down older hot horizons`)
        const hotHorizons = get(this.horizons)
          .filter((horizon) => horizon.state === 'hot')
          .sort((a, b) => a.inStateSince - b.inStateSince) // oldest first

        this.log.debug(`Found ${hotHorizons.length} hot horizons`)
        while (hotHorizons.length > this.hotHorizonsThreshold) {
          const horizon = hotHorizons.shift()
          if (!horizon) break
          await this.coolDownHorizon(horizon.id)
        }
      }
    }

    this.log.debug(`Making horizon ${horizon.id} active`)
    horizon.markAsUsed()

    this.activeHorizonId.set(horizon.id)
    const cards = get(horizon.cards).map((c) => get(c)) || []
    await this.telemetry.trackActivateHorizonEvent(horizon.id, cards)
  }

  async createHorizon(name: string) {
    // const res = await this.api.createHorizon(name)
    let data = {
      name,
      viewOffsetX: 0
    } as HorizonData
    data = await this.storage.horizons.create(data)

    const horizon = new Horizon(
      data.id,
      data,
      this.api,
      this.telemetry,
      this.historyEntriesManager,
      this.adblockerState,
      undefined,
      (h) => this.handleHorizonChange(h)
    )
    this.horizons.update((h) => [...h, horizon])

    await this.telemetry.trackEvent(EventTypes.CreateHorizon, { name: name, id: horizon.id })
    return horizon
  }

  async deleteHorizon(idOrHorizon: string | Horizon) {
    const horizon = typeof idOrHorizon === 'string' ? this.getHorizon(idOrHorizon) : idOrHorizon

    this.log.debug(`Deleting horizon ${horizon.id}`)

    await this.storage.horizons.delete(horizon.id)
    await this.storage.deleteCardsByHorizonId(horizon.id)

    // TODO: delete resources

    this.horizons.update((h) => h.filter((h) => h.id !== horizon.id))
    await this.telemetry.trackEvent(EventTypes.DeleteHorizon, { id: horizon.id })
  }
}
