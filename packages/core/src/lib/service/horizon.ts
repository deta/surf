import { get, writable, type Readable, type Writable, derived } from 'svelte/store'
import type { Card } from '../types'
import type { API } from './api'
import { useLogScope, type ScopedLogger } from '../utils/log'
import { generateID } from '../utils/id'
import { LocalStorage } from './storage'

// how many horizons to keep in the dom
const HOT_HORIZONS_THRESHOLD = 5

/*
- `cold`: only basic Horizon information is in memory (initial state for all Horizons)
- `warm`: its cards and all required data for rendering are stored in memory
- `hot`: the Horizon is rendered in the DOM and ready for immediate interaction
*/
export type HorizonState = 'cold' | 'warm' | 'hot'

export type HorizonData = {
  id: string
  name: string
  previewImage?: string
  isDefault: boolean
  viewOffsetX: number
  createdAt: string
}

export class Horizon {
  readonly id: string
  state: HorizonState
  data: HorizonData
  cards: Writable<Writable<Card>[]>

  api: API
  log: ScopedLogger
  storage: LocalStorage<Card[]>

  constructor(id: string, data: HorizonData, api: API) {
    this.id = id
    this.api = api
    this.log = useLogScope(`Horizon ${id}`)
    this.storage = new LocalStorage<Card[]>(`horizon_${id}_cards`)

    this.state = 'cold'
    this.data = data
    this.cards = writable([])
    
    this.cards.subscribe((cards) => {
      if (cards.length === 0) {
        this.log.debug(`No cards, skipping persist`)
        return
      }

      this.log.debug(`Persisting ${cards.length} cards`)
      this.storage.set(cards.map((c) => get(c)))
    })

    this.log.debug(`Created`)
  }

  getState() {
    return this.state
  }

  changeState(state: HorizonState) {
    this.state = state
  }

  async refreshData() {
    // this.api.getHorizon(this.id)
  }

  async loadCards() {
    this.log.debug(`Loading cards`)

    // load cards from storage and persist any future changes
    const storedCards = this.storage.get() ?? []
    this.cards.set(storedCards.map((c) => writable(c)))

    // if (this.id === 'horizon_1_dummy') {
    //   const { default: data } = await import('../data/cards.json')
    //   this.log.debug(`Loaded ${data.length} cards`)
    //   const transformed = data.map((d) =>
    //     writable({ ...d, id: `${this.id}-${d.id}`, hoisted: true })
    //   )
    //   this.cards.set(transformed)
    // } else {
    //   // this.api.getHorizon(this.id)
    // }
  }

  async updateData(updates: Partial<HorizonData>) {
    this.data = { ...this.data, ...updates }
  }

  async updateCard(updates: Partial<Card>) {
    this.cards.update((c) => {
      const card = c.find((c) => get(c).id === updates.id)
      if (!card) return c
      card.update((c) => ({ ...c, ...updates }))
      return c
    })
    this.log.debug(`Updated card ${updates.id}`)
  }

  async deleteCard(id: string) {
    this.cards.update((c) => c.filter((c) => get(c).id !== id))
    this.log.debug(`Deleted card ${id}`)
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

  async addCard(card: Omit<Card, 'id' | 'stacking_order'>) {
    const newCard = writable({
      ...card,
      id: generateID(),
      stacking_order: 1,
      hoisted: true
    })
    this.cards.update((c) => [...c, newCard])
  }
}

export class HorizonsManager {
  activeHorizonId: Writable<string | null>
  horizons: Writable<Horizon[]>

  horizonStates: Writable<Map<string, { state: HorizonState; since: Date }>>

  activeHorizon: Readable<Horizon | null>
  hotHorizons: Readable<Horizon[]>
  coldHorizons: Readable<Horizon[]>
  sortedHorizons: Readable<string[]>

  hotHorizonsThreshold: number

  api: API
  log: ScopedLogger
  storage: LocalStorage<HorizonData[]>
  activeHorizonStorage: LocalStorage<string>

