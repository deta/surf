import Dexie from 'dexie'

import { generateID } from '@deta/utils'
import type { Optional } from '../types'
import type { Tab } from '../types/browser.types'
import type { EditablePrompt } from '@deta/types'
import type { HomescreenData } from '../components/Oasis/homescreen/homescreen'
import type { DesktopData } from '../types/desktop.types'

export interface LegacyResource {
  id: string
  data: Blob
  createdAt: string
  updatedAt: string
  [key: string]: any
}

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
    try {
      const raw = this.getRaw()
      if (raw === null) return null
      return JSON.parse(raw) as T
    } catch (e) {
      console.error(e)
      return null
    }
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

  async create(data: Omit<UserData, 'id'>): Promise<UserData> {
    const item = {
      // @ts-ignore
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
    updatedItem.updatedAt = new Date().toISOString()
    return await this.t.update(id, updatedItem)
  }

  async delete(id: string): Promise<void> {
    await this.t.delete(id)
  }

  // TODO: Upgrade Dexie to use Table.bulkUpdate directly
  async bulkUpdate(items: { id: string; updates: Partial<T> }[]): Promise<void> {
    const datetime = new Date().toISOString()

    await Promise.all(
      items.map(async ({ id, updates }) => {
        await this.t.update(id, { updatedAt: datetime, ...updates })
      })
    )
  }
}

export class HorizonDatabase extends Dexie {
  resources: HorizonStore<LegacyResource>
  tabs: HorizonStore<Tab>
  // TODO: remove these unused stores
  chats: HorizonStore<any>
  chatMessages: HorizonStore<any>
  prompts: HorizonStore<EditablePrompt>
  homescreen: HorizonStore<HomescreenData>
  desktop: HorizonStore<DesktopData>

