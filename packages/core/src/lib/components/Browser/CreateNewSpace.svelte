<script lang="ts">
  import { Icon, IconConfirmation } from '@horizon/icons'
  import SpaceIcon from '@horizon/core/src/lib/components/Drawer/SpaceIcon.svelte'
  import { writable } from 'svelte/store'
  import { createEventDispatcher } from 'svelte'
  import { tooltip } from '@svelte-plugins/tooltips'
  import { ResourceOverlay } from '@horizon/drawer/src/lib/drawer'

  import { colorPairs } from '../../service/oasis'

  const aiEnabled = writable(false)
  const name = writable('')
  const colors = writable(colorPairs[Math.floor(Math.random() * colorPairs.length)])
  const dispatch = createEventDispatcher()

  const newSpace = () => {
    const now = new Date().toISOString()
    return {
      id: 'new',
      name: {
        folderName: 'New Space',
        colors: $colors,
        showInSidebar: true,
        sources: [],
        liveModeEnabled: false,
        hideViewed: false,
        smartFilterQuery: null,
        sortBy: 'created_at'
      },
      created_at: now,
      updated_at: now,
      deleted: 0
    }
  }

  const handleCloseModal = () => {
    dispatch('close-modal')
  }

  const handleColorChange = async (event: CustomEvent<[string, string]>) => {
    colors.set(event.detail)
  }

  const handleSubmit = () => {
    dispatch('submit', { name: $name, aiEnabled: $aiEnabled, colors: $colors })
    dispatch('close-modal')
  }
</script>

<svelte:window
  on:keydown={(e) => {
    if (e.key === 'Escape') {
      handleCloseModal()
    } else if (e.key === 'Enter') {
      if ($name.length > 0) {
        handleSubmit()
      }
    }
  }}
/>

<div class="dialog">
  <div class="dialog-header">
    <h2>Create Space</h2>
    <button on:click={handleCloseModal} class="close-button" aria-label="Close">
      <Icon name="close" size="20px" /></button
    >
  </div>
  <div class="dialog-body">
    <ResourceOverlay caption="Click to change color.">
      <div slot="content" class="space-icon-wrapper transform active:scale-[98%]">
        <SpaceIcon on:change={handleColorChange} folder={newSpace()} />
      </div>
    </ResourceOverlay>
    <div class="input-wrapper">
      <input
        type="text"
        class="folder-name"
        id="folder-name"
        name="folder-name"
        placeholder="Enter Space Name"
        bind:value={$name}
      />
      <div
        class="wand-wrapper cursor-pointer"
        style="opacity: {$aiEnabled ? 0.8 : 0.4};"
        use:tooltip={{
          content: !$aiEnabled ? 'Enable AI auto fetching' : 'Disable AI auto fetching',
          action: 'hover',
          position: 'left',
          animation: 'fade',
          delay: 500
        }}
      >
        <div on:click={() => aiEnabled.set(!$aiEnabled)} aria-hidden="true">
          {#if !$aiEnabled}
            <Icon name="sparkles" size="22px" />
          {:else}
            <Icon name="sparkles.fill" size="22px" color="#29A6F3" />
          {/if}
        </div>
      </div>
      {#if $aiEnabled}
        <span class="ai-description"
          >With AI enabled your computer will find all of the items when creating a space.</span
        >
      {/if}
    </div>
  </div>
  <div class="dialog-footer">
    <button on:click={handleCloseModal} class="cancel-button">Cancel</button>
    <button on:click={handleSubmit} class="create-button">Create</button>
  </div>
</div>

<style lang="scss">
  .dialog {
    z-index: 1000000000;
    border: 0.5px solid #ccc;
    border-radius: 24px;
    padding: 1rem;
    width: 40rem;
    background: #f6faff;

    background: color(display-p3 0.9661 0.9801 1);

    box-shadow:
      0px 350px 98px 0px #36383a,
      0px 224px 90px 0px rgba(54, 56, 58, 0.01),
      0px 126px 76px 0px rgba(54, 56, 58, 0.05),
      0px 56px 56px 0px rgba(54, 56, 58, 0.09),
      0px 14px 31px 0px rgba(54, 56, 58, 0.1);

    box-shadow:
      0px 350px 98px 0px color(display-p3 0.2118 0.2196 0.2275 / 0),
      0px 224px 90px 0px color(display-p3 0.2118 0.2196 0.2275 / 0.01),
      0px 126px 76px 0px color(display-p3 0.2118 0.2196 0.2275 / 0.05),
      0px 56px 56px 0px color(display-p3 0.2118 0.2196 0.2275 / 0.09),
      0px 14px 31px 0px color(display-p3 0.2118 0.2196 0.2275 / 0.1);
  }

  .dialog-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
    padding: 1rem 2rem 1rem 2rem;
    color: #28568f;
    opacity: 0.4;
  }

  .dialog-header h2 {
    margin: 0;
    font-size: 1.25rem;
    font-weight: 500;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }

  .close-button {
    background: none;
    border: none;
    font-size: 20px;
    cursor: pointer;
  }

  .dialog-body {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    padding: 4rem 0 6rem 0;
    gap: 4rem;
    margin-bottom: 16px;

    .space-icon-wrapper {
      width: 16rem;
      height: 16rem;
    }

    input.folder-name {
      background: transparent;
      font-size: 1.5rem;
      font-weight: 500;
      min-width: 25rem;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
      border: none;
      padding: 0.5rem;
      width: 100%;
      color: #28568f;
      transition: border-color 0.3s;

      &::placeholder {
        color: rgba(40, 86, 143, 0.4);
      }

      &:focus {
        outline: none;
      }
    }
  }

  .input-wrapper {
    display: flex;
    justify-content: center;
    align-items: center;
    position: relative;
  }
  .wand-wrapper {
    display: flex;
    justify-content: center;
    align-items: center;
    width: 100%;
    opacity: 0.4;
    transition: opacity 0.3s;

    &:hover {
      opacity: 0.8;
    }
  }

  .dialog-body label {
    display: block;
    margin-bottom: 8px;
  }

  .dialog-footer {
    display: flex;
  }

  .cancel-button,
  .create-button {
    font-weight: 500;
    font-size: 1.125rem;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;

    width: 50%;
    padding: 1.4rem 1.875rem;
    border: none;
    border-radius: 12px;
    cursor: pointer;
    transition: background-color 0.3s;
  }

  .cancel-button {
    background-color: #fff;
    color: #28568f;
    margin-right: 8px;
  }

  .cancel-button:hover {
    background-color: #d1edff;
    color: #173861;
  }

  .create-button {
    background-color: #47b1f3;
    color: #fff;
  }

  .create-button:hover {
    background-color: #29a6f3;
  }

  .ai-description {
    position: absolute;
    top: 4rem;
    left: 0.5rem;
    right: 0.5rem;
    opacity: 0.8;
  }
</style>
