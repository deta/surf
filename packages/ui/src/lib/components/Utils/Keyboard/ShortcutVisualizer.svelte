<script lang="ts">
  import { isMac } from '@deta/utils/system'
  import KeyCap from './KeyCap.svelte'
  import { onMount, onDestroy, createEventDispatcher } from 'svelte'
  type KeyType = string
  type ShortcutConfig =
    | KeyType[]
    | {
        mac: KeyType[]
        win: KeyType[]
      }
  export let shortcut: ShortcutConfig
  export let size: 'tiny' | 'small' | 'medium' | 'large' = 'medium'
  export let separator: string = '+'
  export let separatorStyle: 'light' | 'dark' = 'light'
  export let interactive = false
  export let showSeparator = false
  export let onSuccess: (() => void) | null = null
  export let color: string | null = null
  // Setup event dispatcher
  const dispatch = createEventDispatcher<{
    success: void
  }>()
  // Success state
  let isSuccess = false
  let successTimeout: ReturnType<typeof setTimeout> | null = null
  // Determine which keys to display based on platform
  $: keysToDisplay = Array.isArray(shortcut) ? shortcut : isMac() ? shortcut.mac : shortcut.win
  // Identify modifier keys for styling purposes
  const modifierKeys = ['cmd', 'ctrl', 'alt', 'option', 'shift']
  $: isModifier = (key: string) => modifierKeys.includes(key.toLowerCase())
  // Map for key detection
  const keyDetectionMap = {
    cmd: (e: KeyboardEvent) => e.metaKey,
    ctrl: (e: KeyboardEvent) => e.ctrlKey,
    alt: (e: KeyboardEvent) => e.altKey,
    option: (e: KeyboardEvent) => e.altKey,
    shift: (e: KeyboardEvent) => e.shiftKey,
    '1': (e: KeyboardEvent) => e.key === '1' || e.code === 'Digit1',
    '2': (e: KeyboardEvent) => e.key === '2' || e.code === 'Digit2',
    '3': (e: KeyboardEvent) => e.key === '3' || e.code === 'Digit3',
    '4': (e: KeyboardEvent) => e.key === '4' || e.code === 'Digit4',
    '5': (e: KeyboardEvent) => e.key === '5' || e.code === 'Digit5',
    '6': (e: KeyboardEvent) => e.key === '6' || e.code === 'Digit6',
    '7': (e: KeyboardEvent) => e.key === '7' || e.code === 'Digit7',
    '8': (e: KeyboardEvent) => e.key === '8' || e.code === 'Digit8',
    '9': (e: KeyboardEvent) => e.key === '9' || e.code === 'Digit9',
    '0': (e: KeyboardEvent) => e.key === '0' || e.code === 'Digit0',
    enter: (e: KeyboardEvent) => e.key === 'Enter',
    return: (e: KeyboardEvent) => e.key === 'Enter',
    tab: (e: KeyboardEvent) => e.key === 'Tab',
    esc: (e: KeyboardEvent) => e.key === 'Escape',
    escape: (e: KeyboardEvent) => e.key === 'Escape',
    space: (e: KeyboardEvent) => e.key === ' ' || e.code === 'Space',
    up: (e: KeyboardEvent) => e.key === 'ArrowUp',
    down: (e: KeyboardEvent) => e.key === 'ArrowDown',
    left: (e: KeyboardEvent) => e.key === 'ArrowLeft',
    right: (e: KeyboardEvent) => e.key === 'ArrowRight',
    a: (e: KeyboardEvent) => e.key === 'a' || e.key === 'A' || e.code === 'KeyA',
    b: (e: KeyboardEvent) => e.key === 'b' || e.key === 'B' || e.code === 'KeyB',
    c: (e: KeyboardEvent) => e.key === 'c' || e.key === 'C' || e.code === 'KeyC',
    d: (e: KeyboardEvent) => e.key === 'd' || e.key === 'D' || e.code === 'KeyD',
    e: (e: KeyboardEvent) => e.key === 'e' || e.key === 'E' || e.code === 'KeyE',
    f: (e: KeyboardEvent) => e.key === 'f' || e.key === 'F' || e.code === 'KeyF',
    g: (e: KeyboardEvent) => e.key === 'g' || e.key === 'G' || e.code === 'KeyG',
    h: (e: KeyboardEvent) => e.key === 'h' || e.key === 'H' || e.code === 'KeyH',
    i: (e: KeyboardEvent) => e.key === 'i' || e.key === 'I' || e.code === 'KeyI',
    j: (e: KeyboardEvent) => e.key === 'j' || e.key === 'J' || e.code === 'KeyJ',
    k: (e: KeyboardEvent) => e.key === 'k' || e.key === 'K' || e.code === 'KeyK',
    l: (e: KeyboardEvent) => e.key === 'l' || e.key === 'L' || e.code === 'KeyL',
    m: (e: KeyboardEvent) => e.key === 'm' || e.key === 'M' || e.code === 'KeyM',
    n: (e: KeyboardEvent) => e.key === 'n' || e.key === 'N' || e.code === 'KeyN',
    o: (e: KeyboardEvent) => e.key === 'o' || e.key === 'O' || e.code === 'KeyO',
    p: (e: KeyboardEvent) => e.key === 'p' || e.key === 'P' || e.code === 'KeyP',
    q: (e: KeyboardEvent) => e.key === 'q' || e.key === 'Q' || e.code === 'KeyQ',
    r: (e: KeyboardEvent) => e.key === 'r' || e.key === 'R' || e.code === 'KeyR',
    s: (e: KeyboardEvent) => e.key === 's' || e.key === 'S' || e.code === 'KeyS',
    t: (e: KeyboardEvent) => e.key === 't' || e.key === 'T' || e.code === 'KeyT',
    u: (e: KeyboardEvent) => e.key === 'u' || e.key === 'U' || e.code === 'KeyU',
    v: (e: KeyboardEvent) => e.key === 'v' || e.key === 'V' || e.code === 'KeyV',
    w: (e: KeyboardEvent) => e.key === 'w' || e.key === 'W' || e.code === 'KeyW',
    x: (e: KeyboardEvent) => e.key === 'x' || e.key === 'X' || e.code === 'KeyX',
    y: (e: KeyboardEvent) => e.key === 'y' || e.key === 'Y' || e.code === 'KeyY',
    z: (e: KeyboardEvent) => e.key === 'z' || e.key === 'Z' || e.code === 'KeyZ'
  }
  // Track active keys for each key in our shortcut
  let activeKeyStates: Record<string, boolean> = {}
  let currentEvent: KeyboardEvent | null = null
  // Update active states based on current keyboard event
  function updateActiveStates() {
    if (!currentEvent) return
    // Handle differently based on event type
    if (currentEvent.type === 'keydown') {
      // For keydown, set keys to active if they match
      keysToDisplay.forEach((key, index) => {
        const lowerKey = key.toLowerCase()
        const keyRef = `key_${index}`
        // Check if we have a detection function for this key
        if (lowerKey in keyDetectionMap) {
          activeKeyStates[keyRef] = keyDetectionMap[lowerKey](currentEvent)
        } else {
          // Fallback for keys not in our map
          activeKeyStates[keyRef] =
            currentEvent.key.toLowerCase() === lowerKey ||
            currentEvent.code.toLowerCase() === lowerKey
        }
      })
    } else if (currentEvent.type === 'keyup') {
      // For keyup, set the specific released key to inactive
      keysToDisplay.forEach((key, index) => {
        const lowerKey = key.toLowerCase()
        const keyRef = `key_${index}`
        // Check if this is the key that was released
        const isThisKeyReleased =
          (lowerKey in keyDetectionMap && !keyDetectionMap[lowerKey](currentEvent)) ||
          currentEvent.key.toLowerCase() === lowerKey ||
          currentEvent.code.toLowerCase() === lowerKey
        // Special handling for modifier keys
        const isModifierKey = ['cmd', 'ctrl', 'alt', 'option', 'shift'].includes(lowerKey)
        // For non-modifier keys that match the released key, set to inactive
        // For modifier keys, check their actual state
        if (!isModifierKey && isThisKeyReleased) {
          activeKeyStates[keyRef] = false
        } else if (isModifierKey) {
          // Update modifier keys based on their current state
          if (lowerKey === 'cmd' || lowerKey === 'ctrl') {
            activeKeyStates[keyRef] = currentEvent.ctrlKey || currentEvent.metaKey
          } else if (lowerKey === 'alt' || lowerKey === 'option') {
            activeKeyStates[keyRef] = currentEvent.altKey
          } else if (lowerKey === 'shift') {
            activeKeyStates[keyRef] = currentEvent.shiftKey
          }
        }
      })
    }
  }
  // Check if all keys in the shortcut are currently pressed
  function checkForSuccess() {
    // Only check on keydown events
    if (!currentEvent || currentEvent.type !== 'keydown' || isSuccess) return
    // Check if all keys are active
    const allKeysActive = Object.values(activeKeyStates).every((isActive) => isActive)
    if (allKeysActive) {
      // Only prevent default if this component has explicit focus or is part of a demo/tutorial
      // This is crucial to avoid interfering with application-wide shortcuts
      const container = document.querySelector('.shortcut-container')
      const isComponentFocused =
        container && (container.contains(document.activeElement) || container.matches(':hover'))
      // Only prevent default in very specific circumstances
      if (isComponentFocused) {
        currentEvent.preventDefault()
      }
      // Set success state
      isSuccess = true
      // Dispatch success event
      dispatch('success')
      // Call onSuccess callback if provided
      if (onSuccess) onSuccess()
      // Clear any existing timeout
      if (successTimeout) clearTimeout(successTimeout)
      // Reset success state after a delay
      successTimeout = setTimeout(() => {
        isSuccess = false
      }, 1000)
    }
  }
  // Check if this component should handle the event
  function shouldHandleEvent(event: KeyboardEvent): boolean {
    // Only handle events if interactive mode is enabled
    if (!interactive) return false
    // Don't handle events if any input element is focused
    const activeElement = document.activeElement
    if (
      activeElement &&
      (activeElement.tagName === 'INPUT' ||
        activeElement.tagName === 'TEXTAREA' ||
        activeElement.getAttribute('contenteditable') === 'true')
    ) {
      return false
    }
    return true
  }
  // Handle key events
  function handleKeyEvent(event: KeyboardEvent) {
    if (!shouldHandleEvent(event)) return
    // Store the current event for state updates
    currentEvent = event
    updateActiveStates()
    // Force Svelte to update by creating a new object
    activeKeyStates = { ...activeKeyStates }
    // Only check for success on keydown events
    if (event.type === 'keydown') {
      checkForSuccess()
    }
    // IMPORTANT: Never call preventDefault() here to avoid interfering with other listeners
    // Only checkForSuccess() will conditionally call preventDefault() when the full shortcut is matched
  }
  let listenerOptions = { passive: true }
  let listenersAttached = false
  // Function to attach event listeners
  function attachListeners() {
    if (interactive && !listenersAttached) {
      window.addEventListener('keydown', handleKeyEvent, listenerOptions)
      window.addEventListener('keyup', handleKeyEvent, listenerOptions)
      listenersAttached = true
    }
  }
  // Function to detach event listeners
  function detachListeners() {
    if (listenersAttached) {
      window.removeEventListener('keydown', handleKeyEvent)
      window.removeEventListener('keyup', handleKeyEvent)
      listenersAttached = false
    }
  }
  // Add event listeners when component mounts
  onMount(() => {
    attachListeners()
    // Return cleanup function
    return () => {
      detachListeners()
      // Clear any pending timeouts
      if (successTimeout) {
        clearTimeout(successTimeout)
        successTimeout = null
      }
    }
  })
  // Make sure listeners are removed when component is destroyed
  onDestroy(detachListeners)
