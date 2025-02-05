<script lang="ts">
  import { useDebounce } from '@horizon/utils'
  import { createEventDispatcher } from 'svelte'

  export let label: string
  export let value: string | number | boolean
  export let placeholder: string = ''
  export let type: 'text' | 'number' | 'password' | 'checkbox' = 'text'

  const dispatch = createEventDispatcher<{ change: string; save: string }>()

  const debouncedSave = useDebounce((value: string) => {
    dispatch('save', value)
  }, 500)

  const handleChange = (event: Event) => {
    const target = event.target as HTMLSelectElement
    const value = target.value

    debouncedSave(value)
  }

  const handleInput = (event: Event) => {
    const target = event.target as HTMLInputElement
    const value = target.value

    debouncedSave(value)
  }
</script>

<div class="form-field">
  <!-- svelte-ignore a11y-label-has-associated-control -->
  <label>{label}</label>
  {#if type === 'text'}
    <input type="text" {placeholder} bind:value class="input" on:input={handleInput} on:blur />
  {:else if type === 'number'}
    <input type="number" {placeholder} bind:value class="input" on:input={handleInput} on:blur />
  {:else if type === 'password'}
    <input type="password" {placeholder} bind:value class="input" on:input={handleInput} on:blur />
  {:else if type === 'checkbox' && typeof value === 'boolean'}
    <input type="checkbox" bind:checked={value} class="checkbox" on:change={handleChange} on:blur />
  {/if}
</div>

<style lang="scss">
  .form-field {
    display: grid;
    grid-template-columns: 180px 1fr;
    align-items: center;
    gap: 1rem;

    label {
      font-size: 1rem;
      color: var(--color-text);
    }

    input {
      width: 100%;
      padding: 0.5rem;
      border: 1px solid var(--color-border);
      border-radius: 8px;
      background: var(--color-background-light);
      color: var(--color-text);
      outline: none;
      font-size: 1rem;
      font-family: inherit;
      resize: vertical;

      &:focus {
        border-color: var(--color-brand-light);
      }
    }
  }
</style>
