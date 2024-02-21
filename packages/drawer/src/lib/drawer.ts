import { getContext, setContext } from 'svelte'
import { get, writable, type Writable } from 'svelte/store'

export type Size = 'minimal' | 'normal' | 'full'
export type SearchQuery = {
  value: string
  tab: string | null
}

export class Drawer {
  size: Writable<Size>
  show: Writable<boolean>
  searchValue: Writable<string>
  selectedTab: Writable<string | null>

  searchHandler?: (query: SearchQuery) => void

  constructor() {
    this.size = writable('normal')
    this.show = writable(false)
    this.searchValue = writable('')
    this.selectedTab = writable(null)
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
export { default as DrawerNavigation } from './Navigation.svelte'
export { default as DrawerContent } from './Content.svelte'
export { default as DrawerContentItem } from './ContentItem.svelte'
