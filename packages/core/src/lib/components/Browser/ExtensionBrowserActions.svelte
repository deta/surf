<script lang="ts">
  import { onMount } from 'svelte'
  import { Icon } from '@horizon/icons'
  import { createEventDispatcher } from 'svelte'
  import CustomPopover from '../Atoms/CustomPopover.svelte'
  import { writable, derived } from 'svelte/store'

  const extensions = writable<any[]>([])
  const hasNoExtensionsEnabled = derived(extensions, ($extensions) => $extensions.length === 0)

  async function updateExtensionState() {
    try {
      // @ts-ignore - window.api is injected
      const extensionList = await window.api.listExtensions()
      extensions.set(extensionList)
    } catch (error) {
      extensions.set([])
    }
  }

  onMount(() => {
    // @ts-ignore - window.api is injected
    const cleanup = window.api.onExtensionChange?.(updateExtensionState)
    return () => cleanup?.()
  })

  const dispatch = createEventDispatcher<{
    'open-extension-store': void
  }>()

  const handleOpenExtenionStore = () => {
    dispatch('open-extension-store')
  }

  const handleOpenSettings = () => {
    // @ts-ignore - window.api is injected
    window.api.openSettings()
  }
</script>

<CustomPopover
  disableHover={false}
  toggleOnClick={true}
  position="bottom"
  sideOffset={3}
  on:show={updateExtensionState}
>
  <div slot="trigger">
    <button
      class="custom-button-color no-drag transform active:scale-95 appearance-none border-0 group margin-0 flex items-center justify-center p-2 hover:bg-sky-200 transition-colors duration-200 rounded-xl text-sky-800 dark:hover:bg-sky-900/50 dark:text-sky-100"
    >
      <span class="inline-block translate-x-0 transition-transform ease-in-out duration-200">
        <Icon name="puzzle" />
      </span>
    </button>
  </div>
  <div slot="content" class="popover-content">
    {#if $hasNoExtensionsEnabled}
      <div class="empty-state">
        <div class="description">
          <p>
            Surf comes with experimental extension support, currently limited to most popular <b>password managers</b>.
          </p>

          <p>
            Find your favorite password manager in the Chrome Web Store and install it to use it with Surf.
          </p>

          <button class="install-button" on:click={handleOpenExtenionStore}>
            Open Web Store
          </button>
        </div>
      </div>
    {:else}
      <div class="installed-extensions">
        <browser-action-list partition="persist:horizon"></browser-action-list>
        <div class="button-group">
          <button class="install-button" on:click={handleOpenExtenionStore}>
            Open Extension Store
          </button>
          <button class="settings-button" on:click={handleOpenSettings}>
            <Icon name="settings" />
          </button>
        </div>
      </div>
    {/if}
  </div>
</CustomPopover>

<style lang="scss">
  .custom-button-color {
    :global(.custom) & {
      color: var(--contrast-color) !important;
      // This is a hack since i have no idea where the active class is set.
      &.bg-sky-200 {
        background-color: var(--base-color) !important;
      }
      &:hover {
        background-color: var(--base-color) !important;
      }
    }
  }

  .popover-content {
    background: radial-gradient(
      143.56% 143.56% at 50% -43.39%,
      #eef4ff 0%,
      #ecf3ff 50%,
      #d2e2ff 100%
    );
    color: #586884;
  }

  .installed-extensions {
    display: flex;
    flex-direction: column;
    padding: 0.5rem;
    gap: 0.5rem;
  }

  .button-group {
    display: flex;
    gap: 0.5rem;
    align-items: center;
  }

  .settings-button {
    background: rgba(255, 255, 255, 0.4);
    border-radius: 0.5rem;
    padding: 0.25rem;
    display: flex;
    align-items: center;
    justify-content: center;
    &:hover {
      background: rgba(255, 255, 255, 0.8);
    }
  }

  .install-button {
    background: rgba(255, 255, 255, 0.4);
    border-radius: 0.5rem;
    padding: 0.25rem 0.75rem;
    &:hover {
      background: rgba(255, 255, 255, 0.8);
    }
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    max-width: 28ch;
    padding: 1rem 1.25rem 0.5rem 1.25rem;

    .description {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      padding: 0.5rem;
    }

    .install-options {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;

      .install-option {
        display: flex;
        align-items: center;
        justify-content: space-between;
      }
    }
  }
</style>
