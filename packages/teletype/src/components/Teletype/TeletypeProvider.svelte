<script lang="ts">
  import { provideTeletype } from './index'
  import type { Action, Options } from './types'

  export let actions: Action[] = []

  export let options: Options = {}

  const includedActions = []

  export const teletype = provideTeletype(options, [
    ...includedActions,
    ...actions,
  ])
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
      const action = $storedActions.find(action => action.shortcut === e.key)
      if (!action) return

      e.preventDefault()
      teletype.executeAction(action)
    } else if (!e.metaKey && !e.ctrlKey && !e.altKey) {
      // Prevent teletype from capturing keys targeting other inputs
      const defaultTTY = document.getElementById('tty-default')
      const shouldPreventCapture =
        (['INPUT', 'TEXTAREA'].includes(target.tagName) &&
          target.id !== 'teletype-input-default') ||
        target.hasAttribute('contenteditable')
      if (shouldPreventCapture) return

      const letters = e.key.match(/[A-Za-z]/g)
      const isLetter = e.key.length === 1 && letters !== null

      if (!$isOpen && $captureKeys && isLetter) {
        e.preventDefault()
        teletype.openWithText(e.key)
      }
    }
  }

  let touchTrigger = false
  const handleTouchStart = e => {
    if (e.touches.length === 2) {
      touchTrigger = true
    }
  }

  const handleTouchMove = e => {
    touchTrigger = false
  }

  const handleTouchEnd = e => {
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
