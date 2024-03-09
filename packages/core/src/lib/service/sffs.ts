import { useLogScope, type ScopedLogger } from '../utils/log'
import type {
  SFFSResourceMetadata,
  SFFSResourceTag,
  SFFSResource,
  SFFSRawCompositeResource,
  SFFSRawResourceTag,
  SFFSSearchResult,
  SFFSRawResourceMetadata,
  Card,
  SFFSRawCard,
  CardType,
  Optional,
  SFFSRawCardToCreate,
  SFFSRawHorizon,
  HorizonData,
  SFFSRawHorizonToCreate,
  CardPosition,
  SFFSRawHistoryEntry,
  HistoryEntry,
  HistoryEntryType,
  SFFSRawHistoryEntryType,
  SFFSSearchResultItem,
  SFFSSearchResultEngine
} from '../types'

export type CardToCreate = Optional<Card, 'id' | 'stackingOrder' | 'createdAt' | 'updatedAt'>
export type HorizonToCreate = Optional<
  HorizonData,
  'id' | 'stackingOrder' | 'createdAt' | 'updatedAt'
>

export class SFFS {
  backend: any
  fs: any
  log: ScopedLogger

  constructor() {
    this.log = useLogScope('SFFS')

    if (typeof window.backend === 'undefined') {
      throw new Error('SFFS backend not available')
    }

    this.backend = window.backend.sffs
    this.fs = window.backend.resources

    window.sffs = this // TODO: remove this, just for debugging

    if (!this.backend) {
      throw new Error('SFFS backend failed to initialize')
    }
  }

  convertCompositeResourceToResource(composite: SFFSRawCompositeResource): SFFSResource {
    return {
      id: composite.resource.id,
      type: composite.resource.resource_type,
      path: composite.resource.resource_path,
      createdAt: composite.resource.created_at,
      updatedAt: composite.resource.updated_at,
      deleted: composite.resource.deleted === 1,
      metadata: {
        name: composite.metadata?.name ?? '',
        sourceURI: composite.metadata?.source_uri ?? '',
        alt: composite.metadata?.alt ?? '',
        userContext: composite.metadata?.user_context ?? ''
      },
      tags: (composite.resource_tags || []).map((tag) => ({
        id: tag.id,
        name: tag.tag_name,
        value: tag.tag_value
      }))
    }
  }

  convertResourceToCompositeResource(resource: SFFSResource): SFFSRawCompositeResource {
    return {
      resource: {
        id: resource.id,
        resource_path: resource.path,
        resource_type: resource.type,
        created_at: resource.createdAt,
        updated_at: resource.updatedAt,
        deleted: resource.deleted ? 1 : 0
      },
      metadata: {
        id: '', // TODO: what about metadata id? do we need to keep it around?
        resource_id: resource.id,
        name: resource.metadata?.name ?? '',
        source_uri: resource.metadata?.sourceURI ?? '',
        alt: resource.metadata?.alt ?? '',
        user_context: resource.metadata?.userContext ?? ''
      },
      resource_tags: (resource.tags || []).map((tag) => ({
        id: tag.id ?? '',
        resource_id: resource.id,
        tag_name: tag.name,
        tag_value: tag.value
      }))
    }
  }

  convertRawCardToCard(rawCard: SFFSRawCard): Card {
    const uInt8 = new Uint8Array(rawCard.data)
    const stringData = new TextDecoder().decode(uInt8)
    const data = this.parseData<Card['data']>(stringData) || null
    const stackingOrder = new Date(rawCard.stacking_order).getTime()

    return {
      id: rawCard.id,
      x: rawCard.position_x,
      y: rawCard.position_y,
      width: rawCard.width,
      height: rawCard.height,
      horizonId: rawCard.horizon_id,
      createdAt: rawCard.created_at,
      updatedAt: rawCard.updated_at,
      stackingOrder: stackingOrder,
      type: rawCard.card_type as CardType,
      data: data,
      resourceId: rawCard.resource_id ?? null
    }
  }