  constructor(api: API) {
    this.api = api
    this.log = useLogScope(`HorizonService`)
    this.storage = new LocalStorage<HorizonData[]>('horizons')
    this.activeHorizonStorage = new LocalStorage<string>('active_horizon')

    this.activeHorizonId = writable(null)
    this.horizons = writable([])
    this.horizonStates = writable(new Map())

    this.horizons.subscribe((h) => this.persistHorizons(h))

    this.hotHorizonsThreshold = HOT_HORIZONS_THRESHOLD

    this.hotHorizons = derived([this.horizons, this.horizonStates], ([horizons, horizonStates]) => {
      return horizons
        .filter((h) => {
            const horizonState = horizonStates.get(h.id)
            return horizonState?.state === 'hot'
        })
        // .sort((a, b) => {
        //     const aState = horizonStates.get(a.id)
        //     const bState = horizonStates.get(b.id)
        //     if (!aState || !bState) return 0
        //     return bState.since.getTime() - aState.since.getTime()
        // })
    })

    this.coldHorizons = derived([this.horizons, this.horizonStates], ([horizons, horizonStates]) => {
        return horizons
          .filter((h) => {
              const horizonState = horizonStates.get(h.id)
              return horizonState?.state !== 'hot'
          })
      })

    this.sortedHorizons = derived([this.horizons, this.horizonStates], ([horizons, horizonStates]) => {
      return [...horizons]
        .sort((a, b) => {
            const aState = horizonStates.get(a.id)
            const bState = horizonStates.get(b.id)
            if (!aState || !bState) return 0
            return bState.since.getTime() - aState.since.getTime()
        })
        .map((h) => h.id)
    })

    this.activeHorizon = derived(
      [this.horizons, this.activeHorizonId],
      ([horizons, activeHorizonId]) => {
        if (!activeHorizonId) return null
        const horizon = horizons.find((h) => h.id === activeHorizonId) ?? null
        if (horizon?.getState() === 'cold') {
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

  async loadHorizons() {
    const storedHorizons = this.storage.get() ?? []
    this.log.debug(`Loading ${storedHorizons.length} stored horizons`)
    
    // const res = await this.api.getHorizons()
    // const { default: data } = await import('../data/horizons.json')

    const horizons = storedHorizons.map(
      (d) =>
        new Horizon(
          d.id,
          {
            id: d.id,
            name: d.name,
            previewImage: d.previewImage,
            viewOffsetX: d.viewOffsetX,
            isDefault: d.isDefault,
            createdAt: d.createdAt
          },
          this.api
        )
    )

    this.horizons.set(horizons)
    this.horizonStates.set(
      new Map(horizons.map((h) => [h.id, { state: h.getState(), since: new Date() }]))
    )
  }

  persistHorizons(horizons: Horizon[]) {
    if (horizons.length === 0) {
      this.log.debug(`No horizons, skipping persist`)
      return
    }
    this.log.debug(`Persisting ${horizons.length} horizons`)
    const horizonsData = horizons.map((h) => h.data)
    this.log.debug(`Horizons data`, horizonsData)
    this.storage.set(horizonsData)
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

  changeHorizonState(id: string, state: HorizonState) {
    this.horizonStates.update((s) => s.set(id, { state, since: new Date() }))
  }

  async warmUpHorizon(idOrHorizon: string | Horizon) {
    const horizon = typeof idOrHorizon === 'string' ? this.getHorizon(idOrHorizon) : idOrHorizon
    await horizon.warmUp()
    this.changeHorizonState(horizon.id, 'warm')
  }

  async coolDownHorizon(idOrHorizon: string | Horizon) {
    const horizon = typeof idOrHorizon === 'string' ? this.getHorizon(idOrHorizon) : idOrHorizon
    await horizon.coolDown()
    this.changeHorizonState(horizon.id, 'cold')
  }

  async switchHorizon(idOrHorizon: string | Horizon) {
    const horizon = typeof idOrHorizon === 'string' ? this.getHorizon(idOrHorizon) : idOrHorizon

    const oldHorizonState = get(this.horizonStates).get(horizon.id)?.state ?? 'cold'

    if (oldHorizonState === 'cold') {
      await horizon.warmUp()
    }

    horizon.changeState('hot')
    this.changeHorizonState(horizon.id, 'hot')

    // only if the horizon was not already hot
    if (oldHorizonState !== 'hot') {
      // cool down other older hot horizons
      if (get(this.hotHorizons).length > this.hotHorizonsThreshold) {
        this.log.debug(`Cooling down older hot horizons`)
        const horizonStates = get(this.horizonStates)
        const hotHorizons = Array.from(horizonStates.entries())
          .map(([id, state]) => ({ id, ...state }))
          .filter((horizon) => horizon.state === 'hot')
          .sort((a, b) => a.since.getTime() - b.since.getTime()) // oldest first

        this.log.debug(`Found ${hotHorizons.length} hot horizons`)
        while (hotHorizons.length > this.hotHorizonsThreshold) {
          const horizon = hotHorizons.shift()
          if (!horizon) break
          await this.coolDownHorizon(horizon.id)
        }
      }
    }

    this.log.debug(`Making horizon ${horizon.id} active`)
    this.activeHorizonId.set(horizon.id)
  }

  async updateHorizon(idOrHorizon: string | Horizon, updates: Partial<HorizonData>) {
    const horizon = typeof idOrHorizon === 'string' ? this.getHorizon(idOrHorizon) : idOrHorizon
    await horizon.updateData(updates)
    horizon.log.debug(`Updated data`, horizon.data)
    this.persistHorizons(get(this.horizons))
  }

  async createHorizon(name: string, isDefault = false) {
    // const res = await this.api.createHorizon(name)
    const data = {
      id: generateID(),
      name,
      viewOffsetX: 0,
      default: isDefault,
      created_at: new Date().toISOString()
    }
    const horizon = new Horizon(
      data.id,
      {
        id: data.id,
        name: data.name,
        viewOffsetX: data.viewOffsetX,
        isDefault: data.default,
        createdAt: data.created_at
      },
      this.api
    )

    this.horizons.update((h) => [...h, horizon])

    return horizon
  }
}
