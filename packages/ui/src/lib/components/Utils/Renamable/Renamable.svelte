<script lang="ts">
  import { tick } from 'svelte'
  import type { Snippet } from 'svelte'

  let {
    children,
    value = '',
    onChange,
    onConfirm,
    onCancel,
    placeholder = '',
    disabled = false,
    ...restProps
  }: {
    children?: Snippet
    value?: string
    onChange?: (value: string) => void
    onConfirm?: (value: string) => void
    onCancel?: () => void
    placeholder?: string
    disabled?: boolean
    class?: string
  } = $props()

  let isEditing = $state(false)
  let inputElement = $state<HTMLInputElement>()
  let containerElement = $state<HTMLElement>()
  let currentValue = $state(value)
  let originalValue = value

  // Reactive effect to update currentValue when value prop changes
  $effect(() => {
    if (!isEditing) {
      currentValue = value
    }
  })

  async function startEditing() {
    if (disabled) return
    
    isEditing = true
    originalValue = currentValue
    
    await tick()
    
    if (inputElement) {
      inputElement.focus()
    }
  }

  function confirmEdit() {
    if (disabled) return
    
    const trimmedValue = currentValue.trim()
    
    if (trimmedValue !== originalValue) {
      onConfirm?.(trimmedValue)
    }
    
    isEditing = false
  }

  function cancelEdit() {
    currentValue = originalValue
    isEditing = false
    onCancel?.()
  }

  function handleInput(event: Event) {
    const target = event.target as HTMLInputElement
    currentValue = target.value
    onChange?.(currentValue)
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      event.preventDefault()
      confirmEdit()
    } else if (event.key === 'Escape') {
      event.preventDefault()
      cancelEdit()
    }
  }

  function handleDoubleClick(event: MouseEvent) {
    if (!disabled && isEditing && inputElement) {
      event.preventDefault()
      inputElement.select()
    }
  }

  function handleBlur() {
    confirmEdit()
  }

  // Handle click on container when not editing
  function handleContainerClick() {
    if (!disabled && !isEditing) {
      startEditing()
    }
  }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<span
  bind:this={containerElement}
  class="renamable-container {restProps.class || ''}"
  class:editing={isEditing}
  class:disabled
  onclick={handleContainerClick}
  ondblclick={handleDoubleClick}
  role="button"
  tabindex={disabled ? -1 : 0}
  {...restProps}
>
  {#if isEditing}
    <input
      bind:this={inputElement}
      bind:value={currentValue}
      oninput={handleInput}
      onkeydown={handleKeydown}
      onblur={handleBlur}
      ondblclick={handleDoubleClick}
      class="renamable-input"
      type="text"
      {placeholder}
    />
  {:else if currentValue || placeholder}
    <span class="renamable-content">
      {currentValue || placeholder}
    </span>
  {:else if children}
    {@render children()}
  {:else}
    <span class="renamable-empty">Click to edit</span>
  {/if}
</span>

<style lang="scss">
  .renamable-container {
    position: relative;
    display: inline-block;
    cursor: text;
    user-select: none;
    
    &.disabled {
      cursor: default;
      opacity: 0.5;
    }
    
    &:not(.disabled):hover:not(.editing):not(.tree-node-renamable) {
      background-color: light-dark(rgba(0, 0, 0, 0.02), rgba(255, 255, 255, 0.05));
      border-radius: 4px;
    }
    
    &:not(.disabled):focus {
      outline: none;
      background-color: light-dark(rgba(0, 0, 0, 0.05), rgba(255, 255, 255, 0.08));
      border-radius: 4px;
    }
    
    &.editing {
      background-color: light-dark(rgba(0, 0, 0, 0.05), rgba(255, 255, 255, 0.08));
      border-radius: 4px;
    }
  }

  .renamable-input {
    background: transparent;
    border: none;
    outline: none;
    padding: 0;
    margin: 0;
    
    font-family: inherit;
    font-size: inherit;
    font-weight: inherit;
    line-height: inherit;
    letter-spacing: inherit;
    text-decoration: inherit;
    color: inherit;

    
    display: inherit;
    //width: 100%;
    min-width: 2ch;
    
    text-align: inherit;
    text-transform: inherit;
    text-shadow: inherit;
    text-indent: inherit;
    
    &::placeholder {
      color: light-dark(rgba(0, 0, 0, 0.4), rgba(255, 255, 255, 0.4));
      opacity: 1;
    }
    
    &::selection {
      background-color: light-dark(rgba(0, 123, 255, 0.3), rgba(129, 146, 255, 0.35));
    }
  }

  .renamable-content {
    display: inline;
    color: light-dark(rgba(0, 0, 0, 0.9), rgba(255, 255, 255, 0.95));
  }

  .renamable-empty {
    display: inline;
    color: light-dark(rgba(0, 0, 0, 0.4), rgba(255, 255, 255, 0.4));
    font-style: italic;
  }
</style>
