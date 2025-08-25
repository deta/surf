<script lang="ts">
  import { Icon } from '@deta/icons'
  import { onMount } from 'svelte'
  import Button from '../Button/Button.svelte'
  import { writable } from 'svelte/store'

  export let onClick: () => void = () => {}

  // Store to track if browser is set as default
  const isDefault = writable(false)

  // Check if browser is already set as default
  onMount(async () => {
    try {
      const defaultStatus = await window.api.isDefaultBrowser()
      isDefault.set(defaultStatus)
    } catch (error) {
      console.error('Failed to check default browser status:', error)
    }
  })

  const handleSetAsDefault = async () => {
    try {
      // Call the system function to set as default browser
      await window.api.useAsDefaultBrowser()

      // Update the status
      isDefault.set(true)

      // Also call the onClick handler passed as prop
      onClick()
    } catch (error) {
      console.error('Failed to set as default browser:', error)
    }
  }
</script>

<div class="shadow-wrapper">
  <div class="default-browser-container">
    <div class="span flex flex-col">
      <span class="headline">
        {#if $isDefault}
          Thanks for using Surf as your default browser!
        {:else}
          Surf gets even better the more you use it.
        {/if}
      </span>
      <span class="message">
        {#if $isDefault}
          Join our <a href="https://discord.com/invite/r85tk92YXZ">Discord Community</a> to get early
          access to new features and to get help with any issues you may have.
        {:else}
          <div class="flex flex-row gap-2">
            <Icon name="face" />
            Make it your default browser.
          </div>
        {/if}
      </span>
    </div>
    <Button text={$isDefault ? 'Yaaay!' : 'Set as Default'} onClick={handleSetAsDefault} />
  </div>
</div>

<style lang="scss">
  // @use '@deta/ui/styles/utils' as utils;
  .shadow-wrapper {
    filter: drop-shadow(0px 8px 10px rgba(6, 5, 53, 0.04))
      drop-shadow(0px 4px 6px rgba(6, 5, 53, 0.06)) drop-shadow(0px 2px 4px rgba(6, 5, 53, 0.07))
      drop-shadow(0px 1px 2px rgba(6, 5, 53, 0.08));
  }

  .default-browser-container {
    display: flex;
    align-items: center;
    // @include utils.squircle($fill: rgb(230 231 247), $radius: 28px, $smooth: 0.33);

    --squircle-outline-color: rgba(6, 5, 53, 0.1);
    --squircle-outline-width: 1px;
    justify-content: space-between;
    width: 100%;
    padding: 20px 24px;
    margin: 8px 0;
    scroll-margin: 50px;

    // :global(.dark) & {
    //   @include utils.squircle($fill: rgba(58, 83, 255, 0.15), $radius: 16px, $smooth: 0.28);
    // }
  }

  .headline {
    font-size: 1.25rem;
    font-weight: 600;
    font-family: 'Gambarino-Display', sans-serif;
    color: rgb(11 25 255);
    letter-spacing: 0.01em;
    line-height: 1.3;
    margin-bottom: 4px;

    // @include utils.font-smoothing;

    :global(.dark) & {
      color: #f9fafb;
    }
  }

  .message {
    font-size: 0.95rem;
    font-weight: 500;
    font-family: 'Inter', sans-serif;
    color: #5c5f8d;
    line-height: 1.4;
    padding-right: 4rem;

    // @include utils.font-smoothing;

    :global(.dark) & {
      color: #d1d5db;
    }
  }
</style>
