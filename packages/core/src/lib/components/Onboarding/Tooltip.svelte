<script lang="ts">
  import { onMount, onDestroy } from 'svelte'
  import { createEventDispatcher } from 'svelte'
  import { get } from 'svelte/store'
  import { wait } from '@horizon/utils'
  import { startingClass } from '../../utils/dom'
  import { activeOnboardingTabId } from '../../service/onboarding'
  import { isMac, useLogScope } from '@horizon/utils'
  import {
    nextStep,
    prevStep,
    endTimeline,
    activeStep,
    hasPendingCompletionEvent,
    completionEventMessage,
    isTimelineDismissable,
    hasActiveTimeline
  } from './timeline'
  import { OnboardingAction, CompletionEventID } from './onboardingScripts'
  import type { OnboardingActionType } from './onboardingScripts'
  import { PageChatUpdateContextEventTrigger } from '@horizon/types'
  import {
    startAIGeneration,
    endAIGeneration,
    isGeneratingAI
  } from '../../service/ai/generationState'
  import {
    useOnboardingService,
    OnboardingLoadingState,
    visionViewState
  } from '@horizon/core/src/lib/service/onboarding'
  import { useSmartNotes } from '@horizon/core/src/lib/service/ai/note'
  import { useTabsManager } from '@horizon/core/src/lib/service/tabs'
  import { useConfig } from '@horizon/core/src/lib/service/config'
  import { Icon } from '@horizon/icons'
  import { derived } from 'svelte/store'
  import { timelines } from './timeline'
  import { fade } from 'svelte/transition'
  import { MentionItemType } from '@horizon/editor'
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
  import articleChat from '../../../../public/assets/onboarding/notes/article-chat.png'
  import completion from '../../../../public/assets/onboarding/notes/completion.mp4'
  import noteChatSubmit from '../../../../public/assets/onboarding/notes/note-chat-submit.mp4'
  import chatPDF from '../../../../public/assets/onboarding/notes/chat.pdf.png'
  import noteSidebar from '../../../../public/assets/onboarding/notes/sidebar.png'
  import citations from '../../../../public/assets/onboarding/notes/citations.png'
  import openNoteInSidebar from '../../../../public/assets/onboarding/open-note-in-sidebar.png'
  import saving from '../../../../public/assets/onboarding/saving.mp4'
  import { useOasis } from '@horizon/core/src/lib/service/oasis'
  import { predefinedSurfletCode } from './predefinedSurflets'
  import ButtonSecondary from '@horizon/core/src/lib/components/Atoms/ButtonSecondary.svelte'

  export let rootID: string

  let tooltip: HTMLDivElement
  let unsubscribeFromActiveTabId: () => void

  const dispatch = createEventDispatcher<{
    'open-stuff': void
    'close-stuff': void
    'open-pdf': string
    'insert-question': string
    'start-ai-completion': string
    'toggle-sidebar': boolean
    'open-note-in-sidebar': void
    'open-note-as-tab': void
    'open-url': string
    'open-screenshot': void
    'toggle-right-sidebar': boolean
    'open-onboarding-tab': string
    close: void
    'reload-welcome-page': void
    'hide-vision': void
  }>()

  const config = useConfig()
  const log = useLogScope('Tooltip')
  const onboardingService = useOnboardingService()
  const oasis = useOasis()
  const tabsManager = useTabsManager()
  const notes = useSmartNotes()

  const currentActiveTabId = tabsManager.activeTabId

  // Derived store to get the current step
  const currentStep = derived(activeStep, ($activeStep) => $activeStep)

  // Get current timeline and total steps for debug menu
  const currentTimeline = derived([activeStep, timelines], ([$activeStep, $timelines]) => {
    if (!$activeStep) return null
    const timelineEntries = Object.entries($timelines)
    for (const [name, timeline] of timelineEntries) {
      if (timeline.steps.some((step) => step.target === $activeStep.target)) {
        return {
          name,
          timeline,
          totalSteps: timeline.steps.length,
          currentStepIndex: timeline.currentStep
        }
      }
    }
    return null
  })

  // Derived store for loading state
  const loadingState = derived(onboardingService.loadingState, ($loadingState) => $loadingState)

  // Derived store to check if any loading is happening
  const isLoading = derived(
    loadingState,
    ($loadingState) => $loadingState.state !== OnboardingLoadingState.Idle
  )

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
    saving: saving,
    'open-note-in-sidebar': openNoteInSidebar,
    'article.chat': articleChat,
    completion: completion,
    'note-chat-submit': noteChatSubmit,
    'note-sidebar': noteSidebar,
    citations: citations
  }

  // Track the previous step to detect changes
  let previousStepTarget: string | null = null
  let wasGeneratingAI = false
  let previousStepIndex: number | null = null

  // Function to update body classes based on current step
  function updateBodyClasses(step: any | null, isActive: boolean) {
    // Remove any existing onboarding classes
    document.body.classList.remove('onboarding')

    // Remove any existing step ID classes (they start with 'onboarding-step-')
    const existingStepClasses = Array.from(document.body.classList).filter((cls) =>
      cls.startsWith('onboarding-step-')
    )

    existingStepClasses.forEach((cls) => {
      document.body.classList.remove(cls)
    })

    // If there's an active timeline, add the onboarding class
    if (isActive) {
      document.body.classList.add('onboarding')

      // If there's a current step with a target, add a class with the step target
      if (step && step.target) {
        document.body.classList.add(`onboarding-step-${step.target}`)
      }
    }
  }

  // Update when current step changes and execute initialActions if available
  $: if ($currentStep) {
    // Get current timeline and step index
    const timelineInfo = get(currentTimeline)
    const currentStepIndex = timelineInfo?.currentStepIndex

    // Check if this is a new step (by comparing target and step index)
    const isNewStep =
      previousStepTarget !== $currentStep.target ||
      (currentStepIndex !== null && previousStepIndex !== currentStepIndex)

    if (isNewStep) {
      // Execute initialActions if they exist for this step
      if ($currentStep.initialActions && $currentStep.initialActions.length > 0) {
        console.log(
          'Executing initialActions for step:',
          $currentStep.target,
          $currentStep.initialActions
        )
        // Use setTimeout to ensure DOM is updated before executing actions
        setTimeout(() => {
          // Ensure initialActions is not undefined before passing to handleActions
          if ($currentStep.initialActions) {
            handleActions($currentStep.initialActions)
          }
        }, 100)
      }

      // Update tracking variables
      previousStepTarget = $currentStep.target
      previousStepIndex = currentStepIndex

      // Update body classes with the new step
      updateBodyClasses($currentStep, true)
    }
  }

  // React to changes in the active timeline state
  $: {
    updateBodyClasses($currentStep, $hasActiveTimeline)
  }

  // Handle AI generation completion and proceed to next step if proceedAfterAIGeneration is true
  $: {
    // Check if AI generation has just completed
    if (wasGeneratingAI && !$isGeneratingAI && $currentStep?.proceedAfterAIGeneration) {
      console.log('AI generation completed, proceeding to next step automatically')
      // Small delay to ensure UI updates properly
      setTimeout(() => {
        nextStep()
      }, 500)
    }
    // Update the tracking variable
    wasGeneratingAI = $isGeneratingAI
  }

  // Get anchor position CSS properties
  $: anchorPosition = $currentStep?.domAnchor || null
  $: hasAnchor = Boolean(anchorPosition)

  // Track if we're using alternative positioning due to collision
  let usingAlternativePosition = false

  // Check for collisions with safe area elements
  function checkSafeAreaCollision(step: any, tooltipElement: HTMLElement): boolean {
    // If no safe area defined or tooltip element not available, return false (no collision)
    if (!step.safeArea || !tooltipElement) return false

    // Get tooltip bounding box
    const tooltipRect = tooltipElement.getBoundingClientRect()

    // Check each safe area element for collision
    for (const safeAreaSelector of step.safeArea) {
      const safeAreaElements = document.querySelectorAll(
        `[data-tooltip-safearea="${safeAreaSelector}"]`
      )

      for (const safeAreaElement of safeAreaElements) {
        const safeAreaRect = safeAreaElement.getBoundingClientRect()

        // Check for intersection between tooltip and safe area
        if (
          tooltipRect.left < safeAreaRect.right &&
          tooltipRect.right > safeAreaRect.left &&
          tooltipRect.top < safeAreaRect.bottom &&
          tooltipRect.bottom > safeAreaRect.top
        ) {
          // Collision detected
          return true
        }
      }
    }

    // No collision detected
    return false
  }

  // Function to update positioning after DOM update
  function updatePositioningAfterRender() {
    if (!$currentStep || !tooltip) return

    // Check for collision with safe area
    if ($currentStep.safeArea && $currentStep.alternativePosition) {
      // First check with primary position
      usingAlternativePosition = false
      tooltip.setAttribute('style', getPositioningStyle($currentStep))

      // After a brief delay to allow positioning to apply
      setTimeout(() => {
        const hasCollision = checkSafeAreaCollision($currentStep, tooltip)

        if (hasCollision && $currentStep.alternativePosition) {
          // Use alternative position
          usingAlternativePosition = true
          tooltip.setAttribute('style', getPositioningStyle($currentStep))
        }
      }, 10)
    }
  }

  // Update positioning when step changes
  $: if ($currentStep) {
    // Use setTimeout to ensure DOM is updated
    setTimeout(updatePositioningAfterRender, 50)
  }

  // Get positioning CSS based on the step configuration
  $: positioningStyle = $currentStep ? getPositioningStyle($currentStep) : ''

  function getPositioningStyle(step: any) {
    // Determine which position to use (primary or alternative)
    const position =
      usingAlternativePosition && step.alternativePosition
        ? step.alternativePosition
        : step.position

    if (step.domAnchor) {
      // Use CSS anchor positioning with viewport boundary constraints
      const { vertical, horizontal, offsetX = 0, offsetY = 0 } = position

      let verticalStyle = ''
      let horizontalStyle = ''

      // Map positioning to anchor properties with viewport clamping
      switch (vertical) {
        case 'top':
          // Position tooltip ABOVE the anchor (use top property with negative offset from anchor top)
          verticalStyle = `top: clamp(calc(var(--tooltip-viewport-margin) - var(--tooltip-max-height)), calc(anchor(top) - var(--tooltip-max-height) + ${offsetY}px), calc(100vh - var(--tooltip-positioning-buffer)));`
          break
        case 'bottom':
          // Position tooltip BELOW the anchor (tooltip's top edge to anchor's bottom edge)
          verticalStyle = `top: clamp(calc(var(--tooltip-viewport-margin) - var(--tooltip-max-height)), calc(anchor(bottom) + ${offsetY}px), calc(100vh - var(--tooltip-positioning-buffer)));`
          break
        case 'center':
          // For center, use min/max to stay within bounds (accounting for transform)
          verticalStyle = `top: max(calc(var(--tooltip-viewport-margin) - var(--tooltip-max-height)), min(calc(anchor(center) + ${offsetY}px), calc(100vh - var(--tooltip-positioning-buffer)))); transform: translateY(-50%);`
          break
        default:
          // Default to bottom positioning
          verticalStyle = `top: clamp(calc(var(--tooltip-viewport-margin) - var(--tooltip-max-height)), calc(anchor(bottom) + ${offsetY}px), calc(100vh - var(--tooltip-positioning-buffer)));`
      }

      switch (horizontal) {
        case 'left':
          // Position tooltip's left edge relative to anchor's left edge (can go negative for left-side positioning)
          horizontalStyle = `left: clamp(calc(var(--tooltip-viewport-margin) - var(--tooltip-max-width)), calc(anchor(left) + ${offsetX}px), calc(100vw - var(--tooltip-max-width) - var(--tooltip-viewport-padding)));`
          break
        case 'right':
          // Position tooltip's left edge relative to anchor's right edge (can go negative for right-side positioning)
          horizontalStyle = `left: clamp(calc(var(--tooltip-viewport-margin) - var(--tooltip-max-width)), calc(anchor(right) + ${offsetX}px), calc(100vw - var(--tooltip-max-width) - var(--tooltip-viewport-padding)));`
          break
        case 'center':
          // For center, ensure it stays within bounds (accounting for transform)
          horizontalStyle = `left: max(calc(var(--tooltip-viewport-margin) - var(--tooltip-max-width)), min(calc(anchor(center) + ${offsetX}px), calc(100vw - var(--tooltip-max-width) - var(--tooltip-viewport-padding)))); transform: translateX(-50%);`
          break
        default:
          horizontalStyle = `left: clamp(calc(var(--tooltip-viewport-margin) - var(--tooltip-max-width)), calc(anchor(left) + ${offsetX}px), calc(100vw - var(--tooltip-max-width) - var(--tooltip-viewport-padding)));`
      }

      // Handle both transforms if both center alignments are used
      let transformStyle = ''
      if (vertical === 'center' && horizontal === 'center') {
        transformStyle = 'transform: translate(-50%, -50%);'
      } else if (vertical === 'center') {
        transformStyle = 'transform: translateY(-50%);'
      } else if (horizontal === 'center') {
        transformStyle = 'transform: translateX(-50%);'
      }

      return `
        position: absolute;
        position-anchor: --${step.domAnchor};
        ${verticalStyle}
        ${horizontalStyle}
        ${transformStyle}
        z-index: ${step.zIndex || 123456};
        display: ${step?.domRoot === rootID ? 'block' : 'none'};
        /* Constrain to viewport */
        max-width: var(--tooltip-max-width);
        max-height: var(--tooltip-max-height);
        overflow: auto;
        /* Additional safety: ensure tooltip bottom never exceeds viewport */
        bottom: max(var(--tooltip-viewport-margin), auto);
      `
    } else {
      // Fallback to traditional positioning with viewport constraints
      const { vertical, horizontal, offsetX = 0, offsetY = 0 } = position

      return `
        position: absolute;
        ${vertical === 'center' ? 'top: 50%; transform: translateY(-50%);' : `${vertical}: max(var(--tooltip-fallback-padding), ${offsetY}px);`}
        ${horizontal === 'center' ? 'left: 50%; transform: translateX(-50%);' : `${horizontal}: max(var(--tooltip-fallback-padding), ${offsetX}px);`}
        ${vertical === 'center' && horizontal === 'center' ? 'transform: translate(-50%, -50%);' : ''}
        z-index: ${step.zIndex || 123456};
        display: ${step?.domRoot === rootID ? 'block' : 'none'};
        /* Ensure tooltip doesn't exceed viewport bounds */
        max-width: var(--tooltip-max-width);
        max-height: var(--tooltip-max-height);
        overflow: auto;
      `
    }
  }

  // Event handler for custom event
  const handleExecuteActionsEvent = (event: CustomEvent) => {
    const { actions } = event.detail
    if (actions && Array.isArray(actions)) {
      handleActions(actions)
    }
  }

  const handleReloadWelcomePage = () => {
    // This marks the onboarding as completed
    config.updateSettings({ has_seen_hero_screen: true })

    dispatch('reload-welcome-page')
  }

  // Function to handle actions
  const handleActions = (actions: OnboardingActionType[]) => {
    for (const actionItem of actions) {
      // Handle both string and object formats
      let action: OnboardingAction
      let params: Record<string, any> = {}

      if (typeof actionItem === 'string') {
        action = actionItem
      } else {
        action = actionItem.action
        params = actionItem.params || {}
      }

      console.log('handleActions', action, params)

      if (action === OnboardingAction.CreateSpace) {
        handleCreateSpace(params)
      } else if (action === OnboardingAction.SendChatMessage) {
        handleSendChatMessage(params)
      } else if (action === OnboardingAction.OpenStuff) {
        handleOpenStuff(params)
      } else if (action === OnboardingAction.OpenPDF) {
        handleOpenPDF(params)
      } else if (action === OnboardingAction.OpenURL) {
        handleOpenURL(params)
      } else if (action === OnboardingAction.InsertQuestion) {
        handleInsertQuestion(params)
      } else if (action === OnboardingAction.StartAICompletion) {
        handleStartAICompletion(params)
      } else if (action === OnboardingAction.CreateSurflet) {
        handleCreateSurflet(params)
      } else if (action === OnboardingAction.ReturnToWelcomePage) {
        handleReturnToWelcomePage(params)
      } else if (action === OnboardingAction.ToggleTabBar) {
        handleToggleTabBar(params)
      } else if (action === OnboardingAction.FinishNotesOnboarding) {
        handleFinishNotesOnboarding(params)
      } else if (action === OnboardingAction.OpenNoteInSidebar) {
        handleOpenNoteInSidebar(params)
      } else if (action === OnboardingAction.OpenNoteAsTab) {
        handleOpenNoteAsTab(params)
      } else if (action === OnboardingAction.OpenTab) {
        handleOpenTab(params)
      } else if (action === OnboardingAction.OpenYouTubeVideo) {
        handleOpenYouTubeVideo()
      } else if (action === OnboardingAction.TriggerVision) {
        handleTriggerVision()
      } else if (action === OnboardingAction.ToggleRightSidebar) {
        handleToggleRightSidebar(params)
      } else if (action === OnboardingAction.OpenOnboardingTab) {
        handleOpenOnboardingTab(params)
      } else if (action === OnboardingAction.SubmitVisionPrompt) {
        handleSubmitVisionPrompt(params)
      } else if (action === OnboardingAction.AddTextToNote) {
        handleAddTextToNote()
      } else if (action === OnboardingAction.CloseStuff) {
        handleCloseStuff()
      } else if (action === OnboardingAction.AskOnboardingSpace) {
        handleAskOnboardingSpace(params)
      } else if (action === OnboardingAction.InsertOnboardingFooterIntoNote) {
        handleInsertOnboardingFooterIntoNote(params)
      } else if (action === OnboardingAction.InsertUseAsDefaultBrowserIntoNote) {
        handleInsertUseAsDefaultBrowserIntoNote()
      } else if (action === OnboardingAction.HideVision) {
        handleHideVision()
      } else if (action === OnboardingAction.ReloadWelcomePage) {
        handleReloadWelcomePage()
      } else if (action === OnboardingAction.TrackOnboardingTab) {
        handleTrackOnboardingTab()
      }
    }
  }

  const handleCreateSpace = (params: Record<string, any> = {}) => {
    const button = document.querySelector(
      `[data-tooltip-action="${OnboardingAction.CreateSpace}"]`
    ) as HTMLButtonElement
    if (button) {
      button.click()
    }
  }

  const handleSendChatMessage = (params: Record<string, any> = {}) => {
    const question = params.question || 'What is the Apollo 11 mission?'
    dispatch('insert-question', question)
  }

  const handleOpenStuff = async (params: Record<string, any> = {}) => {
    const spaceId = params.spaceId || 'all'
    oasis.selectedSpace.set(spaceId)
    dispatch('open-stuff')
  }

  const handleCloseStuff = () => {
    dispatch('close-stuff')
  }

  const handleOpenPDF = (params: Record<string, any> = {}) => {
    // Open PDF with optional custom URL and question
    const url = params.url || 'https://arxiv.org/pdf/2112.08540'
    const question =
      params.question || 'Explain the landinglanding efficiency two very short paragraphs.'

    onboardingService.openURLAndChat(url, question)
  }

  const handleToggleTabBar = (params: Record<string, any> = {}) => {
    const visible = params.visible !== undefined ? params.visible : false
    dispatch('toggle-sidebar', visible)
  }

  const handleToggleRightSidebar = (params: Record<string, any> = {}) => {
    const visible = params.visible !== undefined ? params.visible : false
    dispatch('toggle-right-sidebar', visible)
  }

  const handleFinishNotesOnboarding = (params: Record<string, any> = {}) => {
    const sidebarVisible = params.sidebarVisible !== undefined ? params.sidebarVisible : true
    dispatch('toggle-sidebar', sidebarVisible)
  }

  const handleOpenNoteInSidebar = (params: Record<string, any> = {}) => {
    const button = document.querySelector(
      `[data-tooltip-action="${OnboardingAction.OpenNoteInSidebar}"]`
    ) as HTMLButtonElement
    if (button) {
      button.click()
    } else {
      log.debug('Open in Sidebar Button not found')
    }
  }

  const handleOpenNoteAsTab = (params: Record<string, any> = {}) => {
    const note = notes.activeNoteValue
    console.log('xxx-note', note)
    if (note) {
      tabsManager.openResourcFromContextAsPageTab(note.id)
      dispatch('close')

      // Dispatch the completion event to trigger advancement to the next step
      // This is critical for steps with actionCanSkipCompletionEvent
      const customEvent = new CustomEvent(CompletionEventID.OpenNoteAsTab)
      document.dispatchEvent(customEvent)
    }
  }

  const handleOpenURL = async (params: Record<string, any> = {}) => {
    if (onboardingService.aiService?.contextManager) {
      onboardingService.aiService.contextManager.clear(
        PageChatUpdateContextEventTrigger.ChatAddContextMenu
      )
    }

    const url = params.url
    const question = params.question

    onboardingService.openURLAndChat(url, question)
  }

  const handleInsertQuestion = (params: Record<string, any> = {}) => {
    const question = params.question || 'What are the key findings of this paper?'
    dispatch('insert-question', question)
  }

  const handleStartAICompletion = (params: Record<string, any> = {}) => {
    const prompt = params.prompt || 'What is this content about?'
    dispatch('start-ai-completion', prompt)
  }

  const handleHideVision = () => {
    visionViewState.set('empty')
    dispatch('hide-vision')
  }

  const handleCreateSurflet = (params: Record<string, any> = {}) => {
    // Clear the current context to ensure clean generation
    onboardingService.aiService?.contextManager.clear()

    // Show the query in the chat input without submitting it
    if (onboardingService.magicSidebar?.insertQueryIntoChat) {
      const surfletQuery =
        'Create a Surflet that shows the final stage of the moon landing in a timeline.'
      onboardingService.magicSidebar.insertQueryIntoChat(surfletQuery)

      // Start a fake generation process
      startAIGeneration('onboarding', `Creating Surflet: ${surfletQuery}`)

      // Wait a moment and then start streaming the surflet code
      setTimeout(() => {
        try {
          // Use the streamSurfletCode method to create a realistic streaming effect
          // This will create the surflet with initial content and then stream updates
          onboardingService.streamSurfletCode(
            predefinedSurfletCode, // Full code to stream
            100, // Initial chunk size
            500, // Size of each additional chunk
            100 // Delay between chunks (ms)
          )

          // Calculate total streaming time based on code length and chunk parameters
          const codeLength = predefinedSurfletCode.length
          const initialChunkSize = 100
          const chunkSize = 500
          const delayBetweenChunks = 120
          const chunksNeeded = Math.ceil((codeLength - initialChunkSize) / chunkSize)
          const totalStreamingTime = chunksNeeded * delayBetweenChunks + 500 // Add buffer

          // End the fake generation process after streaming completes
          setTimeout(() => {
            endAIGeneration()
          }, totalStreamingTime)
        } catch (err) {
          console.error('Error creating surflet:', err)
          endAIGeneration()
        }
      }, 2000) // Wait 2 seconds before starting the stream
    }
  }

  const handleSubmitVisionPrompt = (params: Record<string, any> = {}) => {
    const input = params.input || ''

    const event = new CustomEvent('onboarding-submit-vision-prompt', {
      bubbles: true,
      detail: {
        input: input
      }
    })

    console.log('sending event', event)
    dispatchEvent(event)
  }

  const handleReturnToWelcomePage = (params: Record<string, any> = {}) => {
    // This marks the onboarding as completed
    config.updateSettings({ has_seen_hero_screen: true })

    // Find existing onboarding tab
    const existingOnboardingTab = tabsManager.tabsValue.find((tab) => tab.type === 'onboarding')

    const makeActive = params.makeActive !== undefined ? params.makeActive : true

    if (existingOnboardingTab) {
      tabsManager.makeActive(existingOnboardingTab.id)
    } else {
      tabsManager.addOnboardingTab(false, { active: makeActive })
    }
  }

  const handleOpenTab = (params: Record<string, any> = {}) => {
    const url = params.url

    console.log('handleOpenTab', url)
    if (!url) {
      console.error('No URL provided for tab')
      return
    }

    dispatch('open-url', url)
  }

  const handleOpenOnboardingTab = (params: Record<string, any> = {}) => {
    dispatch('open-onboarding-tab', params.section)
  }

  const handleAskOnboardingSpace = async (params: Record<string, any> = {}) => {
    const query = params.query
    const mention = params.mention

    const tab = getOnboardingTab()

    if (!tab || !tab.resourceId) {
      console.error('No onboarding tab or resource ID found')
      return
    }

    // Find the space with the matching name
    const spaces = oasis.spacesObjectsValue
    const matchingSpace = spaces.find((space) => space.dataValue.folderName === mention)

    if (!matchingSpace) {
      console.warn(`Could not find space with name "${mention}", using fallback ID`)
    }

    await wait(500)

    // Create a properly formatted mention item that will be recognized by the context system
    const mentionEvent = new CustomEvent('insert-onboarding-mention', {
      detail: {
        id: matchingSpace?.id,
        label: mention,
        type: MentionItemType.CONTEXT, // Use the proper enum value
        icon: 'sparkles',
        query: query,
        // Add additional properties that context items typically have
        aliases: ['onboarding', 'tutorial', 'help'],
        suggestionLabel: mention
      },
      bubbles: true,
      composed: true
    })

    try {
      document.dispatchEvent(mentionEvent)
      console.log(
        'Dispatched insert-onboarding-mention event with context item',
        matchingSpace ? `Found space: ${matchingSpace.id}` : 'Using fallback ID'
      )
    } catch (error) {
      console.error('Error dispatching mention event:', error)
    }
  }

  const handleInsertOnboardingFooterIntoNote = async (params: Record<string, any> = {}) => {
    const tab = getOnboardingTab()

    if (!tab || !tab.resourceId) {
      console.error('No onboarding tab or resource ID found')
      return
    }

    // Get links from params
    const links = params.links || []

    if (!links.length) {
      console.warn('No links provided for onboarding footer')
    }

    await wait(500)

    // Create a custom event to insert the onboarding footer with links
    const insertEvent = new CustomEvent('insert-onboarding-footer', {
      detail: { links },
      bubbles: true,
      composed: true
    })

    try {
      document.dispatchEvent(insertEvent)
      console.log('Dispatched insert-onboarding-footer event with links:', links)
    } catch (error) {
      console.error('Error dispatching insert-onboarding-footer event:', error)
    }
  }

  const handleOpenYouTubeVideo = () => {
    // Open YouTube video
    onboardingService.openURLAndChat(
      'https://www.youtube.com/watch?v=B1J2RMorJXM',
      'Describe the final approach in two very short paragraphs.'
    )
  }

  const handleInsertUseAsDefaultBrowserIntoNote = async () => {
    const tab = getOnboardingTab()

    if (!tab || !tab.resourceId) {
      console.error('No onboarding tab or resource ID found')
      return
    }

    await wait(500)

    // Create a custom event to insert the UseAsDefaultBrowser extension
    const insertEvent = new CustomEvent('insert-use-as-default-browser', {
      bubbles: true,
      composed: true
    })

    try {
      document.dispatchEvent(insertEvent)
      console.log('Dispatched insert-use-as-default-browser event')
    } catch (error) {
      console.error('Error dispatching insert-use-as-default-browser event:', error)
    }
  }

  const handleTriggerVision = () => {
    dispatch('open-screenshot')
  }

  const handleTrackOnboardingTab = async () => {
    await wait(500)
    const activeTab = get(currentActiveTabId)
    if (activeTab) {
      console.log('Tracking onboarding tab ID:', activeTab)
      activeOnboardingTabId.set(activeTab)
    } else {
      console.log('No active onboarding tab found')
      activeOnboardingTabId.set(null)
    }
  }

  /**
   * Get the appropriate tab for onboarding actions
   * This will first try to get the tab from activeOnboardingTabId, then fall back to the active tab
   * @returns The onboarding tab or active tab
   */
  const getOnboardingTab = () => {
    // First try to get the tab from the stored onboarding tab ID
    const onboardingTabId = get(activeOnboardingTabId)
    if (onboardingTabId) {
      const onboardingTab = tabsManager.get(onboardingTabId)
      if (onboardingTab) {
        return onboardingTab
      }
    }

    // Fall back to the active tab
    return tabsManager.activeTabValue
  }

  const handleAddTextToNote = async () => {
    const tab = getOnboardingTab()

    if (!tab || !tab.resourceId) {
      console.error('No onboarding tab or resource ID found')
      return
    }

    await wait(500)

    // Create a custom event to insert a Button extension
    const insertEvent = new CustomEvent('insert-button-to-note', {
      detail: {
        text: `Open Stuff (${isMac() ? '⌘' : 'Ctrl'} + O)`,
        action: 'onboarding-open-stuff'
      },
      bubbles: true,
      composed: true
    })

    try {
      document.dispatchEvent(insertEvent)
      console.log('Dispatched insert-button-to-note event')
    } catch (error) {
      console.error('Error dispatching insert-button-to-note event:', error)
    }
  }

  const handleExitOnboarding = () => {
    config.updateSettings({ has_seen_hero_screen: true })

    dispatch('toggle-sidebar', true)
    endTimeline()
    // HACK: We  unmute all the tabs after onboarding
    for (let [_, browserTab] of Object.entries(tabsManager.browserTabsValue)) {
      browserTab.setMute(false)
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

    // Add event listener for custom event
    document.addEventListener(
      'onboarding-execute-actions',
      handleExecuteActionsEvent as EventListener
    )

    // Initialize body classes based on current state
    updateBodyClasses($currentStep, $hasActiveTimeline)
  })

  onDestroy(() => {
    if (tooltip && tooltip.parentNode) {
      tooltip.parentNode.removeChild(tooltip)
    }

    // Remove event listener
    document.removeEventListener(
      'onboarding-execute-actions',
      handleExecuteActionsEvent as EventListener
    )

    // Clean up body classes when component is destroyed
    updateBodyClasses(null, false)

    // Reset the active onboarding tab ID when the component is destroyed
    activeOnboardingTabId.set(null)
  })
