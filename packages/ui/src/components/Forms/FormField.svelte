<script lang="ts">
  import { Switch } from '@deta/ui'
  import { Icon } from '@horizon/icons'
  import { tooltip, useDebounce } from '@deta/utils'

  import { createEventDispatcher } from 'svelte'

  export let label: string
  export let value: string | number | boolean
  export let placeholder: string = ''
  export let infoText: string | undefined = undefined
  export let type: 'text' | 'number' | 'password' | 'checkbox' = 'text'

  const dispatch = createEventDispatcher<{ change: string; save: string | boolean }>()

  const debouncedSave = useDebounce((value: string | boolean) => {
    dispatch('save', value)
  }, 500)

  const handleChange = (e: CustomEvent<boolean>) => {
    const value = e.detail

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
  <div class="form-label">
    <label>{label}</label>

    {#if infoText}
      <div class="info" use:tooltip={{ text: infoText }}>
        <Icon name="info" size="16px" />
      </div>
    {/if}
  </div>

  {#if type === 'text'}
    <input type="text" {placeholder} bind:value class="input" on:input={handleInput} on:blur />
  {:else if type === 'number'}
    <input type="number" {placeholder} bind:value class="input" on:input={handleInput} on:blur />
  {:else if type === 'password'}
    <input type="password" {placeholder} bind:value class="input" on:input={handleInput} on:blur />
  {:else if type === 'checkbox' && typeof value === 'boolean'}
    <Switch color="#ff4eed" fontSize={14} bind:checked={value} on:update={handleChange} />
  {/if}
</div>

<style lang="scss">
  .form-field {
    display: grid;
    grid-template-columns: 200px 1fr;
    align-items: center;
    gap: 1rem;

    .form-label {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      flex-shrink: 0;
    }

    .info {
      display: flex;
      align-items: center;
      justify-content: center;

      transition: opacity 0.2s ease-in-out;
      opacity: 0.75;

      &:hover {
        opacity: 1;
      }
    }

    label {
      font-size: 1rem;
      color: var(--color-text);
      white-space: nowrap;
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
