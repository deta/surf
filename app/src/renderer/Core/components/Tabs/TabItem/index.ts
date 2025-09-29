import BaseTabItem from './BaseTabItem.svelte'
import PinnedTabComponent from './PinnedTab.svelte'
import UnpinnedTabComponent from './UnpinnedTab.svelte'

// Create the main TabItem object with dot notation components
const TabItem = Object.assign(BaseTabItem, {
  Pinned: PinnedTabComponent,
  Unpinned: UnpinnedTabComponent
})

export { TabItem as default, TabItem }
export { BaseTabItem, PinnedTabComponent as Pinned, UnpinnedTabComponent as Unpinned }
