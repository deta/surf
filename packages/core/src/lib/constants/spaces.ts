import type { Space, SpaceData } from '../types'

export enum BuiltInSpaceId {
  Everything = 'all',
  Inbox = 'inbox',
  Notes = 'notes',
  AllSpaces = 'all-contexts',
  PinnedSpaces = 'pinned-spaces',
  BrowsingHistory = 'browsing-history'
}

export const BuiltInSpaceEverything = {
  id: BuiltInSpaceId.Everything,
  deleted: 0,
  name: {
    folderName: 'Library',
    description: "Everything you've collected in one place",
    icon: 'save',
    showInSidebar: true,
    liveModeEnabled: false,
    nestingData: {
      hasChildren: true
    }
  } as SpaceData,
  created_at: '',
  updated_at: ''
} as Space

export const BuiltInSpaceInbox = {
  id: BuiltInSpaceId.Inbox,
  deleted: 0,
  name: {
    folderName: 'Inbox',
    description: 'Your recent saves waiting to be organized into contexts',
    icon: 'circle-dot',
    showInSidebar: true,
    liveModeEnabled: false,
    nestingData: {
      hasChildren: true
    }
  } as SpaceData,
  created_at: '',
  updated_at: ''
} as Space

export const BuiltInSpaceNotes = {
  id: BuiltInSpaceId.Notes,
  deleted: 0,
  name: {
    folderName: 'Notes',
    description: 'All your notes in one place',
    icon: 'docs',
    showInSidebar: true,
    liveModeEnabled: false,
    nestingData: {
      hasChildren: true
    }
  } as SpaceData,
  created_at: '',
  updated_at: ''
} as Space

export const BuiltInSpaceAllSpaces = {
  id: BuiltInSpaceId.AllSpaces,
  deleted: 0,
  name: {
    folderName: 'Contexts',
    description: 'All your contexts in one place',
    icon: 'grid',
    showInSidebar: true,
    liveModeEnabled: false,
    nestingData: {
      hasChildren: true
    }
  } as SpaceData,
  created_at: '',
  updated_at: ''
}

export const BuiltInSpacesPinnedSpaces = {
  id: BuiltInSpaceId.PinnedSpaces,
  deleted: 0,
  name: {
    folderName: 'Pinned Contexts ',
    description: 'Your pinned Contexts',
    icon: 'pin',
    showInSidebar: true,
    liveModeEnabled: false,
    nestingData: {
      hasChildren: true
    }
  } as SpaceData,
  created_at: '',
  updated_at: ''
}

export const BuiltInSpaceBrowsingHistory = {
  id: BuiltInSpaceId.BrowsingHistory,
  deleted: 0,
  name: {
    folderName: 'History',
    description: 'Your browsing history across all contexts',
    icon: 'history',
    showInSidebar: true,
    liveModeEnabled: false,
    viewType: 'masonry',
    viewDensity: 'cozy',
    nestingData: {
      hasChildren: true
    }
  } as SpaceData,
  created_at: '',
  updated_at: ''
}

export const BuiltInSpaces = [
  // BuiltInSpacesPinnedSpaces,
  BuiltInSpaceInbox,
  BuiltInSpaceEverything,
  BuiltInSpaceAllSpaces,
  BuiltInSpaceNotes,
  BuiltInSpaceBrowsingHistory
]

export const isBuiltInSpaceId = (id: string) => {
  return Object.values(BuiltInSpaceId).includes(id as BuiltInSpaceId)
}
