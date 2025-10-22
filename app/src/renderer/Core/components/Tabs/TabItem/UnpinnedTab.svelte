<script lang="ts">
  import { TabItem } from '@deta/services/tabs'
  import BaseTabItem from './BaseTabItem.svelte'

  let {
    tab,
    active,
    width,
    collapsed = false,
    squished = false,
    showCloseButton = true,
    isResizing = false,
    isInPinZone = false
  }: {
    tab: TabItem
    active: boolean
    width?: number
    collapsed?: boolean
    squished?: boolean
    showCloseButton?: boolean
    isResizing?: boolean
    isInPinZone?: boolean
  } = $props()
</script>

<BaseTabItem
  {tab}
  {active}
  {width}
  {collapsed}
  {squished}
  {showCloseButton}
  {isResizing}
  pinned={false}
  {isInPinZone}
/>
