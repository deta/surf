<script lang="ts">
  import { Icon } from '@horizon/icons'
  import { type Writable } from 'svelte/store'
  import { tick } from 'svelte'

  export let placeholder: string = 'Search...'
  export let searchValue: Writable<string>
  export let autoFocus: boolean = false

  let inputElement: HTMLInputElement

  $: if (autoFocus && inputElement) {
    tick().then(() => inputElement.focus())
  }
</script>

<div class="search-field-wrapper">
  <Icon name="search" size="24" color="#586884" />
  <input
    bind:this={inputElement}
    class="search-field"
    type="text"
    {placeholder}
    bind:value={$searchValue}
  />
</div>

<style lang="scss">
  .search-field-wrapper {
    align-items: center;
    background: #fff;
    border: 0;
    border-radius: 1rem;
    color: #586884;
    display: flex;
    height: 100%;
    padding: 0.65rem;
    position: relative;
    width: 32rem;
    background-image: linear-gradient(white, white), linear-gradient(180deg, #00376430, #00376460);
    background-origin: border-box;
    background-clip: padding-box, border-box;
    outline: 0.5px solid #58688430;
    transition: 28ms outline ease-out;
    box-shadow:
      0px 13px 4px 0px #003764,
      0px 8px 3px 0px rgba(0, 55, 100, 0.01),
      0px 5px 3px 0px rgba(0, 55, 100, 0.03),
      0px 2px 2px 0px rgba(0, 55, 100, 0.05),
      0px 1px 1px 0px rgba(0, 55, 100, 0.06);
    box-shadow:
      0px 13px 4px 0px color(display-p3 0.0078 0.2118 0.3804 / 0),
      0px 8px 3px 0px color(display-p3 0.0078 0.2118 0.3804 / 0.01),
      0px 5px 3px 0px color(display-p3 0.0078 0.2118 0.3804 / 0.03),
      0px 2px 2px 0px color(display-p3 0.0078 0.2118 0.3804 / 0.05),
      0px 1px 1px 0px color(display-p3 0.0078 0.2118 0.3804 / 0.06);

    &:focus-within {
      outline: 3px solid #58688430;
    }

    .search-field {
      font-size: 1.25rem;
      font-family: 'Inter';
      padding: 0.25rem;
      outline: 0;
      line-height: 1;
      border: 0;
      font-weight: 500;
      width: 100%;
      background: transparent;

      &::placeholder {
        color: #586884;
        font-size: 1.24rem;
      }
    }
  }
</style>
