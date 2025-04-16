<script lang="ts">
  import { onMount, onDestroy } from 'svelte'
  import { createEventDispatcher } from 'svelte'
  import { nextStep, prevStep, launchTimeline, endTimeline, activeStep } from './timeline'
  import { OnboardingAction } from './onboardingScripts'
  import {
    useOnboardingService,
    OnboardingLoadingState,
    type OnboardingLoadingInfo
  } from '@horizon/core/src/lib/service/onboarding'
  import { useTabsManager } from '@horizon/core/src/lib/service/tabs'
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
  import atMenu from '../../../../public/assets/onboarding/notes/at.menu.mp4'
  import slashMenu from '../../../../public/assets/onboarding/notes/slash.menu.mp4'
  import suggestions from '../../../../public/assets/onboarding/notes/suggestions.mp4'
  import caret from '../../../../public/assets/onboarding/notes/caret.png'
  import createSurflet from '../../../../public/assets/onboarding/notes/create.surflet.png'
  import youtubeChat from '../../../../public/assets/onboarding/notes/youtube-chat.png'
  import chatPDF from '../../../../public/assets/onboarding/notes/chat.pdf.png'
  import saving from '../../../../public/assets/onboarding/saving.mp4'

  export let rootID: string

  let tooltip: HTMLDivElement

  const dispatch = createEventDispatcher<{
    'open-stuff': void
    'open-pdf': string
    'insert-question': string
    'start-ai-completion': string
  }>()

  // Derived store to get the current step
  const currentStep = derived(activeStep, ($activeStep) => $activeStep)

  // Get the onboarding service to access loading state
  const onboardingService = useOnboardingService()

  // Derived store for loading state
  const loadingState = derived(onboardingService.loadingState, ($loadingState) => $loadingState)

  // Derived store to check if any loading is happening
  const isLoading = derived(
    loadingState,
    ($loadingState) => $loadingState.state !== OnboardingLoadingState.Idle
  )

  // Spring stores for smooth transitions
  const offsetX = spring(0, { stiffness: 0.2, damping: 0.7 })
  const offsetY = spring(0, { stiffness: 0.2, damping: 0.7 })
  const anchorLeft = spring(0, { stiffness: 0.2, damping: 0.7 })
  const anchorTop = spring(0, { stiffness: 0.2, damping: 0.7 })
  let useAnchorPosition = false

  const mediaSources: { [key: string]: string } = {
    'stuff.onboarding.01': stuffOnboarding01,
    'stuff.onboarding.select': stuffOnboardingSelect,
    'stuff.onboarding.spaces': stuffOnboardingSpaces,
    'chat.with.space': chatWithSpace,
    'chat.drag.into.context': chatDragIntoContext,
    'desktop.onboarding.start': desktopOnboardingStart,
    'desktop.onboarding.howtodrop': desktopOnboardingHowtodrop,
    'at.menu': atMenu,
    'slash.menu': slashMenu,
    'youtube.chat': youtubeChat,
    'chat.pdf': chatPDF,
    'create.surflet': createSurflet,
    suggestions: suggestions,
    caret: caret,
    saving: saving
  }

  // Function to update tooltip position based on anchor element
  const updateAnchorPosition = () => {
    if (!$currentStep || !$currentStep.domAnchor) {
      useAnchorPosition = false
      return
    }

    const anchorElement = document.querySelector(
      `[data-tooltip-anchor="${$currentStep.domAnchor}"]`
    )
    if (!anchorElement) {
      useAnchorPosition = false
      return
    }

    useAnchorPosition = true
    const rect = anchorElement.getBoundingClientRect()

    // Calculate position based on the anchor element's bounding box
    let left = 0
    let top = 0

    // Horizontal positioning
    if ($currentStep.position.horizontal === 'left') {
      left = rect.left + ($currentStep.position.offsetX || 0)
    } else if ($currentStep.position.horizontal === 'right') {
      left = rect.right + ($currentStep.position.offsetX || 0)
    } else {
      // center
      left = rect.left + rect.width / 2 + ($currentStep.position.offsetX || 0)
    }

    // Vertical positioning
    if ($currentStep.position.vertical === 'top') {
      top = rect.top + ($currentStep.position.offsetY || 0)
    } else if ($currentStep.position.vertical === 'bottom') {
      top = rect.bottom + ($currentStep.position.offsetY || 0)
    } else {
      // center
      top = rect.top + rect.height / 2 + ($currentStep.position.offsetY || 0)
    }

    anchorLeft.set(left)
    anchorTop.set(top)
  }

  // Update position when current step changes
  $: if ($currentStep) {
    offsetX.set($currentStep.position.offsetX || 0)
    offsetY.set($currentStep.position.offsetY || 0)
    updateAnchorPosition()
  }

  // Observers to detect changes that might affect anchor position
  let mutationObserver: MutationObserver
  let resizeObserver: ResizeObserver
  let anchorElement: Element | null = null

  // Function to set up observers for the current anchor element
  const setupObservers = () => {
    // Clean up any existing observers
    cleanupObservers()

    if (!$currentStep?.domAnchor) return

    // Find the anchor element
    anchorElement = document.querySelector(`[data-tooltip-anchor="${$currentStep.domAnchor}"]`)
    if (!anchorElement) return

    // Set up mutation observer to detect DOM changes
    mutationObserver = new MutationObserver(() => {
      updateAnchorPosition()
    })
    mutationObserver.observe(document.body, { childList: true, subtree: true })

    // Set up resize observer to detect size changes of the anchor element
    resizeObserver = new ResizeObserver(() => {
      updateAnchorPosition()
    })
    resizeObserver.observe(anchorElement)
  }

  // Function to clean up all observers
  const cleanupObservers = () => {
    if (mutationObserver) {
      mutationObserver.disconnect()
      mutationObserver = undefined
    }

    if (resizeObserver) {
      resizeObserver.disconnect()
      resizeObserver = undefined
    }
  }

  // Set up observers when current step changes
  $: if ($currentStep?.domAnchor) {
    // For the Notes onboarding, add a delay to ensure the sidebar is fully loaded
    if ($currentStep.target.startsWith('#notes.onboarding')) {
      setTimeout(() => {
        setupObservers()
      }, 1000) // 1 second delay for Notes onboarding
    } else {
      setupObservers()
    }
  } else {
    cleanupObservers()
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

  const handleOpenPDF = () => {
    // Get the onboarding service
    const onboardingService = useOnboardingService()

    // Open PDF
    onboardingService.openURLAndChat(
      'https://arxiv.org/pdf/2112.08540',
      'Explain the landing efficiency two very short paragraphs.'
    )
  }

  const handleOpenYouTubeVideo = () => {
    // Get the onboarding service
    const onboardingService = useOnboardingService()

    // Open YouTube video
    onboardingService.openURLAndChat(
      'https://www.youtube.com/watch?v=B1J2RMorJXM',
      'Describe the final approach in two very short paragraphs.'
    )
  }

  const handleInsertQuestion = () => {
    dispatch('insert-question', 'What are the key findings of this paper?')
  }

  const handleStartAICompletion = () => {
    dispatch('start-ai-completion', 'What are the key findings of this paper?')
  }

  const handleCreateSurflet = () => {
    // Insert a question to create a Surflet
    const onboardingService = useOnboardingService()

    // Clear the current context so the Surflet generation is more likely to work
    onboardingService.aiService?.contextManager.clear()

    // Insert the question and submit it
    if (typeof onboardingService?.magicSidebar?.insertQueryIntoChat === 'function') {
      onboardingService.magicSidebar.insertQueryIntoChat(
        'Create a Surflet that shows the final stage of the moon landing in a timeline.'
      )

      // Wait a moment and then submit the chat message
      setTimeout(() => {
        if (typeof onboardingService?.magicSidebar?.submitChatMessage === 'function') {
          onboardingService.magicSidebar.submitChatMessage()
        }
      }, 500)
    }
  }

  const handleReturnToWelcomePage = () => {
    // Get the tabs manager to create or focus the onboarding tab
    const tabsManager = useTabsManager()

    // Find existing onboarding tab
    const existingOnboardingTab = tabsManager.tabsValue.find((tab) => tab.type === 'onboarding')

    if (existingOnboardingTab) {
      tabsManager.makeActive(existingOnboardingTab.id)
    } else {
      tabsManager.addOnboardingTab(false, { active: true })
    }
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
    cleanupObservers()
  })

  $: tooltipStyle = $currentStep
    ? useAnchorPosition
      ? `
        position: absolute;
        ${$currentStep.position.vertical === 'center' ? `top: ${$anchorTop}px; transform: translateY(-50%);` : `top: ${$anchorTop}px;`}
        ${$currentStep.position.horizontal === 'center' ? `left: ${$anchorLeft}px; transform: translateX(-50%);` : `left: ${$anchorLeft}px;`}
        z-index:${$currentStep.zIndex || 123456};
        display: ${$currentStep?.domRoot === rootID ? 'block' : 'none'};
      `
      : `
        position: absolute;
        ${$currentStep.position.vertical === 'center' ? 'top: 50%; transform: translateY(-50%);' : `${$currentStep.position.vertical}: ${$offsetY}px;`}
        ${$currentStep.position.horizontal === 'center' ? 'left: 50%; transform: translateX(-50%);' : `${$currentStep.position.horizontal}: ${$offsetX}px;`}
        z-index:${$currentStep.zIndex || 123456};
        display: ${$currentStep?.domRoot === rootID ? 'block' : 'none'};
      `
    : ''