</script>

{#if $currentTimeline}
  <div class="debug-menu">
    <div class="debug-nav">
      <span
        >Active Onboarding Tab ID: {$activeOnboardingTabId}, Active Tab ID: {$currentActiveTabId}</span
      >
      <button class="debug-arrow" on:click={prevStep} aria-label="Previous step">&#9664;</button>
      <div class="debug-bullets">
        {#each Array($currentTimeline.totalSteps) as _, i}
          <span
            class="debug-bullet {i === $currentTimeline.currentStepIndex ? 'active' : ''}"
            on:click={() => {
              // Go back to previous steps
              if (i < $currentTimeline.currentStepIndex) {
                for (let j = 0; j < $currentTimeline.currentStepIndex - i; j++) {
                  prevStep()
                }
              }
              // Go forward to next steps
              else if (i > $currentTimeline.currentStepIndex) {
                for (let j = 0; j < i - $currentTimeline.currentStepIndex; j++) {
                  nextStep()
                }
              }
            }}
          >
            &#9679;
          </span>
        {/each}
      </div>
      <button class="debug-arrow" on:click={nextStep} aria-label="Next step">&#9654;</button>
    </div>
    <div class="debug-info">
      Timeline: {$currentTimeline.name} | Step: {$currentTimeline.currentStepIndex +
        1}/{$currentTimeline.totalSteps}
    </div>
    <div class="debug-actions">
      <button
        class="debug-reset-button"
        on:click={() => {
          config.updateSettings({ has_seen_hero_screen: false })
          console.log('Hero screen setting reset - will show on next app launch')
        }}
      >
        Reset Hero Screen
      </button>
    </div>
  </div>
{/if}

<!-- Show return button when active tab is different from onboarding tab -->
{#if $currentTimeline && $activeOnboardingTabId && $currentActiveTabId !== $activeOnboardingTabId}
  <div class="return-to-onboarding" use:startingClass={{}}>
    <ButtonSecondary
      text="→ Return to Onboarding"
      onClick={() => {
        if ($activeOnboardingTabId) {
          tabsManager.makeActive($activeOnboardingTabId)
          console.log('Returning to onboarding tab:', $activeOnboardingTabId)
        }
      }}
    />
  </div>
{/if}

{#if $currentTimeline}
  <div class="exit-onboarding" use:startingClass={{}}>
    <button on:click={handleExitOnboarding}>
      <span>Exit Onboarding</span>
    </button>
  </div>
{/if}

{#if $currentStep}
  {#if !$currentStep.invisible}
    <div
      bind:this={tooltip}
      class="tooltip"
      style={positioningStyle}
      in:fade={{ duration: 600, delay: 0 }}
      out:fade={{ duration: 300 }}
      role="none"
    >
      <div
        class="headline-container"
        class:dismissable={$isTimelineDismissable}
        class:minimized={$currentStep.minimized}
      >
        {#if $currentStep.minimized}
          <div class="minimized-spinner">
            <Icon name="spinner" />
          </div>
        {/if}
        <p>{$currentStep.headline}</p>

        {#if $isTimelineDismissable && !$currentStep.minimized}
          <button class="tooltip-button close-button" on:click={endTimeline}>
            <Icon name="close" color="white" />
          </button>
        {/if}
      </div>

      {#if !$currentStep.minimized}
        {#if $currentStep.mediaID && $currentStep.mediaType}
          {#if $currentStep.mediaType === 'image'}
            <img
              src={mediaSources[$currentStep.mediaID]}
              alt="Tooltip media"
              class="tooltip-media"
            />
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
          {#if $currentStep.content}
            <p>{@html $currentStep.content}<br /></p>
          {/if}

          {#if $hasPendingCompletionEvent && $completionEventMessage && !($currentStep.completionEvent && typeof $currentStep.completionEvent === 'object' && $currentStep.completionEvent.optional)}
            <div class="completion-message">
              <div class="header">Task</div>
              <div class="message">
                {$completionEventMessage}
              </div>
            </div>
          {/if}

          {#if $isLoading}
            <div class="loading-indicator">
              <Icon name="spinner" spin />
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
          {:else}
            <div style="flex-grow: 1;width: 100%;"></div>
          {/if}

          {#if $currentStep.nextButtonLabel}
            <button
              class="tooltip-button next"
              disabled={$isLoading ||
                ($hasPendingCompletionEvent &&
                  !(
                    ($currentStep.completionEvent &&
                      typeof $currentStep.completionEvent === 'object' &&
                      $currentStep.completionEvent.optional) ||
                    $currentStep.actionCanSkipCompletionEvent
                  ))}
              class:disabled={$isLoading ||
                ($hasPendingCompletionEvent &&
                  !(
                    ($currentStep.completionEvent &&
                      typeof $currentStep.completionEvent === 'object' &&
                      $currentStep.completionEvent.optional) ||
                    $currentStep.actionCanSkipCompletionEvent
                  ))}
              on:click={() => {
                // Get state before any actions are executed
                const hasCompletionEvent = !!$currentStep.completionEvent
                const shouldSkip = $currentStep.actionCanSkipCompletionEvent === true
                const hasPending = $hasPendingCompletionEvent

                if ($currentStep.actions) {
                  // Check if this step has proceedAfterAIGeneration
                  // If so, we need special handling to ensure actions have time to complete
                  if ($currentStep.proceedAfterAIGeneration) {
                    console.log(
                      'Step has proceedAfterAIGeneration, executing actions without advancing'
                    )
                    // Just execute the actions and let the AI generation completion handle advancement
                    handleActions($currentStep.actions)
                    // Don't advance to next step - the AI generation completion will do that
                    return
                  }

                  // Normal flow for steps without proceedAfterAIGeneration
                  // Execute the actions first
                  handleActions($currentStep.actions)

                  // For steps with actionCanSkipCompletionEvent, we need to manually
                  // trigger the completion event from the button click
                  if (hasCompletionEvent && shouldSkip) {
                    // Get the event ID
                    let eventId
                    try {
                      if (typeof $currentStep.completionEvent === 'string') {
                        eventId = $currentStep.completionEvent
                      } else {
                        eventId = $currentStep.completionEvent.eventId
                      }

                      console.log(
                        `Manually dispatching completion event ${eventId} from button click`
                      )
                      // Dispatch the event to trigger the completion handler
                      const customEvent = new CustomEvent(eventId)
                      document.dispatchEvent(customEvent)
                    } catch (e) {}

                    // Note: We don't call nextStep() here because the completion event handler will do it
                  } else {
                    // For normal steps without special completion handling, just advance
                    nextStep()
                  }
                } else {
                  // No actions, just go to next step
                  nextStep()
                }
              }}
            >
              {$currentStep.nextButtonLabel}
            </button>
          {/if}
        </div>
      {/if}
    </div>
  {/if}
{/if}

<style lang="scss">
  /* CSS Variables for Tooltip Positioning */
  :root {
    --tooltip-max-width: 420px;
    --tooltip-max-height: 560px;
    --tooltip-viewport-margin: 10px;
    --tooltip-viewport-padding: 20px;
    --tooltip-positioning-buffer: 500px;
    --tooltip-horizontal-fallback-width: 440px;
    --tooltip-fallback-padding: 40px;
  }

  /* CSS Anchor Positioning */
  :global([data-tooltip-anchor]) {
    anchor-name: var(--anchor-name);
  }

  :global([data-tooltip-anchor='screen-picker']) {
    anchor-name: --screen-picker;
  }

  :global([data-tooltip-anchor='sidebar-right']) {
    anchor-name: --sidebar-right;
  }

  :global([data-tooltip-anchor='sidebar-left']) {
    anchor-name: --sidebar-left;
  }

  :global([data-tooltip-anchor='chat-input']) {
    anchor-name: --chat-input;
  }

  :global([data-tooltip-anchor='stuff-button']) {
    anchor-name: --stuff-button;
  }

  :global([data-tooltip-anchor='tab-bar']) {
    anchor-name: --tab-bar;
  }

  :global([data-tooltip-anchor='notes-editor']) {
    anchor-name: --notes-editor;
  }

  :global([data-tooltip-anchor='browser-context']) {
    anchor-name: --browser-context;
  }

  :global(body.onboarding [data-tooltip-disable]) {
    pointer-events: none;
    opacity: 0.4;
    cursor: not-allowed;
  }

  :global(
      body.onboarding.onboarding-step-\#app\.onboarding\.open-in-sidebar
        [data-tooltip-target='open-in-sidebar-button']
    ),
  :global(
      body.onboarding.onboarding-step-\#app\.onboarding\.open-in-sidebar
        [data-tooltip-target='open-note-as-tab']
    ) {
    animation: pulse 1.75s ease-in-out infinite;

    &:hover {
      animation: none;
    }
  }

  :global(
      body.onboarding.onboarding-step-\#app\.onboarding\.open-note-as-tab
        [data-tooltip-target='open-note-as-tab']
    ) {
    outline: 2px solid var(--ring-color);
    border-radius: 0.5rem;
  }

  @keyframes pulse {
    0%,
    100% {
      transform: scale(1);
    }
    15% {
      transform: scale(1.2);
    }
    50% {
      transform: scale(1);
    }
    65% {
      transform: scale(1.2);
    }
  }

  .return-to-onboarding {
    position: fixed;
    top: 4rem;
    left: 50%;
    transform: translateX(-50%);
    z-index: 999999;
    user-select: none;
    opacity: 1;
    transition:
      opacity 0.5s,
      scale 0.5s;

    &:global(._starting) {
      opacity: 0;
    }
  }

  .exit-onboarding {
    position: fixed;
    bottom: 1.5rem;
    left: 1.5rem;
    z-index: 999999999999999;
    user-select: none;
    opacity: 0.5;
    transition:
      opacity 0.5s,
      scale 0.5s;

    &:global(._starting) {
      opacity: 0;
    }

    &:hover {
      opacity: 1;
      background: initial;
    }

    button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      padding: 0.75rem 1rem;
      border-radius: 0.75rem;
      background: rgba(0, 0, 0, 0.05);
      color: #222;
      font-size: 0.85rem;
      font-weight: 500;
      line-height: 0.8;
      text-align: center;
      cursor: pointer;
      border: none;
    }
  }

  /* Debug Menu Styles */
  .debug-menu {
    display: none;
    position: fixed;
    bottom: 20px;
    left: 20px;
    background-color: #000;
    color: #fff;
    padding: 10px;
    border-radius: 5px;
    font-family: monospace;
    z-index: 999999;
    box-shadow: 0 0 10px rgba(0, 0, 0, 0.5);
    user-select: none;
  }

  .debug-nav {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 5px;
  }

  .debug-arrow {
    background: none;
    border: none;
    color: #fff;
    font-size: 16px;
    cursor: pointer;
    padding: 0 5px;
  }

  .debug-bullets {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 5px;
  }

  .debug-bullet {
    cursor: pointer;
    font-size: 10px;
    opacity: 0.5;
  }

  .debug-actions {
    margin-top: 8px;
    display: flex;
    justify-content: center;
  }

  .debug-reset-button {
    background-color: #333;
    color: #fff;
    border: 1px solid #555;
    border-radius: 3px;
    padding: 3px 8px;
    font-size: 11px;
    cursor: pointer;
    transition: background-color 0.2s;

    &:hover {
      background-color: #444;
    }

    &:active {
      background-color: #222;
    }
  }

  .debug-bullet.active {
    opacity: 1;
    color: #4952f2;
  }

  .debug-info {
    font-size: 10px;
    text-align: center;
  }
  .tooltip {
    background-color: #f9f9f9;
    border: 0.5px solid rgba(73, 82, 242, 0.9);
    outline: 3px solid rgba(73, 82, 242, 0.5);
    border-radius: 1.06rem;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    z-index: 123456;
    max-width: 420px;
    border: 0.5px solid rgba(73, 82, 242, 0.13);
  }

  .minimized-spinner {
    display: flex;
    align-items: center;
    justify-content: center;
    margin-left: auto;
    color: white;
    margin-right: 0.66rem;
    max-width: 48ch;
    position: relative;
    transition: width 0.3s ease-in-out;
  }

  .headline-container {
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: linear-gradient(to right, rgba(73, 82, 242, 0.6), rgba(73, 82, 242, 0.5));
    padding: 0.25rem 0 0.25rem 0.75rem;
    border-top-left-radius: 1.05rem;
    border-top-right-radius: 1.05rem;
    color: #fff;
    p {
      padding: 0;
      line-height: 1;
    }
    &.minimized {
      border-radius: 1.05rem;
    }
    &:not(.dismissable) {
      padding: 0.75rem;
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

  .completion-message {
    font-family: 'Inter', sans-serif;
    background-color: rgba(73, 82, 242, 0.1);
    border-radius: 0.75rem;
    margin: 0.5rem 0;
    font-size: 0.9rem;
    line-height: 1;
    color: rgba(73, 82, 242, 0.9);
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    border: 1px dashed rgba(73, 82, 242, 0.1);
    box-shadow: 0px 2px 4px rgba(73, 82, 242, 0.1);
    & .header {
      font-weight: 450;
      padding: 0.33rem 1.25rem;
      width: 100%;
      color: rgba(73, 82, 242, 0.67);
      border-bottom: 1px solid rgba(73, 82, 242, 0.1);
    }
    & .message {
      width: 100%;
      padding: 0.75rem 1.25rem;
      line-height: 130%;
    }
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
    button {
      min-width: max-content;
    }
  }
</style>
