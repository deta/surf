import { writable, get, derived } from 'svelte/store'
import type { TooltipStep, OnboardingTimeline } from './onboardingScripts'
import { OnboardingAction } from './onboardingScripts'
import * as scripts from './onboardingScripts'
import type { OnboardingActionType } from './onboardingScripts'
import { activeOnboardingTabId } from '../../service/onboarding'

import { OnboardingFeature } from './onboardingScripts'
import { ConfigService } from '@horizon/core/src/lib/service/config'

interface Timeline {
  steps: TooltipStep[]
  currentStep: number
}

export const timelines = writable<Record<string, Timeline>>({})

// Initialize timelines from scripts
Object.values(scripts).forEach((script) => {
  const timeline = script as OnboardingTimeline
  if ('name' in timeline && 'steps' in timeline) {
    timelines.update((t) => ({
      ...t,
      [timeline.name]: { steps: timeline.steps, currentStep: 0 }
    }))
  }
})

// Store for the active timeline
const activeTimeline = writable<OnboardingFeature | null>(null)

export const hasActiveTimeline = derived(
  activeTimeline,
  ($activeTimeline) => $activeTimeline !== null
)

// Store to track if the current step has a pending completion event
export const hasPendingCompletionEvent = writable<boolean>(false)

// Store to hold the completion event message
export const completionEventMessage = writable<string>('')

// Store to track whether the current timeline is dismissable
export const isTimelineDismissable = writable<boolean>(true)

let previousTargetElements: Element[] = []
let currentDomTarget: string | null = null
let currentCompletionEventListener: { event: string; handler: EventListener } | null = null

export const activeStep = derived([activeTimeline, timelines], ([$activeTimeline, $timelines]) => {
  if ($activeTimeline && $timelines[$activeTimeline]) {
    const timeline = $timelines[$activeTimeline]
    const currentStep = timeline.steps[timeline.currentStep]

    // Only remove and re-add tooltip target class if the domTarget has changed
    if (currentStep && (!currentDomTarget || currentStep.domTarget !== currentDomTarget)) {
      removeTooltipTargetClass()

      if (currentStep.domTarget) {
        console.log('data-tooltip-target changed to', currentStep.domTarget)
        currentDomTarget = currentStep.domTarget
        addTooltipTargetClass(currentStep.domTarget)
      } else {
        currentDomTarget = null
      }
    }

    // Set up completion event listener if specified
    setupCompletionEventListener(currentStep)

    return currentStep
  }

  removeTooltipTargetClass()
  removeCompletionEventListener()
  previousTargetElements = [] // Reset previousTargetElements
  currentDomTarget = null

  return null
})

// Function to set up event listener for completion events
function setupCompletionEventListener(step: TooltipStep | null) {
  // Remove any existing completion event listener first
  removeCompletionEventListener()

  if (step?.completionEvent) {
    let eventId: string
    let message: string

    // Handle both string and object formats for completionEvent
    if (typeof step.completionEvent === 'string') {
      eventId = step.completionEvent
      message = 'Complete the action to continue'
    } else {
      eventId = step.completionEvent.eventId
      message = step.completionEvent.message
    }

    console.log(`Setting up completion event listener for: ${eventId}`)

    // Set the pending completion event flag to true
    hasPendingCompletionEvent.set(true)

    // Set the completion event message
    completionEventMessage.set(message)

    // Create the event handler
    const handler = (event: Event) => {
      console.log(`Completion event received: ${eventId}`)

      // Get the current timeline and step BEFORE changing any state
      const active = get(activeTimeline)
      if (!active || !get(timelines)[active]) {
        console.log('No active timeline when completion event was received')
        return
      }

      const timeline = get(timelines)[active]
      const currentStep = timeline.steps[timeline.currentStep]

      // Verify this completion event is for the current step
      let currentStepEventId = ''
      if (currentStep.completionEvent) {
        if (typeof currentStep.completionEvent === 'string') {
          currentStepEventId = currentStep.completionEvent
        } else {
          currentStepEventId = currentStep.completionEvent.eventId
        }
      }

      // If this event doesn't match the current step's expected event, ignore it
      if (currentStepEventId !== eventId) {
        console.log(
          `Ignoring completion event ${eventId} - doesn't match current step's event ${currentStepEventId}`
        )
        return
      }

      // Set the pending completion event flag to false when the event is received
      hasPendingCompletionEvent.set(false)
      // Clear the message
      completionEventMessage.set('')

      // Only execute actions if actionCanSkipCompletionEvent is NOT true
      // This prevents double execution when actions were already executed by the button click
      if (
        currentStep.actions &&
        currentStep.actions.length > 0 &&
        !currentStep.actionCanSkipCompletionEvent
      ) {
        console.log(`Executing actions for current step on completion event:`, currentStep.actions)
        executeActions(currentStep.actions)
      } else if (currentStep.actionCanSkipCompletionEvent) {
        console.log(
          'Skipping action execution on completion event because actionCanSkipCompletionEvent is true'
        )
      }

      // Then advance to the next step
      nextStep()
    }

    // Add the event listener to the document
    document.addEventListener(eventId, handler)

    // Store the current listener so we can remove it later
    currentCompletionEventListener = {
      event: eventId,
      handler
    }
  } else {
    // If there's no completion event, make sure the flag is set to false
    hasPendingCompletionEvent.set(false)
    // Clear any message
    completionEventMessage.set('')
  }
}

// Function to remove the current completion event listener
function removeCompletionEventListener() {
  if (currentCompletionEventListener) {
    document.removeEventListener(
      currentCompletionEventListener.event,
      currentCompletionEventListener.handler
    )
    currentCompletionEventListener = null
  }
}

