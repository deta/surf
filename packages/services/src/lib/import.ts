import {
  BROWSER_TYPE_DATA,
  ResourceTagDataStateValue,
  SpaceEntryOrigin,
  type BrowserType
} from '@deta/types'
import { useLogScope } from '@deta/utils/io'
import { ResourceTag } from '@deta/utils/formatting'

import { type Resource, type ResourceManager } from './resources'
import { NotebookManager } from './notebooks'

export class Importer {
  log: ReturnType<typeof useLogScope>
  resourceManager: ResourceManager
  notebookManager: NotebookManager

  constructor(resourceManager: ResourceManager, notebookManager: NotebookManager) {
    this.log = useLogScope('Importer')
    this.resourceManager = resourceManager
    this.notebookManager = notebookManager
  }

  async importHistory(type: BrowserType) {
    const items = await this.resourceManager.sffs.importBrowserHistory(type)
    this.log.debug('imported browser history', items)
    return items
  }

  async importBookmarks(type: BrowserType) {
    const folders = await this.resourceManager.sffs.importBrowserBookmarks(type)
    this.log.debug('imported browser bookmarks', folders)

    const importedResources: Resource[] = []
    const browserMetadata = BROWSER_TYPE_DATA.find((item) => item.type === type)

    await Promise.all(
      folders.map(async (folder) => {
        this.log.debug('creating space for folder', folder)

        const formattedTitle = folder.title.toLowerCase().includes(type)
          ? folder.title
          : `${folder.title} - ${browserMetadata?.name ?? type}`

        // check if the folder already exists
        const notebooks = Array.from(this.notebookManager.notebooks.values())
        let notebook = notebooks.find(
          (notebook) => notebook.nameValue === folder.title || notebook.nameValue === formattedTitle
        )

        if (!notebook) {
          notebook = await this.notebookManager.createNotebook({
            name: formattedTitle,
            imported: true
          })
        } else {
          await notebook.updateData({
            imported: true
          })
        }

        let resources: Resource[] = []

        await Promise.all(
          folder.children.map(async (item) => {
            const resource = await this.resourceManager.createResourceLink(
              {
                title: item.title,
                url: item.url
              },
              {
                name: item.title,
                sourceURI: item.url
              },
              [ResourceTag.import(), ResourceTag.dataState(ResourceTagDataStateValue.PARTIAL)]
            )

            resources.push(resource)
            importedResources.push(resource)
          })
        )

        await this.notebookManager.addResourcesToNotebook(
          notebook.id,
          resources.map((r) => r.id),
          SpaceEntryOrigin.ManuallyAdded
        )
      })
    )

    this.log.debug('imported resources', importedResources)
    return importedResources
  }

  static create(service: { resourceManager: ResourceManager; notebookManager: NotebookManager }) {
    const { resourceManager, notebookManager } = service
    return new Importer(resourceManager, notebookManager)
  }
}
