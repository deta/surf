import { BROWSER_TYPE_DATA, ResourceTagDataStateValue, type BrowserType } from '@horizon/types'
import { useLogScope } from '@horizon/utils'

import { type Resource, type ResourceManager } from './resources'
import type { OasisService } from './oasis'
import { SpaceEntryOrigin } from '../types'
import { ResourceTag } from '@horizon/core/src/lib/utils/tags'

export class Importer {
  log: ReturnType<typeof useLogScope>
  resourceManager: ResourceManager
  oasis: OasisService

  constructor(resourceManager: ResourceManager, oasis: OasisService) {
    this.log = useLogScope('Importer')
    this.resourceManager = resourceManager
    this.oasis = oasis
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
        let space = this.oasis.spacesObjectsValue.find(
          (space) =>
            space.dataValue.folderName === folder.title ||
            space.dataValue.folderName === formattedTitle
        )

        if (!space) {
          space = await this.oasis.createSpace({
            folderName: formattedTitle,
            showInSidebar: true,
            imported: true
          })
        } else {
          await space.updateData({
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

        await this.oasis.addResourcesToSpace(
          space.id,
          resources.map((r) => r.id),
          SpaceEntryOrigin.ManuallyAdded
        )
      })
    )

    this.log.debug('imported resources', importedResources)
    return importedResources
  }

  static create(service: { resourceManager: ResourceManager; oasis: OasisService }) {
    const { resourceManager, oasis } = service
    return new Importer(resourceManager, oasis)
  }
}
