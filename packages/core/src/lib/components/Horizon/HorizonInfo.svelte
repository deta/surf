<script lang="ts">
  import { createEventDispatcher } from 'svelte'
  import type { Horizon } from '../../service/horizon'
  import { useLogScope } from '../../utils/log'

  export let horizon: Horizon
  export let readOnly: boolean = false

  const dispatch = createEventDispatcher<{ change: Horizon }>()

  const log = useLogScope('HorizonInfo Component')

  const saveName = () => {
    log.debug('Saving name', horizon.data.name)
    horizon.updateData({ name: horizon.data.name })
    dispatch('change', horizon)
  }

  function onKeyDown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault()
      e.stopPropagation()

      saveName()

      const target = e.target as HTMLSpanElement
      target.blur()
    }
  }
</script>

<div class="horizon-info-wrapper">
  <div class="horizon-info">
    {#if readOnly}
      <span class="name" spellcheck="false" autocorrect="false" placeholder="Name"
        >{horizon.data.name}</span
      >
    {:else}
      <!-- svelte-ignore a11y-no-static-element-interactions -->
      <span
        title="Click to edit"
        class="name"
        contenteditable="true"
        spellcheck="false"
        autocorrect="false"
        placeholder="Name"
        bind:textContent={horizon.data.name}
        on:keydown={onKeyDown}
        on:blur={saveName}
        on:click|stopPropagation
      />
    {/if}
  </div>
</div>

<style lang="scss">
  .horizon-info-wrapper {
    position: absolute;
    z-index: 1000;
    bottom: 1rem;
    left: 1rem;
  }
  .horizon-info {
    background: #f5f5f5;
    border-radius: var(--theme-border-radius);
    border: 1px solid #ddd;
    overflow: hidden;

    display: flex;
    align-items: center;
    width: 100%;

    &:focus-within {
      border: 1px solid #b4b4b4;
    }
  }

  .name {
    font-size: 0.9rem;
    font-weight: 500;
    padding: 0.5rem 1rem;

    &:focus {
      outline: none;
    }
  }
</style>
