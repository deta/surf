<script lang="ts">
  import { TabItem } from '@deta/services/tabs'
  import VerticalBaseTabItem from './VerticalBaseTabItem.svelte'

  let {
    tab,
    active,
    height,
    isResizing = false
  }: {
    tab: TabItem
    active: boolean
    height?: number
    isResizing?: boolean
  } = $props()
</script>

<VerticalBaseTabItem
  {tab}
  {active}
  {height}
  {isResizing}
  showTitle={true}
  showCloseButton={false}
  showPinIndicator={false}
/>