  convertCardToRawCard(card: CardToCreate | Card): SFFSRawCard | SFFSRawCardToCreate {
    const dataString = card.data ? JSON.stringify(card.data ?? null) : 'null'
    const uint8ArrayData = new TextEncoder().encode(dataString)
    const arrayData = Array.from(uint8ArrayData)

    return {
      id: card.id ?? undefined,
      horizon_id: card.horizonId,
      card_type: card.type,
      resource_id: card.resourceId ?? undefined,
      position_id: 0, // TODO: do we need to set this?
      position_x: Math.round(card.x),
      position_y: Math.round(card.y),
      width: Math.round(card.width),
      height: Math.round(card.height),
      stacking_order: card.stackingOrder ? new Date(card.stackingOrder).toISOString() : '',
      created_at: card.createdAt,
      updated_at: card.updatedAt,
      data: arrayData
    }
  }

  convertRawHorizonToHorizon(rawHorizon: SFFSRawHorizon): HorizonData {
    return {
      id: rawHorizon.id,
      name: rawHorizon.horizon_name,
      viewOffsetX: rawHorizon.view_offset_x ?? 0,
      stackingOrder: [],
      createdAt: rawHorizon.created_at,
      updatedAt: rawHorizon.updated_at
    }
  }

  convertHorizonToRawHorizon(horizon: HorizonToCreate | HorizonData): SFFSRawHorizonToCreate {
    return {
      id: horizon.id,
      horizon_name: horizon.name,
      view_offset_x: Math.round(horizon.viewOffsetX),
      created_at: horizon.createdAt,
      updated_at: horizon.updatedAt
    }
  }

  convertRawHistoryEntryToHistoryEntry(rawEntry: SFFSRawHistoryEntry): HistoryEntry {
    return {
      id: rawEntry.id,
      createdAt: rawEntry.created_at,
      updatedAt: rawEntry.updated_at,
      type: rawEntry.entry_type.toLowerCase() as HistoryEntryType,
      url: rawEntry.url ?? undefined,
      title: rawEntry.title ?? undefined,
      searchQuery: rawEntry.search_query ?? undefined
    }
  }

  convertHistoryEntryToRawHistoryEntry(entry: HistoryEntry): SFFSRawHistoryEntry {
    return {
      id: entry.id,
      created_at: entry.createdAt,
      updated_at: entry.updatedAt,
      entry_type: (entry.type.charAt(0).toUpperCase() +
        entry.type.slice(1)) as SFFSRawHistoryEntryType,
      url: entry.url ?? null,
      title: entry.title ?? null,
      search_query: entry.searchQuery ?? null
    }
  }

  parseData<T>(raw: string): T | null {
    try {
      return JSON.parse(raw)
    } catch (e) {
      this.log.error('failed to parse data', e)
      return null
    }
  }

  stringifyData(data: any): string {
    return JSON.stringify(data)
  }

  async createResource(
    type: string,
    metadata?: SFFSResourceMetadata,
    tags?: SFFSResourceTag[]
  ): Promise<SFFSResource> {
    this.log.debug('creating resource of type', type)

    // convert metadata and tags to expected format
    const metadataData = JSON.stringify({
      id: '',
      resource_id: '',
      name: metadata?.name ?? '',
      source_uri: metadata?.sourceURI ?? '',
      alt: metadata?.alt ?? '',
      user_context: metadata?.userContext ?? ''
    } as SFFSRawResourceMetadata)

    const tagsData = JSON.stringify(
      (tags ?? []).map(
        (tag) =>
          ({
            id: '',
            resource_id: '',
            tag_name: tag.name ?? '',
            tag_value: tag.value ?? ''
          }) as SFFSRawResourceTag
      )
    )

    const dataString = await this.backend.js__store_create_resource(type, tagsData, metadataData)
    const composite = this.parseData<SFFSRawCompositeResource>(dataString)

    if (!composite) {
      throw new Error('failed to create resource, invalid data', dataString)
    }

    return this.convertCompositeResourceToResource(composite)
  }

  async readResource(id: string): Promise<SFFSResource | null> {
    this.log.debug('reading resource with id', id)
    const dataString = await this.backend.js__store_get_resource(id)
    const composite = this.parseData<SFFSRawCompositeResource>(dataString)
    if (!composite) {
      return null
    }

    return this.convertCompositeResourceToResource(composite)
  }

