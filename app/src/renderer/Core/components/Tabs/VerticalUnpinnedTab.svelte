<script lang="ts">
  import { TabItem } from '@deta/services/tabs'
  import VerticalBaseTabItem from './VerticalBaseTabItem.svelte'

  let {
    tab,
    active,
    height,
    showCloseButton = true,
    isResizing = false
  }: {
    tab: TabItem
    active: boolean
    height?: number
    showCloseButton?: boolean
    isResizing?: boolean
  } = $props()
</script>

<VerticalBaseTabItem
  {tab}
  {active}
  {height}
  {showCloseButton}
  {isResizing}
  showTitle={true}
  showPinIndicator={false}
/>
