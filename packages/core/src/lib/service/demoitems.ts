import { derived, writable } from 'svelte/store'
import type { TabPage } from '../types/browser.types'
import type { SpaceData } from '../types'
import { SpaceEntryOrigin } from '../types'
import { ResourceManager, ResourceTag } from './resources'
import { extractAndCreateWebResource } from './mediaImporter'
import type { useOasis } from './oasis'
import { builtInSpaces, onboardingSpace } from '../constants/examples'
import { useLogScope } from '@horizon/utils'
import type { TabsManager } from './tabs'
import { ONBOARDING_NOTES } from '../constants/notes'

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
  // Load all spaces once at the start to avoid duplicated spaces
  const existingSpaces = await oasis.loadSpaces()

  // for (const builtInSpace of builtInSpaces) {
  //   const existingSpace = existingSpaces.find(
  //     (space) => space.name.folderName === builtInSpace.folderName
  //   )
  //   log.debug('Checking built-in space:', builtInSpace.folderName, 'exists:', !!existingSpace)

  //   if (!existingSpace) {
  //     const data = Object.assign(
  //       {
  //         folderName: 'New Space',
  //         colors: ['#76E0FF', '#4EC9FB'],
  //         showInSidebar: false,
  //         liveModeEnabled: false,
  //         hideViewed: false,
  //         smartFilterQuery: null,
  //         sql_query: null,
  //         embedding_query: null,
  //         sortBy: 'created_at',
  //         builtIn: true
  //       },
  //       builtInSpace
  //     ) as SpaceData
  //     const space = await oasis.createSpace(data)
  //     log.debug('Created built-in space:', space)
  //   }
  // }

  const existingOnboardingSpace = existingSpaces.find(
    (space) => space.name.folderName === onboardingSpace.name
  )
  log.debug('Checking onboarding space exists:', !!existingOnboardingSpace)

  if (!existingOnboardingSpace) {
    log.debug('Creating onboarding space')
    await createOnboardingSpace(tabsManager, oasis, createSpaceTab, resourceManager)
  }

  const onboardingTab = tabsManager.tabsValue.find((tab) => tab.type === 'onboarding')
  log.debug('Checking onboarding tab exists:', !!onboardingTab)

  if (!onboardingTab) {
    log.debug('Creating onboarding tab')
    await tabsManager.addOnboardingTab()
  }
}

export async function createOnboardingSpace(
  tabsManager: TabsManager,
  oasis: ReturnType<typeof useOasis>,
  createSpaceTab: any,
  resourceManager: ResourceManager
) {
  const space = await oasis.createSpace({
    folderName: onboardingSpace.name,
    showInSidebar: true,
    colors: ['#FFD700', '#FF8C00'],
    builtIn: true
  })

  if (onboardingSpace.urls) {
    const urls = onboardingSpace.urls

    const resources = await Promise.all(
      urls.map(async (url) => {
        const { resource } = await extractAndCreateWebResource(
          resourceManager,
          url,
          {
            sourceURI: url
          },
          [ResourceTag.canonicalURL(url)]
        )
        return resource.id
      })
    )

    await oasis.addResourcesToSpace(space.id, resources, SpaceEntryOrigin.ManuallyAdded)
  }
}

export function useOnboardingNote() {
  const currentNoteIdx = writable(0)
  const noteContent = writable('')

  const currentNote = derived(currentNoteIdx, ($currentNoteIdx) => {
    const note = ONBOARDING_NOTES[$currentNoteIdx]
    if (!note) {
      return ONBOARDING_NOTES[0]
    }

    noteContent.set(note.html)

    return note
  })

  const canGoNext = derived(
    currentNoteIdx,
    ($currentNoteIdx) => $currentNoteIdx < ONBOARDING_NOTES.length - 1
  )
  const canGoPrev = derived(currentNoteIdx, ($currentNoteIdx) => $currentNoteIdx > 0)

  const next = () => {
    currentNoteIdx.update(($currentNoteIdx) => {
      return ($currentNoteIdx + 1) % ONBOARDING_NOTES.length
    })
  }

  const prev = () => {
    currentNoteIdx.update(($currentNoteIdx) => {
      return ($currentNoteIdx - 1 + ONBOARDING_NOTES.length) % ONBOARDING_NOTES.length
    })
  }

  const start = () => {
    currentNoteIdx.set(1)
  }

  const reset = () => {
    currentNoteIdx.set(0)
  }

  return {
    notes: ONBOARDING_NOTES,
    idx: currentNoteIdx,
    note: currentNote,
    content: noteContent,
    canGoNext,
    canGoPrev,
    next,
    prev,
    start,
    reset
  }
}
