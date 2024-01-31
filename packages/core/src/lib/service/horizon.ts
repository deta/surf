import { get, writable, type Readable, type Writable, derived } from 'svelte/store'
import type { Card, CardFile, CardPosition, Optional } from '../types'
import type { API } from './api'
import type { HorizonState, HorizonData } from '../types'
import { useLogScope, type ScopedLogger } from '../utils/log'
import { HorizonDatabase, LocalStorage } from './storage'

// how many horizons to keep in the dom
const HOT_HORIZONS_THRESHOLD = 5

export class Horizon {
  readonly id: string
  state: HorizonState
  inStateSince: number
  lastUsed: number
  data: HorizonData
  cards: Writable<Writable<Card>[]>
  signalChange: (horizon: Horizon) => void

  api: API
  log: ScopedLogger
  storage: HorizonDatabase

  constructor(id: string, data: HorizonData, api: API, signalChange: (horizon: Horizon) => void) {
    this.id = id
    this.api = api
    this.log = useLogScope(`Horizon ${id}`)
    this.storage = new HorizonDatabase()

    this.state = 'cold'
    this.inStateSince = Date.now()
    this.lastUsed = Date.now()

    this.data = data
    this.cards = writable([])
    this.signalChange = signalChange

    this.log.debug(`Created`)
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
  }

  async deleteCard(id: string) {
    const card = await this.getCard(id)
    if (!card) throw new Error(`Card ${id} not found`)

    this.cards.update((c) => c.filter((c) => get(c).id !== id))
    await this.storage.cards.delete(id)

    if (card.type === 'file') {
      this.log.debug(`Deleting card file resource ${(card as CardFile).data.resourceId}`)
      await this.storage.resources.delete((card as CardFile).data.resourceId)
    }

    this.log.debug(`Deleted card ${id}`)
    this.signalChange(this)
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
      data: data,
    })
  }

  getResource(id: string) {
    return this.storage.resources.read(id)
  }

  async addCard(data: Optional<Card, 'id' | 'stacking_order'>) {
    const card = await this.storage.cards.create({
      horizon_id: this.data.id,
      stacking_order: 1,
      hoisted: true,
      ...data
    })

    const cardStore = writable(card)
    this.cards.update((c) => [...c, cardStore])
    this.signalChange(this)
    return cardStore
  }

  addCardBrowser(location: string, position: CardPosition) {
    return this.addCard({
      ...position,
      type: 'browser',
      data: {
        initialLocation: location,
        historyStack: [] as string[],
        currentHistoryIndex: -1,
      }
    })
  }

  addCardText(content: string, position: CardPosition) {
    return this.addCard({
      ...position,
      type: 'text',
      data: {
        content: content
      }
    })
  }

  addCardLink(url: string, position: CardPosition) {
    return this.addCard({
      ...position,
      type: 'link',
      data: {
        url: url
      }
    })
  }

  async addCardFile(data: Blob, position: CardPosition) {
    const resource = await this.createResource(data)
    return this.addCard({
      ...position,
      type: 'file',
      data: {
        name: 'Untitled',
        mimetype: data.type,
        resourceId: resource.id,
      }
    })
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
  activeHorizonStorage: LocalStorage<string>

  constructor(api: API) {
    this.api = api
    this.log = useLogScope(`HorizonService`)
    this.storage = new HorizonDatabase()
    // TODO: replace this with something
    // that stores application state
    this.activeHorizonStorage = new LocalStorage<string>('active_horizon')

    this.activeHorizonId = writable(null)
    this.horizons = writable([])
    this.horizons.subscribe((h) => this.persistHorizons(h)) // TODO: probably better to persist manually than on every change

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
    await this.loadHorizons()

    const storedHorizonId = this.activeHorizonStorage.getRaw()
    this.log.debug(`Stored active horizon`, storedHorizonId)

    if (get(this.horizons).length === 0) {
      this.log.debug(`No horizons found, creating default`)
      const defaultHorizon = await this.createHorizon('Default', true)
      await this.switchHorizon(defaultHorizon)
    } else if (!storedHorizonId) {
      this.log.debug(`No active horizon found, switching to default`)
      const defaultHorizon = this.getDefaultHorizon()
      await this.switchHorizon(defaultHorizon.id)
    } else {
      await this.switchHorizon(storedHorizonId)
    }

    this.activeHorizonId.subscribe((id) => this.activeHorizonStorage.setRaw(id ?? ''))
  }

  handleHorizonChange(horizon: Horizon) {
    this.log.debug(`Horizon changed`, horizon)
    this.horizons.update((h) => {
      const index = h.findIndex((h) => h.id === horizon.id)
      if (index === -1) return h
      h[index] = horizon
      return h
    })
  }

  async loadHorizons() {
    const storedHorizons = (await this.storage.horizons.all()) ?? []
    this.log.debug(`Loading ${storedHorizons.length} stored horizons`)

    // const res = await this.api.getHorizons()
    // const { default: data } = await import('../data/horizons.json')

    const horizons = storedHorizons.map(
      (d) => new Horizon(d.id, d, this.api, (h) => this.handleHorizonChange(h))
    )

    this.horizons.set(horizons)
  }

  persistHorizons(horizons: Horizon[]) {
    if (horizons.length === 0) {
      this.log.debug(`No horizons, skipping persist`)
      return
    }
    this.log.debug(`Persisting ${horizons.length} horizons`)
    const horizonsData = horizons.map((h) => h.data)
    // this.storage.set(horizonsData)
    Promise.allSettled(
      horizonsData.map(async (h) => {
        this.storage.horizons.update(h.id, h)
      })
    )
  }

  getDefaultHorizon() {
    const horizon = get(this.horizons).find((h) => h.data.isDefault)
    if (!horizon) {
      throw new Error(`Default horizon not found`)
    }

    return horizon
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
  }

  async createHorizon(name: string, isDefault = false) {
    // const res = await this.api.createHorizon(name)
    let data = {
      name,
      viewOffsetX: 0,
      isDefault: isDefault
    } as HorizonData
    data = await this.storage.horizons.create(data)

    const horizon = new Horizon(data.id, data, this.api, (h) => this.handleHorizonChange(h))
    this.horizons.update((h) => [...h, horizon])

    return horizon
  }
}
