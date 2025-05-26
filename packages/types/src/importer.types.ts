export enum BrowserType {
  Chrome = 'chrome',
  Firefox = 'firefox',
  Safari = 'safari',
  Edge = 'edge',
  Brave = 'brave',
  Opera = 'opera',
  Vivaldi = 'vivaldi',
  Arc = 'arc',
  Dia = 'dia',
  Tor = 'tor',
  Waterfox = 'waterfox',
  Zen = 'zen'
}

export enum BrowserFamily {
  Chromium = 'chromium',
  Firefox = 'firefox',
  Safari = 'safari'
}

export type BrowserTypeItem = {
  name: string
  type: BrowserType
  family: BrowserFamily
  icon: string
  supports: {
    history: boolean
    bookmarks: boolean
  }
}

export const BROWSER_TYPE_DATA: BrowserTypeItem[] = [
  {
    name: 'Chrome',
    type: BrowserType.Chrome,
    family: BrowserFamily.Chromium,
    icon: 'browser.chrome',
    supports: {
      history: true,
      bookmarks: true
    }
  },
  {
    name: 'Edge',
    type: BrowserType.Edge,
    family: BrowserFamily.Chromium,
    icon: 'browser.edge',
    supports: {
      history: true,
      bookmarks: true
    }
  },
  {
    name: 'Firefox',
    type: BrowserType.Firefox,
    family: BrowserFamily.Firefox,
    icon: 'browser.firefox',
    supports: {
      history: true,
      bookmarks: true
    }
  },
  {
    name: 'Opera',
    type: BrowserType.Opera,
    family: BrowserFamily.Chromium,
    icon: 'browser.opera',
    supports: {
      history: true,
      bookmarks: true
    }
  },
  {
    name: 'Arc',
    type: BrowserType.Arc,
    family: BrowserFamily.Chromium,
    icon: 'browser.arc',
    supports: {
      history: true,
      bookmarks: false
    }
  },
  // disabled for now
  // { name: 'Safari', type: BrowserType.Safari, family: BrowserFamily.Safari, icon: 'world' },
  {
    name: 'Brave',
    type: BrowserType.Brave,
    family: BrowserFamily.Chromium,
    icon: 'browser.brave',
    supports: {
      history: true,
      bookmarks: true
    }
  },
  {
    name: 'Vivaldi',
    type: BrowserType.Vivaldi,
    family: BrowserFamily.Chromium,
    icon: 'browser.vivaldi',
    supports: {
      history: true,
      bookmarks: true
    }
  },
  // { name: 'Dia', type: BrowserType.Dia, family: BrowserFamily.Chromium, icon: 'world' },
  {
    name: 'Tor',
    type: BrowserType.Tor,
    family: BrowserFamily.Firefox,
    icon: 'browser.tor',
    supports: {
      history: false,
      bookmarks: true
    }
  },
  // { name: 'Waterfox', type: BrowserType.Waterfox, family: BrowserFamily.Firefox, icon: 'world' },
  {
    name: 'Zen',
    type: BrowserType.Zen,
    family: BrowserFamily.Firefox,
    icon: 'browser.zen',
    supports: {
      history: true,
      bookmarks: true
    }
  }
]

export const PRIMARY_BROWSRS = [
  BrowserType.Chrome,
  BrowserType.Edge,
  BrowserType.Firefox,
  BrowserType.Opera,
  BrowserType.Arc
]

export type BookmarkItem = {
  guid: string
  title: string
  url: string
  createdAt: string
  updatedAt: string
  lastUsedAt: string
}

export type BookmarkFolder = {
  guid: string
  title: string
  createdAt: string
  updatedAt: string
  lastUsedAt: string
  children: BookmarkItem[]
}
