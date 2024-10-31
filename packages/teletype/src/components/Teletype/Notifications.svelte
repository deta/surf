<script lang="ts">
  import NotificationWrapper from './NotificationWrapper.svelte'
  import DefaultNotification from './NotificationItem.svelte'

  import { useTeletype } from './index'
  import type { TeletypeSystem } from './index'

  export let item = null
  export let teletype: TeletypeSystem | undefined = undefined
  export let key: string | undefined = undefined

  const tty = teletype || useTeletype(key)
  const notifications = tty.notifications
</script>

<slot />
<div class="notifications">
  {#each $notifications as notification (notification.id)}
    <NotificationWrapper
      {notification}
      {teletype}
      item={item || DefaultNotification}
    />
  {/each}
</div>

<style lang="scss">
  .notifications {
    display: flex;
    flex-direction: column;
  }
</style>
