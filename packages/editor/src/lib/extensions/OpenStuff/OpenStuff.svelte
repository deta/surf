<script lang="ts">
  import { isMac } from '../../utilities'
  import Button from '../Button/Button.svelte'

  export let onClick: () => void = () => {}

  const handleOpenStuff = () => {
    document.dispatchEvent(
      new CustomEvent('onboarding-open-stuff', {
        bubbles: true,
        composed: true
      })
    )

    onClick()
  }
</script>

<div class="shadow-wrapper">
  <div class="open-stuff-container">
    <div class="image-container">
      <!-- <img src={stuff} alt="Stuff" class="stuff-image" /> -->
    </div>
    <div class="flex flex-row w-full justify-between">
      <div class="span flex flex-col">
        <span class="headline">Where did this note go?</span>
        <span class="message">Surf has storage, called Stuff, try it out</span>
      </div>
      <div class="button-wrapper">
        <Button text={`Open Stuff (${isMac() ? '⌘' : 'Ctrl'} + O)`} onClick={handleOpenStuff} />
      </div>
    </div>
  </div>
</div>

<style lang="scss">
  // @use '@deta/ui/styles/utils' as utils;

  .shadow-wrapper {
    filter: drop-shadow(0px 8px 10px rgba(6, 5, 53, 0.04))
      drop-shadow(0px 4px 6px rgba(6, 5, 53, 0.06)) drop-shadow(0px 2px 4px rgba(6, 5, 53, 0.07))
      drop-shadow(0px 1px 2px rgba(6, 5, 53, 0.08));
  }

  .open-stuff-container {
    display: flex;
    gap: 2rem;
    flex-direction: column;
    align-items: center;
    // @include utils.squircle($fill: rgb(255 255 255), $radius: 28px, $smooth: 0.33);

    --squircle-outline-color: rgba(6, 5, 53, 0.1);
    --squircle-outline-width: 1px;
    justify-content: space-between;
    width: 100%;
    padding: 2rem;
    margin: 8px 0;

    // :global(.dark) & {
    //   @include utils.squircle($fill: rgba(58, 83, 255, 0.15), $radius: 16px, $smooth: 0.28);
    // }

    .image-container {
      padding: 1rem;
      width: 100%;
      height: 100%;
    }

    .stuff-image {
      width: calc(100% + 4rem);
      max-width: none;
      margin: -2rem -2rem 0;
      display: block;
      height: auto;
      object-fit: cover;
      max-height: 320px;
    }
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

    // @include utils.font-smoothing;

    :global(.dark) & {
      color: #d1d5db;
    }
  }
</style>
