import { get, writable, type Readable, type Writable, derived } from 'svelte/store'
import type { Card } from '../types'
import type { API } from './api'
import { useLogScope, type ScopedLogger } from '../utils/log'
import { generateID } from '../utils/id'

// how many horizons to keep in the dom
const HOT_HORIZONS_THRESHOLD = 5

/*
- `cold`: only basic Horizon information is in memory (initial state for all Horizons)
- `warm`: its cards and all required data for rendering are stored in memory
- `hot`: the Horizon is rendered in the DOM and ready for immediate interaction
*/
export type HorizonState = 'cold' | 'warm' | 'hot'

export type HorizonData = {
  name: string
  previewImage?: string
  isDefault: boolean
  viewOffsetX: number
  createdAt: string
}

export class Horizon {
  readonly id: string
  state: HorizonState
  data: Writable<HorizonData>
  cards: Writable<Writable<Card>[]>

  api: API
  log: ScopedLogger

  constructor(id: string, data: HorizonData, api: API) {
    this.id = id
    this.api = api
    this.log = useLogScope(`Horizon ${id}`)

    this.state = 'cold'
    this.data = writable(data)
    this.cards = writable([])

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
    if (this.id === 'horizon_1_dummy') {
      const { default: data } = await import('../data/cards.json')
      this.log.debug(`Loaded ${data.length} cards`)
      const transformed = data.map((d) =>
        writable({ ...d, id: `${this.id}-${d.id}`, hoisted: true })
      )
      this.cards.set(transformed)
    } else {
      // this.api.getHorizon(this.id)
    }
  }

  async updateData(updates: Partial<HorizonData>) {
    this.data.update((d) => ({ ...d, ...updates }))
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

  hotHorizonsThreshold: number

  api: API
  log: ScopedLogger

  constructor(api: API) {
    this.api = api
    this.log = useLogScope(`HorizonService`)

    this.activeHorizonId = writable(null)
    this.horizons = writable([])
    this.horizonStates = writable(new Map())

    this.hotHorizonsThreshold = HOT_HORIZONS_THRESHOLD

    this.hotHorizons = derived([this.horizons, this.horizonStates], ([horizons, horizonStates]) => {
      return horizons.filter((h) => {
        const horizonState = horizonStates.get(h.id)
        return horizonState?.state === 'hot'
      })
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

    const defaultHorizon = this.getDefaultHorizon()
    this.log.debug(`Switching to default horizon ${defaultHorizon.id}`)
    await this.switchHorizon(defaultHorizon.id)
  }

  async loadHorizons() {
    // const res = await this.api.getHorizons()
    const { default: data } = await import('../data/horizons.json')

    const horizons = data.map(
      (d) =>
        new Horizon(
          d.id,
          {
            name: d.name,
            viewOffsetX: d.viewOffsetX,
            isDefault: d.default,
            createdAt: d.created_at
          },
          this.api
        )
    )

    this.horizons.set(horizons)
    this.horizonStates.set(
      new Map(horizons.map((h) => [h.id, { state: h.getState(), since: new Date() }]))
    )
  }

  getDefaultHorizon() {
    const horizon = get(this.horizons).find((h) => get(h.data).isDefault)
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

    if (horizon.getState() === 'cold') {
      await horizon.warmUp()
    }

    if (horizon.getState() !== 'hot') {
      horizon.changeState('hot')
      this.changeHorizonState(horizon.id, 'hot')

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

  async createHorizon(name: string) {
    // const res = await this.api.createHorizon(name)
    const data = {
      id: generateID(),
      name,
      viewOffsetX: 0,
      default: false,
      created_at: new Date().toISOString()
    }
    const horizon = new Horizon(
      data.id,
      {
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
