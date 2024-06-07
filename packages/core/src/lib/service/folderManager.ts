import { generateID } from '../utils/id'
import type { SFFSResource } from '../types'
import { HorizonDatabase } from '../service/storage'

export type Folder = {
  id: string
  name: string
  items: (SFFSResource | Folder)[]
  createdAt: string
  updatedAt: string
}

export type FolderMetadata = {
  name: string
  userContext?: string
}

const db = new HorizonDatabase()

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

    folder.items.push(item)
    folder.updatedAt = new Date().toISOString()
    return db.folders.update(folderId, folder)
  }
}
