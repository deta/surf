import { get, writable, type Readable, type Writable, derived } from "svelte/store"
import type { Card } from "../types"
import type { API } from "./api"
import { parseError } from "../utils/errors"
import log, { useLogScope, type ScopedLogger } from "../utils/log"


/*
- `cold`: only basic Horizon information is in memory (initial state for all Horizons)
- `warm`: its cards and all required data for rendering are stored in memory
- `hot`: the Horizon is rendered in the DOM and ready for immediate interaction
*/
export type HorizonState = 'cold' | 'warm' | 'hot'

export type HorizonData = {
    name: string
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
        // this.api.getHorizon(this.id)
        const { default: data } = await import('../data/cards.json')

        this.log.debug(`Loaded ${data.length} cards`)
        const transformed = data.map((d) => writable({ ...d, id: `${this.id}-${d.id}`}))
        this.cards.set(transformed)
    }

    async updateData(updates: Partial<HorizonData>) {
        this.data.update((d) => ({ ...d, ...updates }))
    }

    async coolDown() {
        this.log.debug(`Cooling down`)
        this.cards.set([])
        this.changeState('cold')
    }

    async warmUp() {
        this.log.debug(`Warming up`)
        // TODO: rely on cache to only fetch cards that are not already in memory
        await this.loadCards()

        this.changeState('warm')
    }
}

export class HorizonsManager {
    activeHorizonId: Writable<string | null>
    horizons: Writable<Horizon[]>

    horizonStates: Writable<Map<string, HorizonState>>

    activeHorizon: Readable<Horizon | null>
    coldHorizons: Readable<Horizon[]>
    warmHorizons: Readable<Horizon[]>
    hotHorizons: Readable<Horizon[]>

    api: API
    log: ScopedLogger

    constructor(api: API) {
        this.api = api
        this.log = useLogScope(`HorizonManager`)

        this.activeHorizonId = writable(null)
        this.horizons = writable([])
        this.horizonStates = writable(new Map())

        this.hotHorizons = derived([this.horizons, this.horizonStates], ([horizons, horizonStates]) => {
            return horizons.filter((h) => {
                const state = horizonStates.get(h.id)
                return state === 'hot'
            })
        })

        this.activeHorizon = derived([this.horizons, this.activeHorizonId], ([horizons, activeHorizonId]) => {
            if (!activeHorizonId) return null
            const horizon = horizons.find((h) => h.id === activeHorizonId) ?? null
            if (horizon?.getState() === 'cold') {
                this.log.warn(`Active horizon ${activeHorizonId} is cold`)
            }
            return horizon
        })
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

        const horizons = data.map((d) => new Horizon(d.id, {
            name: d.name,
            viewOffsetX: d.viewOffsetX,
            isDefault: d.default,
            createdAt: d.created_at,
        }, this.api))

        this.horizons.set(horizons)
        this.horizonStates.set(new Map(horizons.map((h) => [h.id, h.getState()])))
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

    async warmUpHorizon(id: string) {
        const horizon = this.getHorizon(id)
        await horizon.warmUp()
        this.horizonStates.update((s) => s.set(id, 'warm'))
    }

    async coolDownHorizon(id: string) {
        const horizon = this.getHorizon(id)
        await horizon.coolDown()
        this.horizonStates.update((s) => s.set(id, 'cold'))
    }

    async switchHorizon(id: string) {
        const horizon = this.getHorizon(id)

        if (horizon.getState() === 'cold') {
            await horizon.warmUp()
        }

        horizon.changeState('hot')
        this.horizonStates.update((s) => s.set(id, 'hot'))

        // TODO: cool down other older horizons

        this.log.debug(`Making horizon ${id} active`)
        this.activeHorizonId.set(id)
    }

    async createHorizon(name: string) {
        // const res = await this.api.createHorizon(name)
        const data = {
            id: 'new-horizon',
            name,
            viewOffsetX: 0,
            default: false,
            created_at: new Date().toISOString(),
        }
        const horizon = new Horizon(data.id, {
            name: data.name,
            viewOffsetX: data.viewOffsetX,
            isDefault: data.default,
            createdAt: data.created_at,
        }, this.api)

        this.horizons.update((h) => [...h, horizon])

        return horizon
    }
}
