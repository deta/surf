<script lang="ts">
  import { TabItem } from '@deta/services/tabs'
  import BaseTabItem from './BaseTabItem.svelte'

  let {
    tab,
    active,
    isResizing = false,
    isInPinZone = false
  }: {
    tab: TabItem
    active: boolean
    isResizing?: boolean
    isInPinZone?: boolean
  } = $props()
</script>

<BaseTabItem
  {tab}
  {active}
  width={40}
  collapsed={false}
  squished={false}
  showCloseButton={false}
  {isResizing}
  pinned={true}
  {isInPinZone}
/>