function removeTooltipTargetClass() {
  previousTargetElements.forEach((element) => {
    element.classList.remove('tooltip-target')
  })
  previousTargetElements = [] // Clear the array after removing classes
}

let currentIntervalId: number | null = null

function addTooltipTargetClass(domTarget: string) {
  // Clear any existing interval first to avoid multiple intervals running
  if (currentIntervalId !== null) {
    clearInterval(currentIntervalId)
    currentIntervalId = null
  }

  const addTooltipClass = () => {
    // First remove any existing tooltip-target classes to ensure clean state
    removeTooltipTargetClass()

    // Query for elements with the current domTarget
    const targetElements = document.querySelectorAll(`[data-tooltip-target="${domTarget}"]`)

    console.log('data-tooltip-target', targetElements, domTarget)

    // Store the new target elements and add the tooltip-target class
    previousTargetElements = Array.from(targetElements)
    previousTargetElements.forEach((targetElement) => {
      targetElement.classList.add('tooltip-target')
    })
  }

  // Initial addition of tooltip-target class
  addTooltipClass()

  // Repeat adding the class for 10 seconds in 1-second intervals
  // This helps ensure the class is added to elements that might be dynamically added/changed
  // BUG: This code won't properly reset the timer / cancel it!
  // As it overrides the currentIntervalId value with a new timer first, the clearInterval later
  // won't actually clear the current interval, just the newest. -> So you will have dangling calls
  // to the addTooltipClass fn!
  // As addTooltipClass closure still accesses an old domTarget, we prob would end up with old step
  // targets getting the target classes accidentally instead
  currentIntervalId = setInterval(addTooltipClass, 1000) as unknown as number

  // Stop the interval after 10 seconds to prevent unnecessary DOM operations
  setTimeout(() => {
    if (currentIntervalId !== null) {
      clearInterval(currentIntervalId)
      currentIntervalId = null
    }
  }, 10000)
}

// Function to launch a timeline
export function launchTimeline(timelineName: OnboardingFeature, stepIndex?: number) {
  const allTimelines = get(timelines)

  activeOnboardingTabId.set(null)
  if (allTimelines[timelineName]) {
    // Reset current domTarget when launching a new timeline
    currentDomTarget = null

    // Reset any pending completion event flag
    hasPendingCompletionEvent.set(false)

    // Clear any completion event message
    completionEventMessage.set('')

    // Set the current step to the provided index or 0 if not provided
    timelines.update((t) => {
      t[timelineName].currentStep = stepIndex !== undefined ? stepIndex : 0
      return t
    })

    // Set the active timeline
    activeTimeline.set(timelineName)

    // Find the timeline script
    const timelineScript = Object.values(scripts).find(
      (script) => (script as OnboardingTimeline).name === timelineName
    ) as OnboardingTimeline | undefined

    // Set the dismissable flag (default to true if not specified)
    isTimelineDismissable.set(timelineScript?.dismissable !== false)

    // Execute initialActions if they exist
    if (timelineScript?.initialActions) {
      // Use executeActions which now handles normalization internally
      executeActions(timelineScript.initialActions)
    }
  } else {
    console.error(`Timeline "${timelineName}" not found`)
  }
}

// Function to move to the next step
export function nextStep() {
  timelines.update((t) => {
    const active = get(activeTimeline)
    if (active && t[active]) {
      if (t[active].currentStep < t[active].steps.length - 1) {
        t[active].currentStep++
        console.debug(`Moved to next step: ${t[active].currentStep} in timeline: ${active}`)
      } else {
        activeTimeline.set(null) // End the timeline if it's the last step
        console.debug(`Timeline "${active}" ended`)
      }
    } else {
      console.debug(`No active timeline or invalid timeline state`)
    }
    return t
  })
}

// Function to move to the previous step
export function prevStep() {
  timelines.update((t) => {
    const active = get(activeTimeline)
    if (active && t[active] && t[active].currentStep > 0) {
      t[active].currentStep--
    }
    return t
  })
}

// Function to end the current timeline
export function endTimeline() {
  // Clean up any tooltip targets when ending the timeline
  removeTooltipTargetClass()
  currentDomTarget = null

  // Clear any running intervals
  if (currentIntervalId !== null) {
    clearInterval(currentIntervalId)
    currentIntervalId = null
  }

  // Remove any completion event listeners
  removeCompletionEventListener()

  // Reset any pending completion event flag
  hasPendingCompletionEvent.set(false)

  // Clear any completion event message
  completionEventMessage.set('')

  // Set active timeline to null
  activeTimeline.set(null)
}

// Function to execute actions
export function executeActions(actions: (OnboardingAction | OnboardingActionType)[]) {
  const event = new CustomEvent('onboarding-execute-actions', {
    detail: { actions },
    bubbles: true
  })
  document.dispatchEvent(event)
}

// Expose the launchTimeline function to the window object for console access
declare global {
  interface Window {
    launchTimeline: (timelineName: string, stepIndex?: number) => void
    resetOnboarding: () => void
  }
}

// Attach the function to the window object
window.launchTimeline = (timelineName: string, stepIndex?: number) => {
  console.log(
    `Launching timeline: ${timelineName}${stepIndex !== undefined ? ` at step ${stepIndex}` : ''}, available timelines: ${Object.values(
      OnboardingFeature
    )
      .map((feature) => `\n  - ${feature}`)
      .join('')}`
  )
  launchTimeline(timelineName as OnboardingFeature, stepIndex)
}

window.resetOnboarding = () => {
  ConfigService.self.updateSettings({ has_seen_hero_screen: false })
}
