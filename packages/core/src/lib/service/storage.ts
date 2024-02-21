import Dexie from 'dexie'

import { generateID, generateUUID } from '../utils/id'
import type {
  Card,
  Optional,
  Resource,
  HorizonData,
  CardBrowser,
  CardFile,
  UserData,
  Session,
  HistoryEntry
} from '../types'

export class LocalStorage<T> {
  key: string
  constructor(key: string) {
    this.key = key
  }

  getRaw(): string | null {
    return localStorage.getItem(this.key)
  }

  setRaw(value: string) {
    localStorage.setItem(this.key, value)
  }

  get(): T | null {
    const raw = this.getRaw()
    if (raw === null) return null
    return JSON.parse(raw) as T
  }

  set(value: T) {
    this.setRaw(JSON.stringify(value))
  }
}

export class Storage<T extends Record<string, any>> {
  items: T[]
  storage: LocalStorage<T[]>
  constructor(namespace: string) {
    this.storage = new LocalStorage<T[]>(namespace)
    this.items = this.load() ?? []
  }

  load() {
    const items = this.storage.get()
    if (items === null) return

    return items
  }

  add(value: T) {
    const id = generateID()
    const item = { id, ...value }

    this.items.push(item)
    this.storage.set(this.items)

    return item
  }

  get(id: string) {
    return this.items.find((i) => i.id === id)
  }

  update(id: string, value: Partial<T>) {
    const item = this.items.find((i) => i.id === id)
    if (!item) return

    Object.assign(item, value)
    this.storage.set(this.items)

    return item
  }

  remove(id: string) {
    this.items = this.items.filter((i) => i.id !== id)
    this.storage.set(this.items)
  }

  list() {
    return this.items
  }
}

export class UserStore<UserData> {
  constructor(public t: Dexie.Table<UserData, string>) {}

  async create(data: Optional<UserData, 'id'>): Promise<UserData> {
    const item = {
      id: 'main', // only singe user data must exist
      ...data
    } as UserData

    await this.t.add(item)
    return item
  }

  // only singe user data must exist
  async get(): Promise<UserData | undefined> {
    return this.t.get('main')
  }
}

export class HorizonStore<T extends { id: string; createdAt: string; updatedAt: string }> {
  constructor(public t: Dexie.Table<T, string>) {}

  async create(data: Optional<T, 'id' | 'createdAt' | 'updatedAt'>): Promise<T> {
    const datetime = new Date().toISOString()
    const item = {
      id: generateID(),
      createdAt: datetime,
      updatedAt: datetime,
      ...data
    } as T

    await this.t.add(item)
    return item
  }

  async all(): Promise<T[]> {
    return await this.t.toArray()
  }

  async read(id: string): Promise<T | undefined> {
    return await this.t.get(id)
  }

  async update(id: string, updatedItem: Partial<T>): Promise<number> {
    delete updatedItem.createdAt
    updatedItem.updatedAt = new Date().toISOString()
    return await this.t.update(id, updatedItem)
  }

  async delete(id: string): Promise<void> {
    await this.t.delete(id)
  }
}

class HistoryStore extends HorizonStore<HistoryEntry> {
  constructor(public t: Dexie.Table<HistoryEntry, string>) {
    super(t)
  }

  async getBySessionId(sessionId: string) {
    return await this.t.where({ sessionId }).toArray()
  }

  async fetchHistoryEntriesByIds(ids: string[]): Promise<Map<string, HistoryEntry>> {
    const historyEntries = await this.t.where('id').anyOf(ids).toArray()
    const entriesMap = new Map<string, HistoryEntry>()
    historyEntries.forEach((entry) => entriesMap.set(entry.id, entry))
    return entriesMap
  }
}

export class HorizonDatabase extends Dexie {
  userData: UserStore<UserData>
  cards: HorizonStore<Card>
  horizons: HorizonStore<HorizonData>
  resources: HorizonStore<Resource>
  sessions: HorizonStore<Session>
  historyEntries: HistoryStore

  constructor() {
    super('HorizonDatabase')

    this.version(3).stores({
      userData: 'id, user_id',
      cards: 'id, horizon_id, stacking_order, type, createdAt, updatedAt',
      horizons: 'id, name, stackingOrder, createdAt, updatedAt',
      resources: 'id, createdAt, updatedAt',
      sessions: 'id, userId, partition, createdAt, updatedAt',
      historyEntries:
        'id, *url, *title, *searchQuery, *inPageNavigation, sessionId, type, createdAt, updatedAt'
    })

    this.userData = new UserStore<UserData>(this.table('userData'))
    this.cards = new HorizonStore<Card>(this.table('cards'))
    this.horizons = new HorizonStore<HorizonData>(this.table('horizons'))
    this.resources = new HorizonStore<Resource>(this.table('resources'))
    this.sessions = new HorizonStore<Session>(this.table('sessions'))
    this.historyEntries = new HistoryStore(this.table('historyEntries'))
  }

  async getUserID() {
    return (await this.userData.get())?.user_id
  }

  async createUserData() {
    return await this.userData.create({ user_id: generateUUID() } as UserData)
  }

  async getCardsByHorizonId(horizonId: string) {
    // TODO: ensure that types are properly initialized with default values going forward
    const cards = (await this.cards.t.where({ horizon_id: horizonId }).toArray()).map((c) => {
      if (c.type == 'browser') {
        const data = c.data as CardBrowser['data']
        data.historyStackIds = data.historyStackIds ?? []
      }
      return c
    })

    // const allHistoryStackIds = [
    //   ...new Set(
    //     cards
    //       .filter((card) => card.type === 'browser')
    //       .flatMap((card) => (card.data as CardBrowser['data']).historyStackIds)
    //   )
    // ]
    // let historyEntriesMap = new Map<string, HistoryEntry>()
    // if (allHistoryStackIds.length > 0) {
    //   historyEntriesMap = await this.historyEntries.fetchHistoryEntriesByIds(allHistoryStackIds)
    // }

    // cards.forEach((card) => {
    //   if (card.type === 'browser') {
    //     const browserData = card.data as CardBrowser['data']
    //     browserData.historyStack = browserData.historyStackIds
    //       .map((id) => historyEntriesMap.get(id))
    //       .filter((entry) => entry !== undefined) as HistoryEntry[]
    //   }
    // })

    return cards
  }

  async deleteCardWithResource(card: Card) {
    if (card && card.type === 'file') {
      await this.resources.delete((card as CardFile).data.resourceId)
    }

    await this.cards.delete(card.id)
  }

  async deleteCardsByHorizonId(horizonId: string) {
    const fileCardsResourceIds = (
      await this.cards.t.where({ horizon_id: horizonId, type: 'file' }).toArray()
    ).map((card: Card) => (card as CardFile).data.resourceId)

    if (fileCardsResourceIds.length > 0) {
      await this.resources.t.where('id').anyOf(fileCardsResourceIds).delete()
    }

    await this.cards.t.where({ horizon_id: horizonId }).delete()
  }
}
