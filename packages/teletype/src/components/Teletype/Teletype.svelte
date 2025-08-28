<script lang="ts">
  import { useTeletype } from './index'
  import TeletypeCore from './TeletypeCore.svelte'
  import ConfirmationPrompt from './ConfirmationPrompt.svelte'
  import Notifications from './Notifications.svelte'
  import { createEventDispatcher } from 'svelte'
  import type { UseMentionsResult } from '@deta/services'

  let { mentionsService }: { mentionsService?: UseMentionsResult } = $props()

  const teletype = useTeletype()

  const open = teletype.isOpen
  const loading = teletype.isLoading
  const currentAction = teletype.currentAction
  const confirmationPrompt = teletype.confirmationPrompt
  const dispatch = createEventDispatcher()

  const isModal = $derived(
    $currentAction?.view === 'Modal' ||
      $currentAction?.view === 'ModalLarge' ||
      $currentAction?.view === 'ModalSmall'
  )

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

  $effect(() => {
    if ($open === true && isModal) {
      disableScroll()
    } else {
      enableScroll()
    }
  })

  const handleClickOutside = () => {
    if ($currentAction?.forceSelection === true) return
    console.log('click outside')

    teletype.close()
    dispatch('close')
  }
</script>

<div class="inner-wrapper">
  <Notifications {teletype} />
  <TeletypeCore on:input on:actions-rendered on:ask {mentionsService}>
    <slot name="header" slot="header" />
  </TeletypeCore>

  <slot name="sidecar-right" />
</div>

{#if $confirmationPrompt}
  <ConfirmationPrompt confirmationPrompt={$confirmationPrompt} />
{/if}

<style lang="scss">
  .inner-wrapper {
    pointer-events: all;
    transition: transform 123ms ease-out;
    position: relative;

    z-index: 100;
    width: 100%;
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