</script>

<div class="shortcut-container" class:tiny={size === 'tiny'}>
  {#each keysToDisplay as key, i}
    {@const keyRef = `key_${i}`}
    <KeyCap
      keySymbol={key}
      {size}
      {color}
      isModifier={isModifier(key)}
      isActive={interactive && activeKeyStates[keyRef]}
      {isSuccess}
    />
    {#if showSeparator && i < keysToDisplay.length - 1}
      <span class="separator" class:dark={separatorStyle === 'dark'}>{separator}</span>
    {/if}
  {/each}
</div>

<style lang="scss">
  @use '@deta/ui/styles/utils' as utils;
  .shortcut-container {
    display: inline-flex;
    align-items: center;
    gap: 0.33rem;
    margin: 0 0.25rem;
    padding: 0.33rem 0.33rem 0.4rem 0.33rem;
    background: light-dark(rgba(255, 255, 255, 0.1), rgba(15, 23, 42, 0.35));
    border-radius: 10px;

    &.tiny {
      margin: 0;
      padding: 0;
      background: none;
    }
  }
  .separator {
    color: light-dark(#ffffff, var(--on-surface-dark, #cbd5f5));
    margin-bottom: 2px;
    &.dark {
      color: light-dark(#9ca3af, var(--text-subtle-dark, #94a3b8));
    }
  }
</style>