  async deleteResource(id: string): Promise<void> {
    this.log.debug('deleting resource with id', id)
    await this.backend.js__store_remove_resource(id)
  }

  async recoverResource(id: string): Promise<void> {
    this.log.debug('recovering resource with id', id)
    await this.backend.js__store_recover_resource(id)
  }

  async readResources(): Promise<SFFSResource[]> {
    this.log.debug('reading all resources')
    const items = await this.backend.js__store_get_resources()
    return items.map(this.convertCompositeResourceToResource)
  }

  async searchResources(query: string, tags?: SFFSResourceTag[]): Promise<SFFSSearchResultItem[]> {
    this.log.debug('searching resources with query', query, 'and tags', tags)
    const tagsData = JSON.stringify(
      (tags ?? []).map(
        (tag) =>
          ({
            id: '',
            resource_id: '',
            tag_name: tag.name ?? '',
            tag_value: tag.value ?? '',
            op: tag.op ?? 'eq'
          }) as SFFSRawResourceTag
      )
    )
    const raw = await this.backend.js__store_search_resources(query, tagsData)
    const parsed = this.parseData<SFFSSearchResult>(raw)
    const items = parsed?.items ?? []

    this.log.debug('search results', items)
    return items.map((item) => ({
      ...item,
      engine: item.engine.toLowerCase() as SFFSSearchResultEngine,
      resource: this.convertCompositeResourceToResource(item.resource)
    }))
  }

  async readDataFile(path: string, resourceId: string): Promise<Uint8Array> {
    this.log.debug('reading data file', path)

    await this.fs.openResource(path, resourceId, 'r+')

    const uInt8 = (await this.fs.readResource(resourceId)) as Promise<Uint8Array>

    await this.fs.closeResource(resourceId)

    return uInt8
  }

  async writeDataFile(path: string, resourceId: string, data: Blob): Promise<void> {
    this.log.debug('writing data file', path, data)

    await this.fs.openResource(path, resourceId, 'w')

    const buffer = await data.arrayBuffer()

    await this.fs.writeResource(resourceId, buffer)
    await this.fs.closeResource(resourceId)
  }

  async createHorizon(name: string): Promise<HorizonData> {
    this.log.debug('creating horizon', name)

    const newRawHorizon = await this.backend.js__store_create_horizon(name)
    const newHorizon = this.parseData<SFFSRawHorizon>(newRawHorizon)
    if (!newHorizon) {
      throw new Error('failed to create horizon, invalid data', newRawHorizon)
    }

    const converted = this.convertRawHorizonToHorizon(newHorizon)
    this.log.debug('created horizon', converted)
    return converted
  }

  async getHorizons(): Promise<HorizonData[]> {
    this.log.debug('getting horizons')
    const rawHorizons = await this.backend.js__store_list_horizons()
    this.log.debug('raw horizons', rawHorizons)
    const horizons = this.parseData<SFFSRawHorizon[]>(rawHorizons)
    if (!horizons) {
      return []
    }

    return horizons.map((h) => this.convertRawHorizonToHorizon(h))
  }

  async updateHorizoData(data: HorizonData): Promise<void> {
    this.log.debug('updating horizon', data)
    const rawHorizon = this.convertHorizonToRawHorizon(data)
    const stringUpdates = this.stringifyData(rawHorizon)
    await this.backend.js__store_update_horizon(stringUpdates)
  }

  async deleteHorizon(id: string): Promise<void> {
    this.log.debug('deleting horizon', id)
    await this.backend.js__store_remove_horizon(id)
  }

  async createCard(card: Optional<Card, 'id' | 'stackingOrder'>): Promise<Card> {
    this.log.debug('creating card', card)
    const rawCard = this.convertCardToRawCard(card)
    this.log.debug('raw card', rawCard)

    const stringCard = this.stringifyData(rawCard)
    this.log.debug('string card', stringCard)

    const newRawCard = await this.backend.js__store_create_card(stringCard)
    this.log.debug('new raw card', newRawCard)

    const newCard = this.parseData<SFFSRawCard>(newRawCard)
    this.log.debug('new card', newCard)

    if (!newCard) {
      throw new Error('failed to create card, invalid data', newRawCard)
    }

    return this.convertRawCardToCard(newCard)
  }

