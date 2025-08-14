import { isDev, useLogScope, generateID, optimisticParseJSON, type ScopedLogger } from '@deta/utils'
import type { Optional } from '@deta/types'

export type BaseKVItem = {
  id: string
  createdAt: string
  updatedAt: string
}

export class KVStore<T extends BaseKVItem> {
  backend: any
  log: ScopedLogger
  tableName: string

  ready: Promise<void>

  constructor(tableName: string) {
    this.log = useLogScope('KVStore')
    this.tableName = tableName

    // @ts-ignore
    if (typeof window.backend === 'undefined') {
      throw new Error('SFFS backend not available')
    }

    // @ts-ignore
    this.backend = window.backend.sffs

    if (isDev) {
      // @ts-ignore
      window.sffs_kv = this
    }

    if (!this.backend) {
      throw new Error('SFFS backend failed to initialize')
    }

    // Create the table if it doesn't exist yet
    this.ready = this.createTable()
  }

  private async createTable(): Promise<void> {
    try {
      await this.backend.js__kv_create_table(this.tableName)
      this.log.debug(`Table "${this.tableName}" created or verified`)
    } catch (error) {
      this.log.error(`Failed to create table "${this.tableName}":`, error)
      throw error
    }
  }

  async create(data: Optional<T, 'id' | 'createdAt' | 'updatedAt'>): Promise<T> {
    const datetime = new Date().toISOString()
    const id = data.id ?? generateID()
    const item = {
      ...data,
      id,
      createdAt: datetime,
      updatedAt: datetime
    } as T

    try {
      await this.backend.js__kv_put(this.tableName, id, JSON.stringify(item))
      this.log.debug(`Created item in "${this.tableName}" with ID: ${id}`)
      return item
    } catch (error) {
      this.log.error(`Failed to create item in "${this.tableName}":`, error)
      throw error
    }
  }

  async all(): Promise<T[]> {
    try {
      const items = optimisticParseJSON<T[]>(await this.backend.js__kv_list(this.tableName))
      if (!items) {
        return []
      }
      return items
    } catch (error) {
      this.log.error(`Failed to get all items from "${this.tableName}":`, error)
      throw error
    }
  }

  async read(id: string): Promise<T | undefined> {
    try {
      const result = await this.backend.js__kv_get(this.tableName, id)
      if (!result) {
        return undefined
      }
      const parsed = optimisticParseJSON<T>(result)
      return parsed ?? undefined
    } catch (error) {
      this.log.error(`Failed to read item with ID ${id} from "${this.tableName}":`, error)
      throw error
    }
  }

  async update(id: string, updatedItem: Partial<T>): Promise<number> {
    try {
      updatedItem.updatedAt = new Date().toISOString()
      await this.backend.js__kv_update(this.tableName, id, JSON.stringify(updatedItem))
      this.log.debug(`Updated item with ID ${id} in "${this.tableName}"`)
      return 1
    } catch (error) {
      this.log.error(`Failed to update item with ID ${id} in "${this.tableName}":`, error)
      throw error
    }
  }

  async delete(id: string): Promise<void> {
    try {
      await this.backend.js__kv_delete(this.tableName, id)
      this.log.debug(`Deleted item with ID ${id} from "${this.tableName}"`)
    } catch (error) {
      this.log.error(`Failed to delete item with ID ${id} from "${this.tableName}":`, error)
      throw error
    }
  }

  async bulkUpdate(items: { id: string; updates: Partial<T> }[]): Promise<void> {
    const datetime = new Date().toISOString()

    try {
      await Promise.all(
        items.map(async ({ id, updates }) => {
          await this.update(id, { updatedAt: datetime, ...updates })
        })
      )
      this.log.debug(`Bulk updated ${items.length} items in "${this.tableName}"`)
    } catch (error) {
      this.log.error(`Failed to bulk update items in "${this.tableName}":`, error)
      throw error
    }
  }

  static useTable<T extends BaseKVItem>(tableName: string): KVStore<T> {
    return new KVStore<T>(tableName)
  }
}

export const useKVTable = KVStore.useTable
