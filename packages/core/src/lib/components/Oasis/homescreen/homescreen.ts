import { derived, writable, get, type Readable, type Writable, readable } from 'svelte/store'
import type { BentoItem, BentoItemData } from './BentoController'
import { getContext, setContext, tick } from 'svelte'
import { OpenHomescreenEventTrigger } from '@horizon/types'
import type { Telemetry } from '../../../service/telemetry'
import { HorizonDatabase } from '../../../service/storage'

type Item = BentoItemData & {
  isDragged?: boolean
  resourceId?: string
  spaceId?: string
}
interface Customization {
  background: string
}
export interface HomescreenData {
  id: string
  createdAt: string
  updatedAt: string
  bentoItems: Item[]
  customization: Customization
}
export class Homescreen
  implements
    Readable<{
      bentoItems: Writable<Writable<Item>[]>
      customization: Writable<Customization>
    }>
{
  telemetry: Telemetry
  storage: HorizonDatabase

  #visible: Writable<boolean> = writable(false)
  visible: Readable<boolean> = this.#visible

  bentoItems: Writable<Writable<Item>[]>
  customization: Writable<Customization>

  #readable: Readable<{
    bentoItems: Writable<Writable<Item>[]>
    customization: Writable<Customization>
  }>

  constructor(telemetry: Telemetry) {
    this.telemetry = telemetry
    this.storage = new HorizonDatabase()
    this.bentoItems = writable<Writable<Item>[]>([])
    this.customization = writable<Customization>({
      background: 'transparent'
    })

    this.#readable = derived(
      [this.bentoItems, this.customization],
      ([$bentoItems, $customization]) => ({
        bentoItems: this.bentoItems,
        customization: this.customization
      })
    )

    this.load()

    this.bentoItems.subscribe((items) => {
      this.store()
    })
    this.customization.subscribe((customization) => {
      this.store()
    })
  }

  get subscribe() {
    return this.#readable.subscribe
  }

  async store() {
    const serialized = {
      bentoItems: get(this.bentoItems).map((item) => get(item)),
      customization: get(this.customization)
    }
    if (await this.storage.homescreen.read('$$default'))
      this.storage.homescreen.update('$$default', serialized)
    else this.storage.homescreen.create({ id: '$$default', ...serialized })
  }

  async load() {
    let data = await this.storage.homescreen.read('$$default')
    if (data === undefined) {
      data = Object.assign(
        {},
        {
          bentoItems: [],
          customization: {
            background: 'transparent'
          }
        }
      )
      this.store()
    }

    this.bentoItems.set(data.bentoItems.map((item: any) => writable(item)))
    this.customization.set(data.customization)
  }

  setVisible(visible: boolean, trigger = OpenHomescreenEventTrigger.Click) {
    if (visible === get(this.#visible)) return
    document.startViewTransition(async () => {
      this.#visible.set(visible)
      await tick()
    })
    if (visible) {
      this.telemetry.trackOpenHomescreen(trigger)
    }
  }

  static provide(telemetry: Telemetry) {
    const service = new Homescreen(telemetry)

    setContext('homeSpace', service)

    return service
  }
  static use() {
    return getContext<Homescreen>('homeSpace')
  }
}

export const useHomescreen = Homescreen.use
export const provideHomescreen = Homescreen.provide
