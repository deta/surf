<script lang="ts">
  import { createEventDispatcher } from 'svelte'
  import { Icon, type Icons } from '@horizon/icons'

  import { useConfig } from '@horizon/core/src/lib/service/config'

  export let id: string
  export let loading: boolean = false
  export let failed: boolean = false
  export let icon: Icons | undefined = undefined
  export let additionalLabel: string | undefined = undefined
  export let hideRemove: boolean = false

  const config = useConfig()
  const userConfigSettings = config.settings

  const dispatch = createEventDispatcher<{
    'remove-item': string
  }>()

  const handleExcludeItem = (id: string) => {
    dispatch('remove-item', id)
  }
</script>

<div
  class="shine-border pill transform group/pill"
  class:experimental={$userConfigSettings.experimental_notes_chat_input &&
    $userConfigSettings.experimental_notes_chat_sidebar}
  style="transform-origin: center center;"
>
  <div
    role="none"
    class="pill flex items-center gap-2 px-3 border-[0.5px] border-l border-t border-r border-gray-200 dark:border-gray-600 {failed
      ? 'bg-red-50 hover:bg-red-100 dark:bg-red-800 dark:hover:bg-red-700'
      : 'bg-white dark:bg-gray-800'} z-0 transform hover:translate-y-[-6px]"
    style="min-width: 40px; height: 36px;transition: transform 0.3s, background-color 0.3s;"
  >
    {#if !hideRemove}
      <button
        class="remove absolute top-0 left-0 shadow-sm transform"
        style="background: white; border: 1px solid rgb(220,220,220); transform: translate(-20%, -20%); z-index: 10; width: 16px; aspect-ratio: 1 / 1; border-radius: 100%;"
        on:click|stopPropagation={() => handleExcludeItem(id)}
      >
        <Icon name="close" size="11px" color="black" />
      </button>
    {/if}

    {#if loading || icon}
      <div
        class="flex items-center justify-center flex-shrink-0 group-hover/pill:opacity-100 w-5 h-5"
        class:loading
        class:failed
        class:opacity-100={!loading && !failed}
      >
        {#if icon}
          <Icon name={icon} size="1rem" />
        {:else}
          <Icon name="spinner" size="1rem" />
        {/if}
      </div>
    {/if}

    {#if additionalLabel}
      <div class="text-sm font-medium">
        {additionalLabel}
      </div>
    {/if}
  </div>
</div>

<style lang="scss">
  .shine-border {
    transform-box: fill-box;
    transform-origin: center center;
  }

  .pill {
    transition: transform 0.3s ease;
    border-radius: 11px 11px 11px 11px;
  }

  .pill {
    button.remove {
      display: none;
      justify-content: center;
      align-items: center;
      transition: all 0.3 ease;
    }
    &:hover button.remove {
      display: flex;
    }
  }
  .loading {
    opacity: 0.6;
  }

  .failed {
    opacity: 0.4;
  }
</style>
