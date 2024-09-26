import type { Tab, CreateTabOptions, TabPage, TabOnboarding } from '../types/browser.types'
import type { Optional, Space, SpaceData } from '../types'
import { ResourceManager, ResourceTag } from './resources'
import { extractAndCreateWebResource } from './mediaImporter'
import type { useOasis } from './oasis'
import { builtInSpaces } from '../constants/examples'
import { useLogScope } from '@horizon/utils'
import type { TabsManager } from './tabs'

const log = useLogScope('DemoItems')

export function random() {
  return Math.floor(Math.random() * 1000000)
}

export const factoryData = {
  tabPage: (id: number, url: string, pinned: boolean): TabPage => ({
    id: id.toString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    title: 'Page',
    icon: '',
    type: 'page',
    archived: false,
    index: 0,
    pinned: pinned,
    magic: false,
    initialLocation: url,
    currentLocation: url,
    historyStackIds: ['1'],
    currentHistoryIndex: 0,
    resourceBookmark: null,
    resourceBookmarkedManually: false,
    chatResourceBookmark: null,
    chatId: null,
    appId: null,
    currentDetectedApp: undefined
  })
}

export async function createDemoItems(
  tabsManager: TabsManager,
  oasis: ReturnType<typeof useOasis>,
  createSpaceTab: any,
  resourceManager: ResourceManager
) {
  for (const builtInSpace of builtInSpaces) {
    const data = Object.assign(
      {
        folderName: 'New Space',
        colors: ['#76E0FF', '#4EC9FB'],
        showInSidebar: false,
        liveModeEnabled: false,
        hideViewed: false,
        smartFilterQuery: null,
        sql_query: null,
        embedding_query: null,
        sortBy: 'created_at',
        builtIn: true
      },
      builtInSpace
    ) as SpaceData
    const space = await oasis.createSpace(data)
    log.debug('Created built-in space:', space)
  }

  //   if (demoSpace.urls) {
  //     const urls = demoSpace.urls

  //     const resources = await Promise.all(
  //       urls.map(async (url) => {
  //         const { resource } = await extractAndCreateWebResource(
  //           resourceManager,
  //           url,
  //           {
  //             sourceURI: url
  //           },
  //           [ResourceTag.canonicalURL(url)]
  //         )
  //         return resource.id
  //       })
  //     )

  //     oasis.addResourcesToSpace(space.id, resources)
  //   }

  //   createSpaceTab(space, false)
  // }

  // for (const space of liveSpaces) {
  //   const liveSpace = await oasis.createSpace({
  //     folderName: space.name,
  //     showInSidebar: space.active,
  //     colors: ['#FFD700', '#FF8C00'],
  //     sources: [
  //       {
  //         id: '1',
  //         name: space.name,
  //         type: 'rss',
  //         url: space.rss,
  //         last_fetched_at: null
  //       }
  //     ],
  //     sortBy: 'source_published_at',
  //     liveModeEnabled: true
  //   })

  //   if (space.active) {
  //     createSpaceTab(liveSpace, false)
  //   }
  // }

  // await new Promise((resolve) => setTimeout(resolve, 1000))

  // demoPages.forEach((page) => {
  //   tabManager.addPageTab(page.url, {
  //     active: page.active ?? false
  //   }, {
  //     pinned: page.pinned ?? false
  //   })
  // })

  await tabsManager.create<TabOnboarding>(
    {
      title: 'Welcome To Surf',
      icon: 'https://deta.surf/favicon-32x32.png',
      type: 'onboarding',
      pinned: true
    },
    { active: true }
  )
}
