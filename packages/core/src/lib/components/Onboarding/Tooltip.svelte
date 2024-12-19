<script lang="ts">
  import { onMount, onDestroy } from 'svelte'
  import { createEventDispatcher } from 'svelte'
  import { nextStep, prevStep, launchTimeline, endTimeline, activeStep } from './timeline'
  import { OnboardingAction } from './onboardingScripts'
  import { Icon } from '@horizon/icons'
  import { derived } from 'svelte/store'
  import { spring } from 'svelte/motion'
  import { fade } from 'svelte/transition'
  import stuffOnboarding01 from '../../../../public/assets/onboarding/stuff.onboarding.01.webp'
  import stuffOnboardingSelect from '../../../../public/assets/onboarding/stuff.onboarding.select.mp4'
  import stuffOnboardingSpaces from '../../../../public/assets/onboarding/stuff.onboarding.spaces.mp4'
  import chatWithSpace from '../../../../public/assets/onboarding/chat.with.space.mp4'
  import chatDragIntoContext from '../../../../public/assets/onboarding/chat.drag.into.context.mp4'
  import desktopOnboardingStart from '../../../../public/assets/onboarding/desktop.onboarding.start.mp4'
  import desktopOnboardingHowtodrop from '../../../../public/assets/onboarding/dektop.onboarding.howtodrop.mp4'
  import saving from '../../../../public/assets/onboarding/saving.mp4'

  export let rootID: string

  let tooltip: HTMLDivElement

  const dispatch = createEventDispatcher<{ 'open-stuff': void }>()

  // Derived store to get the current step
  const currentStep = derived(activeStep, ($activeStep) => $activeStep)

  // Spring stores for smooth transitions
  const offsetX = spring(0, { stiffness: 0.2, damping: 0.7 })
  const offsetY = spring(0, { stiffness: 0.2, damping: 0.7 })

  const mediaSources: { [key: string]: string } = {
    'stuff.onboarding.01': stuffOnboarding01,
    'stuff.onboarding.select': stuffOnboardingSelect,
    'stuff.onboarding.spaces': stuffOnboardingSpaces,
    'chat.with.space': chatWithSpace,
    'chat.drag.into.context': chatDragIntoContext,
    'desktop.onboarding.start': desktopOnboardingStart,
    'desktop.onboarding.howtodrop': desktopOnboardingHowtodrop,
    saving: saving
  }

  $: if ($currentStep) {
    offsetX.set($currentStep.position.offsetX || 0)
    offsetY.set($currentStep.position.offsetY || 0)
  }

  const handleCreateSpace = () => {
    const button = document.querySelector(
      `[data-tooltip-action="${OnboardingAction.CreateSpace}"]`
    ) as HTMLButtonElement
    if (button) {
      button.click()
    }
  }

  const handleSendChatMessage = () => {
    const button = document.querySelector(
      `[data-tooltip-action="${OnboardingAction.SendChatMessage}"]`
    ) as HTMLButtonElement
    if (button) {
      button.click()
    }
  }

  const handleOpenStuff = () => {
    dispatch('open-stuff')
  }

  onMount(() => {
    if ($currentStep?.domRoot === rootID) {
      return
    }
    if (tooltip && rootID !== 'body') {
      const rootElement = document.getElementById(rootID)
      if (rootElement) {
        rootElement.appendChild(tooltip)
      }
    } else if (tooltip) {
      document.body.appendChild(tooltip)
    }
  })

  onDestroy(() => {
    if (tooltip && tooltip.parentNode) {
      tooltip.parentNode.removeChild(tooltip)
    }
  })

  $: tooltipStyle = $currentStep
    ? `
    position: absolute;
    ${$currentStep.position.vertical === 'center' ? 'top: 50%; transform: translateY(-50%);' : `${$currentStep.position.vertical}: ${$offsetY}px;`}
    ${$currentStep.position.horizontal === 'center' ? 'left: 50%; transform: translateX(-50%);' : `${$currentStep.position.horizontal}: ${$offsetX}px;`}
    z-index:${$currentStep.zIndex};
    display: ${$currentStep?.domRoot === rootID ? 'block' : 'none'};
  `
    : ''
</script>

