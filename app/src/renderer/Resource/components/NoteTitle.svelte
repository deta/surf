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

    font-size: 2.25rem;
    font-weight: 600;
    padding-inline: 4rem;
    box-sizing: content-box;

    background: light-dark(#fff, rgba(24, 24, 24, 1));

    &:active,
    &:focus {
      outline: none;
    }
  }
</style>
