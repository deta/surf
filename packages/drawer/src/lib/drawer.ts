import { getContext, setContext } from 'svelte'
import { get, writable, type Writable } from 'svelte/store'

export type Size = 'minimal' | 'normal' | 'full'
export type SearchQuery = {
  value: string
  tab: string | null
}

export const VIEW_STATES = {
  CHAT_INPUT: 'chatInput',
  SEARCH: 'search',
  DEFAULT: 'default',
  DETAILS: 'details'
}

export type ViewState = (typeof VIEW_STATES)[keyof typeof VIEW_STATES]

export class Drawer {
  size: Writable<Size>
  show: Writable<boolean>
  searchValue: Writable<string>
  selectedTab: Writable<string | null>
  viewState: Writable<ViewState>

  searchHandler?: (query: SearchQuery) => void

  constructor() {
    this.size = writable('normal')
    this.show = writable(false)
    this.searchValue = writable('')
    this.selectedTab = writable(null)
    this.viewState = writable(VIEW_STATES.DEFAULT)
  }

  onSearch(callback: typeof Drawer.prototype.searchHandler) {
    this.searchHandler = callback
  }

  open() {
    this.show.set(true)
  }

  close() {
    this.show.set(false)
  }

  toggle() {
    this.show.update((value) => !value)
  }

  setSize(size: Size) {
    this.size.set(size)
  }

  getSize() {
    return get(this.size)
  }

  isShown() {
    return get(this.show)
  }

  search({ value, tab }: Partial<SearchQuery>) {
    if (value) {
      this.searchValue.set(value)
    }

    if (tab) {
      this.selectedTab.set(tab)
    }

    if (this.searchHandler) {
      this.searchHandler({
        value: value ?? get(this.searchValue),
        tab: tab ?? get(this.selectedTab)
      })
    } else {
      console.warn('No search handler provided')
    }
  }

  static provideDrawer(key: string = 'drawer') {
    const drawer = new Drawer()

    return setContext(key, drawer)
  }

  static useDrawer(key: string = 'drawer') {
    return getContext(key) as Drawer
  }
}

export const provideDrawer = Drawer.provideDrawer
export const useDrawer = Drawer.useDrawer

export { default as DrawerProvider } from './Drawer.svelte'
export { default as DrawerSearch } from './Search.svelte'
export { default as DrawerChat } from './Chat.svelte'
export { default as DrawerCancel } from './components/Cancellation.svelte'
export { default as DrawerNavigation } from './Navigation.svelte'
export { default as DrawerContentWrapper } from './ContentWrapper.svelte'
export { default as DrawerContentItem } from './ContentItem.svelte'
export { default as DrawerContentMasonry } from './ContentMasonry.svelte'
export { default as DrawerContenEmpty } from './ContentEmpty.svelte'
export { default as DrawerDetailsProximity } from './components/DrawerDetailsProximity.svelte'
export { default as ResourceOverlay } from './components/ResourceOverlay.svelte'
export { default as AlreadyDroppedTooltip } from './components/AlreadyDroppedTooltip.svelte'
