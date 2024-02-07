import { get, writable, type Readable, type Writable, derived } from 'svelte/store'
import type { Card, CardPosition, Optional } from '../types'
import type { API } from './api'
import type { HorizonState, HorizonData } from '../types'
import { useLogScope, type ScopedLogger } from '../utils/log'
import { initDemoHorizon } from '../utils/demoHorizon'
import { HorizonDatabase, LocalStorage } from './storage'
import { Telemetry, EventTypes } from "./telemetry";
import { moveToStackingTop, type IBoard } from '@horizon/tela'

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
  signalChange: (horizon: Horizon) => void
  board: IBoard<any, any> | null

  api: API
  log: ScopedLogger
  storage: HorizonDatabase
  telemetry: Telemetry

  constructor(id: string, data: HorizonData, api: API, telemetry: Telemetry, signalChange: (horizon: Horizon) => void) {
    this.id = id
    this.api = api
    this.telemetry = telemetry
    this.log = useLogScope(`Horizon ${id}`)
    this.storage = new HorizonDatabase()

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
      console.warn("[Horizon Service] setActiveCard called with board === undefined!")
      moveToStackingTop(this.stackingOrder, id)
      return
    }

    moveToStackingTop(get(this.board?.state).stackingOrder, id)
    this.signalChange(this)
  }

  setActiveCard(id: string | null) {
    if (id) {
      this.moveCardToStackingTop(id)
    }
    this.activeCardId.set(id)
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
    await this.telemetry.trackEvent(EventTypes.UpdateCard, this.telemetry.extractEventPropertiesFromCard(updates))
  }

  async deleteCard(idOrCard: string | Card) {
    const card = typeof idOrCard !== 'string' ? idOrCard : await this.getCard(idOrCard)
    if (!card) throw new Error(`Card ${idOrCard} not found`)

    this.cards.update((c) => c.filter((c) => get(c).id !== card.id))
    await this.storage.deleteCardWithResource(card)

    this.log.debug(`Deleted card ${card.id}`)
    this.signalChange(this)
    await this.telemetry.trackEvent(EventTypes.DeleteCard, { horizonId: this.id, cardId: card.id })
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

  async addCard(data: Optional<Card, 'id' | 'stacking_order'>, makeActive: boolean = false, duplicated: boolean = false) {
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
    await this.telemetry.trackEvent(EventTypes.AddCard, this.telemetry.extractEventPropertiesFromCard(card, duplicated))
    return cardStore
  }

  addCardBrowser(location: string, position: CardPosition, makeActive: boolean = false, duplicated: boolean = false) {
    return this.addCard({
      ...position,
      type: 'browser',
      data: {
        initialLocation: location,
        historyStack: [] as string[],
        currentHistoryIndex: -1
      }
    }, makeActive, duplicated)
  }

  addCardText(content: string, position: CardPosition, makeActive: boolean = false, duplicated: boolean = false) {
    return this.addCard({
      ...position,
      type: 'text',
      data: {
        content: content
      }
    }, makeActive, duplicated)
  }

  addCardLink(url: string, position: CardPosition, makeActive: boolean = false, duplicated: boolean = false) {
    return this.addCard({
      ...position,
      type: 'link',
      data: {
        url: url
      }
    }, makeActive, duplicated)
  }

  async addCardFile(data: Blob, position: CardPosition, makeActive: boolean = false, duplicated: boolean = false) {
    const resource = await this.createResource(data)
    return this.addCard({
      ...position,
      type: 'file',
      data: {
        name: 'Untitled',
        mimetype: data.type,
        resourceId: resource.id
      }
    }, makeActive, duplicated)
  }
  
  async duplicateCard(idOrCard: Card | string, position: CardPosition, makeActive: boolean = false) {
    const card = typeof idOrCard !== 'string' ? idOrCard : await this.getCard(idOrCard)
    if (!card) throw new Error(`Card ${idOrCard} not found`)

    return this.addCard({
      ...position,
      type: card.type,
      data: card.data
    }, makeActive, true)
  }

  async duplicateCardWithoutData(idOrCard: Card | string, position: CardPosition, makeActive: boolean = false) {
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
  activeHorizonStorage: LocalStorage<string>

  constructor(api: API, telemetryAPIKey: string) {
    this.api = api
    this.log = useLogScope(`HorizonService`)
    this.storage = new HorizonDatabase()
    this.telemetry = new Telemetry(telemetryAPIKey, this.storage)
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
      const newHorizon = await this.createHorizon('How to use Horizons')
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
  }

  async loadHorizons() {
    const storedHorizons = (await this.storage.horizons.all()) ?? []
    this.log.debug(`Loading ${storedHorizons.length} stored horizons`)

    // const res = await this.api.getHorizons()
    // const { default: data } = await import('../data/horizons.json')

    const horizons = storedHorizons.map(
      (d) => new Horizon(d.id, d, this.api, this.telemetry, (h) => this.handleHorizonChange(h))
    )

    this.horizons.set(horizons)

    return horizons
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
    await this.telemetry.trackActivateHorizonEvent(horizon.id)
  }

  async createHorizon(name: string) {
    // const res = await this.api.createHorizon(name)
    let data = {
      name,
      viewOffsetX: 0,
    } as HorizonData
    data = await this.storage.horizons.create(data)

    const horizon = new Horizon(data.id, data, this.api, this.telemetry, (h) => this.handleHorizonChange(h))
    this.horizons.update((h) => [...h, horizon])

    await this.telemetry.trackEvent(EventTypes.CreateHorizon, { "name": name, "id": horizon.id})
    return horizon
  }

  async deleteHorizon(idOrHorizon: string | Horizon) {
    const horizon = typeof idOrHorizon === 'string' ? this.getHorizon(idOrHorizon) : idOrHorizon

    this.log.debug(`Deleting horizon ${horizon.id}`)

    await this.storage.horizons.delete(horizon.id)
    await this.storage.deleteCardsByHorizonId(horizon.id)

    // TODO: delete resources

    this.horizons.update((h) => h.filter((h) => h.id !== horizon.id))
    await this.telemetry.trackEvent(EventTypes.DeleteHorizon, { "id": horizon.id})
  }
}
