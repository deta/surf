<script lang="ts">
  import { onDestroy } from 'svelte'
  import type { Notification } from './types'
  import type { TeletypeSystem } from '.'
  import type { SvelteComponent } from 'svelte'
  import type { Fn } from '@deta/types'

  type NotificationComponentProps = {
    notification: Notification
    onRemove?: Fn
    onHover?: Fn
    onLeave?: Fn
    onClick?: Fn
  }
  type NotificationComponent = typeof SvelteComponent<NotificationComponentProps>

  let {
    item,
    notification,
    teletype
  }: {
    item: NotificationComponent
    notification: Notification
    teletype: TeletypeSystem
  } = $props()

  const { id, removeAfter, onClick } = notification

  let startTime: number
  let remaining: number
  let timeout: ReturnType<typeof setTimeout> | null = null

  const removeNotificationHandler = () => teletype.removeNotification(id || '')

  const createTimeout = (time: number) => {
    timeout = setTimeout(removeNotificationHandler, time)
    startTime = Date.now()
  }

  if (removeAfter) {
    createTimeout(removeAfter)
  }

  const onHover = () => {
    if (removeAfter && timeout) {
      remaining = removeAfter - (Date.now() - startTime)
      clearTimeout(timeout)
      timeout = null
    }
  }

  const onLeave = () => {
    if (removeAfter && !timeout) createTimeout(remaining)
  }

  const handleClick = () => {
    if (onClick) {
      teletype.clearNotifications()
      onClick(notification, teletype)
    }
  }

  onDestroy(() => {
    if (removeAfter && timeout) clearTimeout(timeout)
  })

  const Item: NotificationComponent = item
</script>

<Item
  {notification}
  {onHover}
  {onLeave}
  onRemove={removeNotificationHandler}
  onClick={handleClick}
/>
