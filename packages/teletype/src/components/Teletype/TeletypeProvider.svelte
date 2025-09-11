<script lang="ts">
  import { provideTeletype } from './index'
  import type { Action, Options } from './types'
  import { useLogScope } from '@deta/utils'

  let {
    actions = [],
    options = {}
  }: {
    actions?: Action[]
    options?: Options
  } = $props()

  const includedActions = []
  const log = useLogScope('TeletypeProvider')

  export const teletype = provideTeletype(options, [...includedActions, ...actions])

  // Update actions when the prop changes (Svelte 5 runes)
  $effect(() => {
    log.debug('Actions changed:', actions, 'length:', actions.length)
    teletype.setActions([...includedActions, ...actions])
  })
  const show = teletype.isShown
  const isOpen = teletype.isOpen
  const captureKeys = teletype.captureKeys
  const storedActions = teletype.actions

  const handleKeyDown = (e: KeyboardEvent) => {
    const target = e.target as HTMLElement

    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault()
      teletype.toggle()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      teletype.close()
    } else if (e.metaKey && $storedActions && $storedActions.length > 0) {
      const action = $storedActions.find((action) => action.shortcut === e.key)
      if (!action) return

      e.preventDefault()
      teletype.executeAction(action)
    }
  }

  let touchTrigger = false
  const handleTouchStart = (e) => {
    if (e.touches.length === 2) {
      touchTrigger = true
    }
  }

  const handleTouchMove = (e) => {
    touchTrigger = false
  }

  const handleTouchEnd = (e) => {
    if (touchTrigger) {
      e.preventDefault()
      teletype.open()
      touchTrigger = false
    }
  }
</script>

<svelte:window
  on:keydown={handleKeyDown}
  on:touchstart={handleTouchStart}
  on:touchend={handleTouchEnd}
  on:touchmove={handleTouchMove}
/>
<slot show={$show} />
