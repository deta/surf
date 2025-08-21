<script lang="ts">
  import { isMac } from '@deta/utils/system'
  export let keySymbol: string
  export let size: 'small' | 'medium' | 'large' = 'medium'
  export let isModifier = false
  export let isActive = false
  export let isSuccess = false
  export let normalizedKey = ''
  // Map common key names to their symbols
  const keySymbols: Record<string, { mac: string; win: string; code?: string }> = {
    cmd: { mac: '⌘', win: 'Ctrl', code: 'Meta' },
    ctrl: { mac: '⌃', win: 'Ctrl', code: 'Control' },
    alt: { mac: '⌥', win: 'Alt', code: 'Alt' },
    option: { mac: '⌥', win: 'Alt', code: 'Alt' },
    shift: { mac: '⇧', win: 'Shift', code: 'Shift' },
    enter: { mac: '↵', win: 'Enter', code: 'Enter' },
    return: { mac: '↵', win: 'Enter', code: 'Enter' },
    tab: { mac: '⇥', win: 'Tab', code: 'Tab' },
    esc: { mac: '⎋', win: 'Esc', code: 'Escape' },
    escape: { mac: '⎋', win: 'Esc', code: 'Escape' },
    delete: { mac: '⌫', win: 'Backspace', code: 'Backspace' },
    backspace: { mac: '⌫', win: 'Backspace', code: 'Backspace' },
    space: { mac: 'Space', win: 'Space', code: 'Space' },
    up: { mac: '↑', win: '↑', code: 'ArrowUp' },
    down: { mac: '↓', win: '↓', code: 'ArrowDown' },
    left: { mac: '←', win: '←', code: 'ArrowLeft' },
    right: { mac: '→', win: '→', code: 'ArrowRight' }
  }
  // Set the normalized key to the lowercase key symbol for consistency
  $: normalizedKey = keySymbol.toLowerCase()
  // Determine the display text based on the key and platform
  $: displayText = (() => {
    const lowerKey = keySymbol.toLowerCase()
    if (lowerKey in keySymbols) {
      return isMac() ? keySymbols[lowerKey].mac : keySymbols[lowerKey].win
    }
    return keySymbol
  })()
</script>

<div
  class="key-wrapper {size} {isSuccess ? 'success' : ''} {isActive ? 'active' : ''} {isModifier
    ? 'modifier'
    : ''}"
  role="img"
  aria-label="{keySymbol} key"
>
  <div class="key-cap">
    {displayText}
  </div>
</div>

<style lang="scss">
  @use '@deta/ui/styles/utils' as utils;
  .key-wrapper {
    display: inline-flex;
    position: relative;
    transition: all 100ms;
    user-select: none;
  }
  .key-cap {
    --fill: #f3f4f6;
    --radius: 7px;
    background: paint(squircle);
    @include utils.squircle($fill: var(--fill), $radius: var(--radius), $smooth: 0.24);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
    font-weight: 500;
    position: relative;
  }
  /* Size variants */
  .key-wrapper.small {
    font-size: 0.75rem;
  }
  .key-wrapper.small .key-cap {
    padding: 0.125rem 0.375rem;
    min-width: 1.5rem;
  }
  .key-wrapper.medium {
    font-size: 0.875rem;
  }
  .key-wrapper.medium .key-cap {
    padding: 0.25rem 0.5rem;
    min-width: 1.75rem;
  }
  .key-wrapper.large {
    font-size: 1rem;
  }
  .key-wrapper.large .key-cap {
    padding: 0.375rem 0.625rem;
    min-width: 2rem;
  }
  /* State variants */
  .key-wrapper:not(.active):not(.success) {
    --key-shadow: #cde0f9;
    filter: drop-shadow(0 1.5px 0px var(--key-shadow));
    .key-cap {
      color: #1f2937;
      --fill: #f3f4f6;
    }
  }
  /* Active state */
  .key-wrapper.active:not(.success) {
    --key-pressed: #e9f3fe;
    transform: translateY(1.5px);
    .key-cap {
      color: #1f2937;
      --fill: var(--key-pressed);
    }
  }
  /* Success state */
  .key-wrapper.success {
    transform: translateY(1.5px);
    .key-cap {
      color: white;
      --fill: #19da89;
    }
  }
  /* Modifier keys */
  .key-wrapper.modifier {
    font-weight: 600;
  }
  /* Dark mode */
  @media (prefers-color-scheme: dark) {
    .key-wrapper:not(.active):not(.success) {
      .key-cap {
        --fill: #374151;
        color: #e5e7eb;
      }
    }
    .key-wrapper.active:not(.success) {
      .key-cap {
        --fill: #2563eb;
      }
    }
    .key-wrapper.success {
      .key-cap {
        --fill: #059669;
      }
    }
  }
</style>