  constructor() {
    super('HorizonDatabase')

    this.version(2).stores({
      userData: 'id, user_id',
      cards: 'id, horizon_id, stacking_order, type, createdAt, updatedAt',
      horizons: 'id, name, stackingOrder, createdAt, updatedAt',
      resources: 'id, createdAt, updatedAt'
    })
    this.version(3)
      .stores({
        userData: 'id, user_id',
        cards: 'id, horizon_id, stacking_order, type, createdAt, updatedAt',
        horizons: 'id, name, stackingOrder, createdAt, updatedAt',
        resources: 'id, createdAt, updatedAt',
        sessions: 'id, userId, partition, createdAt, updatedAt',
        historyEntries:
          'id, *url, *title, *searchQuery, *inPageNavigation, sessionId, type, createdAt, updatedAt'
      })
      .upgrade(async (transaction) => {
        const cardsTable = transaction.table('cards')
        const historyEntriesTable = transaction.table('historyEntries')
        const cards = await cardsTable.toArray()

        for (const card of cards) {
          if (card.type !== 'browser') continue

          const browserCardData = card.data
          let historyStackIds = []

          for (const url of browserCardData.historyStack) {
            const datetime = new Date().toISOString()
            let pageTitle = ''
            try {
              pageTitle = new URL(url).hostname.replace('www.', '')
            } catch (_) {}

            const historyEntry = {
              id: generateID(),
              createdAt: datetime,
              updatedAt: datetime,
              type: 'navigation',
              url: url,
              title: pageTitle
            }
            historyStackIds.push(await historyEntriesTable.add(historyEntry))
          }

          browserCardData.historyStackIds = historyStackIds
          await cardsTable.update(card.id, { data: browserCardData })
        }
      })

    this.version(4).stores({
      userData: 'id, user_id',
      cards: 'id, horizon_id, stacking_order, type, createdAt, updatedAt',
      horizons: 'id, name, stackingOrder, createdAt, updatedAt',
      resources: 'id, createdAt, updatedAt',
      sessions: 'id, userId, partition, createdAt, updatedAt',
      historyEntries:
        'id, *url, *title, *searchQuery, *inPageNavigation, sessionId, type, createdAt, updatedAt',
      tabs: 'id, createdAt, updatedAt, archived, type, title, icon, section, initialLocation, historyStackIds, currentHistoryIndex, resourceBookmark, horizonId, query',
      chats: 'id, createdAt, updatedAt, title, messageIds',
      chatMessages: 'id, createdAt, updatedAt, role, content'
    })

    this.version(5).stores({
      userData: 'id, user_id',
      cards: 'id, horizon_id, stacking_order, type, createdAt, updatedAt',
      horizons: 'id, name, stackingOrder, createdAt, updatedAt',
      resources: 'id, createdAt, updatedAt',
      sessions: 'id, userId, partition, createdAt, updatedAt',
      historyEntries:
        'id, *url, *title, *searchQuery, *inPageNavigation, sessionId, type, createdAt, updatedAt',
      tabs: 'id, createdAt, updatedAt, archived, type, title, icon, section, initialLocation, historyStackIds, currentHistoryIndex, resourceBookmark, horizonId, query',
      chats: 'id, createdAt, updatedAt, title, messageIds',
      chatMessages: 'id, createdAt, updatedAt, role, content',
      folders: 'id, name, items, createdAt, updatedAt'
    })

    this.version(6).stores({
      userData: 'id, user_id',
      cards: 'id, horizon_id, stacking_order, type, createdAt, updatedAt',
      horizons: 'id, name, stackingOrder, createdAt, updatedAt',
      resources: 'id, createdAt, updatedAt',
      sessions: 'id, userId, partition, createdAt, updatedAt',
      historyEntries:
        'id, *url, *title, *searchQuery, *inPageNavigation, sessionId, type, createdAt, updatedAt',
      tabs: 'id, createdAt, updatedAt, archived, type, title, icon, section, initialLocation, historyStackIds, currentHistoryIndex, resourceBookmark, horizonId, query',
      chats: 'id, createdAt, updatedAt, title, messageIds',
      chatMessages: 'id, createdAt, updatedAt, role, content',
      prompts: 'id, kind, title, description, content, createdAt, updatedAt'
    })

    this.version(7).stores({
      userData: 'id, user_id',
      cards: 'id, horizon_id, stacking_order, type, createdAt, updatedAt',
      horizons: 'id, name, stackingOrder, createdAt, updatedAt',
      resources: 'id, createdAt, updatedAt',
      sessions: 'id, userId, partition, createdAt, updatedAt',
      historyEntries:
        'id, *url, *title, *searchQuery, *inPageNavigation, sessionId, type, createdAt, updatedAt',
      tabs: 'id, createdAt, updatedAt, archived, type, title, icon, section, initialLocation, historyStackIds, currentHistoryIndex, resourceBookmark, horizonId, query',
      chats: 'id, createdAt, updatedAt, title, messageIds',
      chatMessages: 'id, createdAt, updatedAt, role, content',
      prompts: 'id, kind, title, description, content, createdAt, updatedAt',
      homescreen: 'id, createdAt, updatedAt, bentoItems, customization'
    })

    this.version(8)
      .stores({
        userData: 'id, user_id',
        cards: 'id, horizon_id, stacking_order, type, createdAt, updatedAt',
        horizons: 'id, name, stackingOrder, createdAt, updatedAt',
        resources: 'id, createdAt, updatedAt',
        sessions: 'id, userId, partition, createdAt, updatedAt',
        historyEntries:
          'id, *url, *title, *searchQuery, *inPageNavigation, sessionId, type, createdAt, updatedAt',
        tabs: 'id, createdAt, updatedAt, archived, type, title, icon, section, initialLocation, historyStackIds, currentHistoryIndex, resourceBookmark, horizonId, query',
        chats: 'id, createdAt, updatedAt, title, messageIds',
        chatMessages: 'id, createdAt, updatedAt, role, content',
        prompts: 'id, kind, title, description, content, createdAt, updatedAt',
        homescreen: 'id, createdAt, updatedAt, bentoItems, customization',
        desktop: 'id, createdAt, updatedAt, items, background_image'
      })
      .upgrade(async (transaction) => {
        const desktopTable = transaction.table('desktop')
        const homescreenTable = transaction.table('homescreen')
        const homescreenItems = await homescreenTable.toArray()

        const items: any[] = []

        for (const homescreenItem of homescreenItems) {
          console.warn('Upgrading item: ', homescreenItem)

          const bentoItems = homescreenItem.bentoItems
          for (const item of bentoItems) {
            const datetime = new Date().toISOString()
            const itm = {
              id: item.id,
              x: item.cellX,
              y: item.cellY,
              width: item.spanX,
              height: item.spanY
            }

            if (item.resourceId !== undefined) {
              itm.type = 'resource'
              itm.resourceId = item.resourceId
            } else if (item.spaceId !== undefined) {
              itm.type = 'space'
              itm.spaceId = item.spaceId
            }

            items.push(itm)
          }
        }

        const datetime = new Date().toISOString()
        desktopTable.add({
          id: '$$default',
          createdAt: datetime,
          updatedAt: datetime,
          background_image: (await homescreenTable.get('$$default'))?.customization?.background,
          items
        })
      })

    this.resources = new HorizonStore<LegacyResource>(this.table('resources'))
    this.tabs = new HorizonStore<Tab>(this.table('tabs'))
    this.chats = new HorizonStore<any>(this.table('chats'))
    this.chatMessages = new HorizonStore<any>(this.table('chatMessages'))
    this.prompts = new HorizonStore<EditablePrompt>(this.table('prompts'))
    this.homescreen = new HorizonStore<HomescreenData>(this.table('homescreen'))
    this.desktop = new HorizonStore<DesktopData>(this.table('desktop'))
  }
}
