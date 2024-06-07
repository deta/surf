import { generateID } from '../utils/id'
import type { SFFSResource } from '../types'
import { HorizonDatabase } from '../service/storage'
import { ResourceManager } from '../service/resources'
import { Telemetry } from '../service/telemetry'

export type Folder = {
  id: string
  name: string
  items: (SFFSResource | Folder | string)[]
  createdAt: string
  updatedAt: string
}

export type FolderMetadata = {
  name: string
  userContext?: string
}

const telemetry = new Telemetry({
  apiKey: '',
  active: false,
  trackHostnames: false
})
const db = new HorizonDatabase()
const resourceManager = new ResourceManager(telemetry)

export const folderManager = {
  async createFolder(name: string, userContext: string): Promise<Folder> {
    const newFolder: Folder = {
      id: generateID(),
      name,
      items: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
    return db.folders.create(newFolder)
  },

  async getFolder(id: string): Promise<Folder | undefined> {
    return db.folders.read(id)
  },

  async updateFolder(id: string, metadata: FolderMetadata): Promise<Folder | undefined> {
    const folder = await db.folders.read(id)
    if (!folder) return undefined

    folder.name = metadata.name
    folder.updatedAt = new Date().toISOString()
    return db.folders.update(id, folder)
  },

  async deleteFolder(id: string): Promise<void> {
    console.log('deleteFolder called with id:', id.detail) // Debugging log
    await db.folders.delete(id.detail)
  },

  async listFolders(): Promise<Folder[]> {
    return db.folders.all()
  },

  async getFolderContents(folderId: string): Promise<(SFFSResource | Folder)[]> {
    const folder = await db.folders.read(folderId)
    if (!folder) return []
    return folder.items
  },

  async addItemToFolder(
    folderId: string,
    item: SFFSResource | Folder
  ): Promise<Folder | undefined> {
    const folder = await db.folders.read(folderId)
    if (!folder) return undefined

    folder.items.push(item.id)
    folder.updatedAt = new Date().toISOString()
    return db.folders.update(folderId, folder)
  },

  async addItemsFromAIResponse(folderId: string, response: string) {
    const { ids } = JSON.parse(response)
    for (const id of ids) {
      const item = await resourceManager.getResource(id)
      if (item) {
        await this.addItemToFolder(folderId, item)
      }
    }
  }
}