  async getCard(id: string): Promise<Card | null> {
    this.log.debug('getting card with id', id)
    const rawCard = await this.backend.js__store_get_card(id)
    const card = this.parseData<SFFSRawCard>(rawCard)
    if (!card) {
      return null
    }

    return this.convertRawCardToCard(card)
  }

  async getCardsForHorizon(horizonId: string): Promise<Card[]> {
    this.log.debug('getting cards for horizon', horizonId)
    const rawCards = await this.backend.js__store_list_cards_in_horizon(horizonId)
    const cards = this.parseData<SFFSRawCard[]>(rawCards)
    this.log.debug('raw cards', cards)
    if (!cards) {
      return []
    }

    const parsed = cards.map((c) => this.convertRawCardToCard(c))
    this.log.debug('parsed cards', parsed)

    return parsed
  }

  async updateCardResource(id: string, resourceId: string | null): Promise<void> {
    this.log.debug('updating card resource', id, resourceId)
    await this.backend.js__store_update_card_resource_id(id, resourceId)
  }

  async updateCardPosition(id: string, pos: CardPosition): Promise<void> {
    this.log.debug('updating card position', id, pos)
    await this.backend.js__store_update_card_dimensions(id, pos.x, pos.y, pos.width, pos.height)
  }

  async updateCardData(id: string, data: Card['data']): Promise<void> {
    this.log.debug('updating card data', id, data)
    await this.backend.js__store_update_card_data(id, JSON.stringify(data))
  }

  async setCardStackingOrderTop(id: string): Promise<void> {
    this.log.debug('updating card stacking order', id)
    await this.backend.js__store_update_card_stacking_order(id)
  }

  async deleteCard(id: string): Promise<void> {
    this.log.debug('deleting card', id)
    await this.backend.js__store_remove_card(id)
  }

  async createHistoryEntry(entry: HistoryEntry): Promise<HistoryEntry> {
    this.log.debug('creating history entry', entry)
    const rawEntry = this.convertHistoryEntryToRawHistoryEntry(entry)
    const stringEntry = this.stringifyData(rawEntry)
    const newRawEntry = await this.backend.js__store_create_history_entry(stringEntry)
    const newEntry = this.parseData<SFFSRawHistoryEntry>(newRawEntry)
    if (!newEntry) {
      throw new Error('failed to create history entry, invalid data', newRawEntry)
    }

    return this.convertRawHistoryEntryToHistoryEntry(newEntry)
  }

  async getHistoryEntry(id: string): Promise<HistoryEntry | null> {
    this.log.debug('getting history entry with id', id)
    const rawEntry = await this.backend.js__store_get_history_entry(id)
    const entry = this.parseData<SFFSRawHistoryEntry>(rawEntry)
    if (!entry) {
      return null
    }

    return this.convertRawHistoryEntryToHistoryEntry(entry)
  }

  async getHistoryEntries(): Promise<HistoryEntry[]> {
    this.log.debug('getting all history entries')
    const rawEntries = await this.backend.js__store_get_all_history_entries()
    const entries = this.parseData<SFFSRawHistoryEntry[]>(rawEntries)
    if (!entries) {
      return []
    }

    return entries.map((e) => this.convertRawHistoryEntryToHistoryEntry(e))
  }

  async updateHistoryEntry(data: Partial<HistoryEntry>): Promise<void> {
    this.log.debug('updating history entry', data)
    const rawEntry = this.convertHistoryEntryToRawHistoryEntry(data as HistoryEntry)
    const stringEntry = this.stringifyData(rawEntry)
    await this.backend.js__store_update_history_entry(stringEntry)
  }

  async deleteHistoryEntry(id: string): Promise<void> {
    this.log.debug('deleting history entry', id)
    await this.backend.js__store_remove_history_entry(id)
  }
}
