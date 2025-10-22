<script lang="ts">
  import NotificationWrapper from './NotificationWrapper.svelte'
  import DefaultNotification from './NotificationItem.svelte'

  import { type TeletypeSystem, useTeletype } from './index'
  import type { SvelteComponent } from 'svelte'
  import type { Fn } from '@deta/types'
  import type { Notification } from './types'

  type NotificationComponentProps = {
    notification: Notification
    onRemove?: Fn
    onHover?: Fn
    onLeave?: Fn
    onClick?: Fn
  }
  type NotificationComponent = typeof SvelteComponent<NotificationComponentProps>

  let {
    item = null,
    teletype,
    key
  }: {
    item?: NotificationComponent | null
    teletype?: TeletypeSystem
    key?: string
  } = $props()

  const tty = teletype || useTeletype(key)
  const notifications = tty.notifications
</script>

<slot />
<div class="notifications">
  {#each $notifications as notification (notification.id)}
    <NotificationWrapper {notification} {teletype} item={item || DefaultNotification} />
  {/each}
</div>

<style lang="scss">
  .notifications {
    display: flex;
    flex-direction: column;
  }
</style>