{#if $currentStep}
  <div
    bind:this={tooltip}
    class="tooltip"
    style={tooltipStyle}
    in:fade={{ duration: 400 }}
    out:fade={{ duration: 400 }}
    role="none"
  >
    <div class="headline-container">
      <p>{$currentStep.headline}</p>
      <button class="tooltip-button close-button" on:click={endTimeline}>
        <Icon name="close" color="white" />
      </button>
    </div>

    {#if $currentStep.mediaID && $currentStep.mediaType}
      {#if $currentStep.mediaType === 'image'}
        <img src={mediaSources[$currentStep.mediaID]} alt="Tooltip media" class="tooltip-media" />
      {:else if $currentStep.mediaType === 'video'}
        <video
          src={mediaSources[$currentStep.mediaID]}
          autoplay
          loop
          nocontrols
          class="tooltip-media"
        ></video>
      {/if}
    {/if}

    <div class="content">
      <p>{@html $currentStep.content}<br /></p>
    </div>
    <div class="button-container">
      {#if $currentStep.prevButtonLabel}
        <button class="tooltip-button back" on:click={prevStep}>
          <Icon name="chevron.left" />
          <!-- {$currentStep.prevButtonLabel} -->
        </button>
      {/if}
      {#if $currentStep.nextButtonLabel}
        <button
          class="tooltip-button next"
          on:click={() => {
            if ($currentStep.action === OnboardingAction.CreateSpace) {
              handleCreateSpace()
            }

            if ($currentStep.action === OnboardingAction.SendChatMessage) {
              handleSendChatMessage()
            }

            if ($currentStep.action === OnboardingAction.OpenStuff) {
              handleOpenStuff()
            }
            nextStep()
          }}
        >
          {$currentStep.nextButtonLabel}
        </button>
      {/if}
    </div>
  </div>
{/if}

<style lang="scss">
  .tooltip {
    background-color: #f9f9f9;
    border: 0.5px solid rgba(73, 82, 242, 0.9);
    outline: 3px solid rgba(73, 82, 242, 0.5);
    border-radius: 1.06rem;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    z-index: 123456;
    border: 0.5px solid rgba(73, 82, 242, 0.13);
    box-shadow:
      0px 64px 18px 0px #00203c,
      0px 41px 16px 0px rgba(0, 32, 60, 0.01),
      0px 23px 14px 0px rgba(0, 32, 60, 0.05),
      0px 10px 10px 0px rgba(0, 32, 60, 0.09),
      0px 3px 6px 0px rgba(0, 32, 60, 0.1),
      0px 1px 1px 0px rgba(0, 32, 60, 0.3);
    box-shadow:
      0px 64px 18px 0px color(display-p3 0.0118 0.1216 0.2275 / 0),
      0px 41px 16px 0px color(display-p3 0.0118 0.1216 0.2275 / 0.01),
      0px 23px 14px 0px color(display-p3 0.0118 0.1216 0.2275 / 0.05),
      0px 10px 10px 0px color(display-p3 0.0118 0.1216 0.2275 / 0.09),
      0px 3px 6px 0px color(display-p3 0.0118 0.1216 0.2275 / 0.1),
      0px 1px 1px 0px rgba(0, 32, 60, 0.3);
    max-width: 48ch;
    min-width: 16rem;
    position: relative;
    transition: width 0.3s ease-in-out;
  }

  .headline-container {
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: linear-gradient(to right, rgba(73, 82, 242, 0.6), rgba(73, 82, 242, 0.5));
    padding: 0.25rem 0 0.25rem 0.75rem;
    border-top-left-radius: 1rem;
    border-top-right-radius: 1rem;
    color: #fff;
    p {
      padding: 0;
      line-height: 1;
    }
  }

  p {
    padding: 0.5rem 0.25rem;
    max-width: 42ch;
  }

  .content {
    padding: 0.75rem;
    padding-bottom: 1.5rem;
  }

  .tooltip-button {
    color: white;
    border: none;
    padding: 5px 10px;

    margin: 5px;
    display: flex;
    align-items: center;
    border-radius: 0.7rem;

    &.back {
      background-color: transparent;
    }

    &.next {
      background-color: rgba(73, 82, 242, 0.8);
    }
  }

  .tooltip:hover .tooltip-button.next {
    opacity: 1;
  }

  .tooltip-button:hover {
    &.back {
      background-color: rgba(73, 82, 242, 0.1);
    }

    &.next {
      background-color: rgba(73, 82, 242, 1);
    }
  }

  .close-button {
    background-color: transparent;
    color: #333;
  }

  .close-button:hover {
    background-color: transparent;
    color: #000;
  }

  .button-container {
    display: flex;
    justify-content: space-between;
  }
</style>