</script>

{#if $currentStep}
  <div
    bind:this={tooltip}
    class="tooltip"
    style={tooltipStyle}
    in:fade={{
      duration: 600,
      delay: $currentStep.target.startsWith('#notes.onboarding') ? 500 : 0
    }}
    out:fade={{ duration: 300 }}
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

      {#if $isLoading}
        <div class="loading-indicator">
          <Icon name="loading" spin />
          <span class="loading-message">{$loadingState.message || 'Loading...'}</span>
        </div>
      {/if}
    </div>
    <div class="button-container">
      {#if $currentStep.prevButtonLabel}
        <button
          class="tooltip-button back"
          on:click={prevStep}
          disabled={$isLoading}
          class:disabled={$isLoading}
        >
          <Icon name="chevron.left" />
          <!-- {$currentStep.prevButtonLabel} -->
        </button>
      {/if}
      {#if $currentStep.nextButtonLabel}
        <button
          class="tooltip-button next"
          disabled={$isLoading}
          class:disabled={$isLoading}
          on:click={() => {
            if ($currentStep.actions) {
              for (const action of $currentStep.actions) {
                if (action === OnboardingAction.CreateSpace) {
                  handleCreateSpace()
                } else if (action === OnboardingAction.SendChatMessage) {
                  handleSendChatMessage()
                } else if (action === OnboardingAction.OpenStuff) {
                  handleOpenStuff()
                } else if (action === OnboardingAction.OpenPDF) {
                  handleOpenPDF()
                } else if (action === OnboardingAction.OpenYouTubeVideo) {
                  handleOpenYouTubeVideo()
                } else if (action === OnboardingAction.InsertQuestion) {
                  handleInsertQuestion()
                } else if (action === OnboardingAction.StartAICompletion) {
                  handleStartAICompletion()
                } else if (action === OnboardingAction.CreateSurflet) {
                  handleCreateSurflet()
                } else if (action === OnboardingAction.ReturnToWelcomePage) {
                  handleReturnToWelcomePage()
                }
              }
            } else if ($currentStep.action) {
              // For backward compatibility
              if ($currentStep.action === OnboardingAction.CreateSpace) {
                handleCreateSpace()
              } else if ($currentStep.action === OnboardingAction.SendChatMessage) {
                handleSendChatMessage()
              } else if ($currentStep.action === OnboardingAction.OpenStuff) {
                handleOpenStuff()
              } else if ($currentStep.action === OnboardingAction.OpenPDF) {
                handleOpenPDF()
              } else if ($currentStep.action === OnboardingAction.OpenYouTubeVideo) {
                handleOpenYouTubeVideo()
              } else if ($currentStep.action === OnboardingAction.CreateSurflet) {
                handleCreateSurflet()
              } else if ($currentStep.action === OnboardingAction.ReturnToWelcomePage) {
                handleReturnToWelcomePage()
              }
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

  .tooltip-button.disabled {
    opacity: 0.5;
    cursor: not-allowed;
    pointer-events: none;
  }

  .loading-indicator {
    display: flex;
    align-items: center;
    margin-top: 0.5rem;
    padding: 0.5rem;
    background-color: rgba(0, 0, 0, 0.05);
    border-radius: 0.25rem;
    font-size: 0.875rem;
  }

  .loading-message {
    margin-left: 0.5rem;
    color: #666;
  }

  .tooltip:hover .tooltip-button.next:not(.disabled) {
    opacity: 1;
  }

  .tooltip-button:not(.disabled):hover {
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
    padding: 0;
    margin-right: 8px;
    border-radius: 4px;
    &:hover {
      background-color: rgba(255, 255, 255, 0.1) !important;
    }
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
