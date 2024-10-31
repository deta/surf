import Home from './Home.svelte'
import Docs from './Docs.svelte'
import Terminal from './Terminal.svelte'
import Close from './Close.svelte'
import Check from './Check.svelte'
import DocSearch from './DocSearch.svelte'
import Support from './Support.svelte'
import Info from './Info.svelte'

// TODO: automate the import
export enum Icons {
  HOME = 'home',
  DOCS = 'docs',
  TERMINAL = 'terminal',
  CLOSE = 'close',
  CHECK = 'check',
  DOC_SEARCH = 'doc_search',
  SUPPORT = 'support',
  INFO = 'info'
}

export const components = {
  [Icons.HOME]: Home,
  [Icons.DOCS]: Docs,
  [Icons.TERMINAL]: Terminal,
  [Icons.CLOSE]: Close,
  [Icons.CHECK]: Check,
  [Icons.DOC_SEARCH]: DocSearch,
  [Icons.SUPPORT]: Support,
  [Icons.INFO]: Info
}
