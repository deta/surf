<script lang="ts">
  import { onMount } from 'svelte'

  let {
    placeholder = '',
    value = $bindable(''),
    required = false,
    autoFocus = false,
    ref = $bindable(null),
    type = 'text'
  }: {
    placeholder?: string
    value?: string
    required?: boolean
    autoFocus?: boolean
    ref?: HTMLInputElement | null
    type?: string
  } = $props()

  onMount(() => {
    if (autoFocus) {
      ref?.focus()
    }
  })

  let ModifiedType = type
  // can't set type via prop as type cannot be dynamic if input value uses two-way binding
  $effect(() => {
    if (ref) ref.type = ModifiedType
  })
</script>

<input
  class="no-input"
  {required}
  {placeholder}
  bind:value
  bind:this={ref}
  on:paste={(e) => e.stopPropagation()}
/>

<style>
  input {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    border-radius: 0.75rem;
    border-width: 4px;
    border-style: solid;
    border-color: var(--border-color);
    background: var(--background-accent);
    padding-left: 1rem;
    padding-right: 1rem;
    padding-top: 0.625rem;
    padding-bottom: 0.625rem;
    outline: 2px solid #0000;
    outline-offset: 2px;
    margin-bottom: 1rem;
  }
</style>
