<script lang="ts">
  import { createEventDispatcher } from 'svelte'

  const dispatch = createEventDispatcher<{
    blur: void
    changed: string
  }>()

  export let value: string = ''
  export let placeholder: string = ''

  export let disabled: boolean = false

  let el: HTMLInputElement

  const handleInput = () => {
    document.title = el.value
  }

  const handleKeyDown = (e: KeyboardEvent) => {
    if (!['Enter', 'Escape'].includes(e.key)) return
    el.blur()
    dispatch('changed', el.value)
  }
</script>

<input
  type="text"
  bind:this={el}
  bind:value
  {placeholder}
  {disabled}
  on:click
  on:blur
  on:input={handleInput}
  on:keydown={handleKeyDown}
/>

<style lang="scss">
  input {
    // TODO: (css) We should rather have the note define its content area
    // and just let children use 100% width
    max-width: 730px;
    width: 100%;
    margin: auto;
    margin-top: 4rem;
    margin-bottom: 0rem; // 0 for now as editor content already has top padding

    font-size: 2.1rem;
    font-weight: 600;
    padding-inline: 2rem;
    box-sizing: content-box;

    color: light-dark(var(--on-surface-heavy, #374151), var(--on-surface-dark, #cbd5f5));

    background: light-dark(
      var(--app-background-light, #fefeff),
      var(--app-background-dark, #1c2b3d)
    );

    &:active,
    &:focus {
      outline: none;
    }
  }
</style>
