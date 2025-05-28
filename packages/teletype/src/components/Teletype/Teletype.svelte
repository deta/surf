<script lang="ts">
  import { useTeletype } from './index'
  import TeletypeCore from './TeletypeCore.svelte'
  import ConfirmationPrompt from './ConfirmationPrompt.svelte'
  import Notifications from './Notifications.svelte'
  import { createEventDispatcher } from 'svelte'

  const teletype = useTeletype()

  const open = teletype.isOpen
  const loading = teletype.isLoading
  const currentAction = teletype.currentAction
  const confirmationPrompt = teletype.confirmationPrompt
  const dispatch = createEventDispatcher()

  $: isModal =
    $currentAction?.view === 'Modal' ||
    $currentAction?.view === 'ModalLarge' ||
    $currentAction?.view === 'ModalSmall'

  // prevent scrolling
  let scrollTop = null
  let scrollLeft = null

  function disableScroll() {
    scrollTop = window.pageYOffset || window.document.documentElement.scrollTop
    ;(scrollLeft = window.pageXOffset || window.document.documentElement.scrollLeft),
      (window.onscroll = function () {
        window.scrollTo(scrollLeft, scrollTop)
      })
  }

  function enableScroll() {
    window.onscroll = function () {}
  }

  $: if ($open === true && isModal) {
    disableScroll()
  } else {
    enableScroll()
  }

  const handleClickOutside = () => {
    if ($currentAction?.forceSelection === true) return
    console.log('click outside')

    teletype.close()
    dispatch('close')
  }
</script>

<div
  class:outer-wrapper={$open}
  class:modal={isModal}
  class:modal-small={$currentAction?.view === 'ModalSmall'}
  class:modal-large={$currentAction?.view === 'ModalLarge'}
  class:loading={$loading}
  on:click|self={handleClickOutside}
  role="none"
>
  <div class="inner-wrapper">
    <Notifications {teletype} />
    <TeletypeCore on:input on:actions-rendered>
      <slot name="header" slot="header" />
    </TeletypeCore>

    <slot name="sidecar-right" />
  </div>
</div>

{#if $confirmationPrompt}
  <ConfirmationPrompt confirmationPrompt={$confirmationPrompt} />
{/if}

<style lang="scss">
  .outer-wrapper {
    position: fixed;
    display: flex;
    align-items: center;
    justify-content: center;
    top: 0;
    left: 0;
    width: 100%;
    height: 100vh;
    z-index: 100;
    pointer-events: none;
    //margin-top: -100vh;
  }

  .inner-wrapper {
    pointer-events: all;
    transition: transform 123ms ease-out;
    position: fixed;
    bottom: 2rem;
    left: 50%;
    transform: translateX(-50%) translateY(var(--offsetY, 0px));
    z-index: 100;
    max-width: 600px;
    width: 90%;
  }
  :global(body:not(:has(.instructions)) .teletype-motion .inner-wrapper) {
    --offsetY: 200%;
  }

  .modal {
    &.outer-wrapper {
      background: rgba(123, 123, 123, 0.3);
    }

    & :global(.box) {
      overflow-y: auto;
      max-height: calc(100vh - 6rem);
    }

    & :global(.inner-wrapper) {
      max-width: 800px;
      position: unset;
      transform: none;
    }

    &.modal-small {
      & :global(.inner-wrapper) {
        max-width: 500px;
      }
    }

    &.modal-large {
      & :global(.inner-wrapper) {
        width: 80%;
        max-width: 1536px;
      }
    }
  }
</style>
