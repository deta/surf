import { get, writable, type Readable, type Writable, derived } from 'svelte/store'
import {
  type Card,
  type CardPosition,
  type Optional,
  type SFFSResourceMetadata,
  type SFFSResourceTag
} from '../types/index'
import type { API } from './api'
import type { LegacyResource, HorizonState, HorizonData } from '../types/index'
import { useLogScope, type ScopedLogger } from '../utils/log'
import { initDemoHorizon } from '../utils/demoHorizon'
import { HorizonDatabase, LocalStorage } from './storage'
import { Telemetry, EventTypes, type TelemetryConfig } from './telemetry'
import { moveToStackingTop, type IBoard, clamp, type IBoardSettings } from '@horizon/tela'
import { quintOut, expoOut } from 'svelte/easing'

import { HistoryEntriesManager } from './history'
import type { ResourceManager } from './resources'
import { SFFS } from './sffs'

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
  sffs: SFFS
  telemetry: Telemetry
  historyEntriesManager: HistoryEntriesManager
  resourceManager: ResourceManager

  constructor(
    id: string,
    data: HorizonData,
    api: API,
    telemetry: Telemetry,
    resourceManager: ResourceManager,
    historyEntriesManager: HistoryEntriesManager,
    adblockerState: Writable<boolean>,
    previewImageResource: LegacyResource | undefined,
    signalChange: (horizon: Horizon) => void
  ) {
    this.id = id
    this.api = api
    this.log = useLogScope(`Horizon ${id}`)
    this.sffs = new SFFS() // TODO: maybe share this with the horizon manager
    this.storage = new HorizonDatabase()
    this.telemetry = telemetry
    this.historyEntriesManager = historyEntriesManager
    this.resourceManager = resourceManager

    this.state = 'cold'
    this.inStateSince = Date.now()
    this.lastUsed = Date.now()

    this.data = data
    this.cards = writable([])
    this.activeCardId = writable(null)
    this.stackingOrder = writable([])
    this.signalChange = signalChange
    this.board = null
    this.telaSettings = null

    this.stackingOrder.subscribe((stack) => {
      const cards = get(this.cards)
      cards.forEach((c) => {
        const card = get(c)

        let idx = stack.indexOf(card.id)
        c.update((card) => {
          card.stackingOrder = idx
          return card
        })
      })
    })

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
    const storedCards = (await this.sffs.getCardsForHorizon(this.data.id)) ?? []
    this.cards.set(storedCards.map((c) => writable(c)))

    this.log.debug(`Loaded cards`, storedCards)

    const stack = [...storedCards]
      .sort((a, b) => {
        return a.stackingOrder - b.stackingOrder
      })
      .map((e) => e.id)
    this.stackingOrder.set(stack)

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

  // TODO: this needs to update the cards itself
  moveCardToStackingTop(id: string) {
    if (!this.board) {
      console.warn('[Horizon Service] setActiveCard called with board === undefined!')
      // moveToStackingTop(this.stackingOrder, id)
      return
    }

    moveToStackingTop(this.stackingOrder, id)

    this.sffs.setCardStackingOrderTop(id)

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

  // TODO: This needs to be reworked, we shouldn't have to fetch the card from sffs first
  async updateCard(id: string, updates: Partial<Card>) {
    const card = await this.getCard(id)
    if (!card) throw new Error(`Card ${id} not found`)

    this.cards.update((c) => {
      const card = c.find((c) => get(c).id === id)
      if (!card) return c
      card.update((c) => ({ ...c, ...updates }))
      return c
    })
    // TODO: getting the card from the svelte writable was not possible because the store already had the updated card at this point
    // we need to get the existing card from storage to track the update event
    // this is a workaround, but we should find a better solution if possible
    // as for latency, the get from storage is very fast, so it should not be a problem
    const existingCard = await this.sffs.getCard(id)
    if (!existingCard) throw new Error(`Card ${id} not found in storage`)

    if (updates.data) {
      await this.sffs.updateCardData(id, updates.data)
    }

    if (updates.x || updates.y || updates.width || updates.height) {
      // TODO: can handle sffs only partial card position updates?
      await this.sffs.updateCardPosition(id, {
        x: updates.x ?? existingCard.x,
        y: updates.y ?? existingCard.y,
        width: updates.width ?? existingCard.width,
        height: updates.height ?? existingCard.height
      })
    }

    if (updates.resourceId) {
      await this.sffs.updateCardResource(id, updates.resourceId)
    }

    this.log.debug(`Updated card ${id}`)
    this.signalChange(this)
    await this.telemetry.trackUpdateCardEvent(existingCard, updates)
  }

  async deleteCard(idOrCard: string | Card) {
    const card = typeof idOrCard !== 'string' ? idOrCard : await this.getCard(idOrCard)
    if (!card) throw new Error(`Card ${idOrCard} not found`)

    this.cards.update((c) => c.filter((c) => get(c).id !== card.id))
    await this.sffs.deleteCard(card.id)

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

  createResource(data: Blob, metadata?: Partial<SFFSResourceMetadata>, tags?: SFFSResourceTag[]) {
    const parsedMetadata = Object.assign(
      {
        name: '',
        sourceURI: '',
        alt: ''
      },
      metadata ?? {}
    )

    return this.resourceManager.createResource(data.type, data, parsedMetadata, tags)
  }

  getResource(id: string) {
    return this.resourceManager.getResource(id)
  }

  updateResourceData(resourceId: string, data: Blob, write: boolean = true) {
    return this.resourceManager.updateResourceData(resourceId, data, write)
  }

  async addCard(
    data: Optional<Card, 'id' | 'stackingOrder'>,
    makeActive: boolean = false,
    duplicated: boolean = false
  ) {
    const newCard = await this.sffs.createCard({
      horizonId: this.data.id,
      stackingOrder: Date.now(),
      ...data
    })

    const card = {
      ...newCard,
      hoisted: true
    }

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

  async addCardWithResource(
    type: Card['type'],
    position: CardPosition,
    data: Blob,
    metadata?: Partial<SFFSResourceMetadata>,
    tags?: SFFSResourceTag[]
  ) {
    const resource = await this.createResource(data, metadata, tags)
    return this.addCard({
      ...position,
      type: type,
      resourceId: resource.id
    })
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

  async addCardText(
    content: string,
    position: CardPosition,
    metadata?: Partial<SFFSResourceMetadata>,
    tags?: SFFSResourceTag[],
    makeActive: boolean = false,
    duplicated: boolean = false
  ) {
    // TODO: resource metadata and tags
    const resource = await this.resourceManager.createResourceNote(content, metadata, tags)
    return this.addCard(
      {
        ...position,
        type: 'text',
        resourceId: resource.id
      },
      makeActive,
      duplicated
    )
  }

  async addCardLink(
    url: string,
    position: CardPosition,
    makeActive: boolean = false,
    duplicated: boolean = false
  ) {
    // TODO: resource metadata and tags + fetch metadata from url
    const resource = await this.resourceManager.createResourceLink({ url })
    return this.addCard(
      {
        ...position,
        type: 'link',
        resourceId: resource.id
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
    // TODO: resource metadata and tags
    const resource = await this.resourceManager.createResourceOther(data)
    return this.addCard(
      {
        ...position,
        type: 'file',
        resourceId: resource.id
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
      return this.addCardText('', position, {}, [], makeActive, true)
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

  async scrollToCardCenter(idOrCard: Card | string, allowOverride = false) {
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
    const cardCenter = allowOverride
      ? (card.xOverride || card.x) + (card.widthOverride || card.width) / 2
      : card.x + card.width / 2

    // Calculate the new offsetX to center the card in the viewport
    // The idea is to subtract half of the viewport width from the card's center position
    const newOffsetX = cardCenter - viewportWidth / 2

    // Clamp the newOffsetX to ensure it's within the bounds (if specified in settings)
    const clampedOffsetX = clamp(newOffsetX, 0, settings?.BOUNDS?.maxX ?? 1000)

    // Update the viewOffset to center the card
    function _update() {
      state.viewOffset.update(
        (viewOffset) => ({
          x: clampedOffsetX,
          y: viewOffset.y
        }),
        { duration: 640, easing: expoOut }
      )
    }
    requestAnimationFrame(_update)
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
  sffs: SFFS
  telemetry: Telemetry
  historyEntriesManager: HistoryEntriesManager
  activeHorizonStorage: LocalStorage<string>
  adblockerState: Writable<boolean>
  resourcesManager: ResourceManager

  constructor(api: API, resourcesManager: ResourceManager, telemetryConfig: TelemetryConfig) {
    this.api = api
    this.log = useLogScope(`HorizonService`)
    this.storage = new HorizonDatabase()
    this.sffs = new SFFS() // TODO: maybe share this with the resources manager
    this.telemetry = new Telemetry(this.storage, telemetryConfig)
    this.adblockerState = writable(true)

    this.resourcesManager = resourcesManager
    this.historyEntriesManager = new HistoryEntriesManager()

    // TODO: replace this with something
    // that stores application state
    this.activeHorizonStorage = new LocalStorage<string>('active_horizon')

    window.api.getAdblockerState('persist:horizon').then((state: boolean) => {
      this.adblockerState.set(state)
    })

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
    const storedHorizons = (await this.sffs.getHorizons()) ?? []
    this.log.debug(`Loading ${storedHorizons.length} stored horizons`)

    const horizons = await Promise.all(
      storedHorizons.map(async (data) => {
        let previewImageResource: LegacyResource | undefined
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
          this.resourcesManager,
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
    // TODO: do we need to update anything else?
    this.sffs.updateHorizoData(horizon.data)
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
    const data = await this.sffs.createHorizon(name)

    const horizon = new Horizon(
      data.id,
      data,
      this.api,
      this.telemetry,
      this.resourcesManager,
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

    // Note: SFFS will take care of deleting all cards as well
    await this.sffs.deleteHorizon(horizon.id)

    this.horizons.update((h) => h.filter((h) => h.id !== horizon.id))
    await this.telemetry.trackEvent(EventTypes.DeleteHorizon, { id: horizon.id })
  }
}
