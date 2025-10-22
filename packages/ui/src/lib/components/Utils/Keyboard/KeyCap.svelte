<script lang="ts">
  import { isMac } from '@deta/utils/system'
  import { lighten, darken, getContrastColor } from '@deta/utils/dom'
  export let keySymbol: string
  export let size: 'tiny' | 'small' | 'medium' | 'large' = 'medium'
  export let isModifier = false
  export let isActive = false
  export let isSuccess = false
  export let normalizedKey = ''
  export let color: string | null = null
  // Map common key names to their symbols
  const keySymbols: Record<string, { mac: string; win: string; code?: string }> = {
    cmd: { mac: '⌘', win: 'Ctrl', code: 'Meta' },
    ctrl: { mac: '⌃', win: 'Ctrl', code: 'Control' },
    alt: { mac: '⌥', win: 'Alt', code: 'Alt' },
    option: { mac: '⌥', win: 'Alt', code: 'Alt' },
    shift: { mac: '⇧', win: 'Shift', code: 'Shift' },
    enter: { mac: '⏎', win: 'Enter', code: 'Enter' },
    return: { mac: '⏎', win: 'Enter', code: 'Enter' },
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


  // Calculate color variants when custom color is provided
  $: colorVariants = color ? {
    fill: color,
    pressed: darken(color, 0.1),
    text: getContrastColor(color),
    shadow: lighten(color, 0.2)
  } : null
</script>

<div
  class="key-wrapper {size} {isSuccess ? 'success' : ''} {isActive ? 'active' : ''} {isModifier
    ? 'modifier'
    : ''}"
  class:custom-color={!!color}
  style={colorVariants ? `
    --custom-fill: ${colorVariants.fill};
    --custom-pressed: ${colorVariants.pressed};
    --custom-text: ${colorVariants.text};
    --custom-shadow: ${colorVariants.shadow};
  ` : ''}
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
    font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
  }
  .key-cap {
    --fill: light-dark(#f3f4f6, #374151);
    --radius: 7px;
    background: var(--fill);
    border-radius: var(--radius);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
    font-weight: 500;
    position: relative;
    color: light-dark(#1f2937, #e5e7eb);
  }
  /* Size variants */
  .key-wrapper.tiny {
    font-size: 0.65rem;
  }
  .key-wrapper.tiny .key-cap {
    padding: 0.0625rem 0.25rem;
    min-width: 1.25rem;
  }
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
    --key-shadow: light-dark(#cde0f9, rgba(15, 23, 42, 0.5));
    filter: drop-shadow(0 1.5px 0px var(--key-shadow));
    .key-cap {
      color: light-dark(#1f2937, #e5e7eb);
      --fill: light-dark(#f3f4f6, #374151);
    }
    
    &.custom-color {
      --key-shadow: var(--custom-shadow);
      .key-cap {
        color: var(--custom-text);
        --fill: var(--custom-fill);
      }
    }
  }
  /* Active state */
  .key-wrapper.active:not(.success) {
    --key-pressed: light-dark(#e9f3fe, #2563eb);
    transform: translateY(1.5px);
    .key-cap {
      color: light-dark(#1f2937, #e5e7eb);
      --fill: var(--key-pressed);
    }
    
    &.custom-color {
      .key-cap {
        color: var(--custom-text);
        --fill: var(--custom-pressed);
      }
    }
  }
  /* Success state */
  .key-wrapper.success {
    transform: translateY(1.5px);
    .key-cap {
      color: light-dark(#ffffff, #e5fdf3);
      --fill: light-dark(#19da89, #059669);
    }
  }
  /* Modifier keys */
  .key-wrapper.modifier {
    font-weight: 600;
  }
</style>
