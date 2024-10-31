<script lang="ts">
  import { onDestroy } from 'svelte'
  import type { Notification } from './types'
  import type { TeletypeSystem } from '.'

  export let item
  export let notification: Notification
  export let teletype: TeletypeSystem

  const { id, removeAfter, onClick } = notification

  let startTime
  let remaining
  let timeout = null

  const removeNotificationHandler = () => teletype.removeNotification(id)

  const createTimeout = time => {
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
</script>

<svelte:component
  this={item}
  {notification}
  {onHover}
  {onLeave}
  onRemove={removeNotificationHandler}
  onClick={handleClick}
/>
