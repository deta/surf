import { writable, get, derived } from 'svelte/store'
import type { TooltipStep, OnboardingTimeline } from './onboardingScripts'
import * as scripts from './onboardingScripts'

import type { OnboardingFeature } from './onboardingScripts'

interface Timeline {
  steps: TooltipStep[]
  currentStep: number
}

const timelines = writable<Record<string, Timeline>>({})

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

let previousTargetElements: Element[] = []
export const activeStep = derived([activeTimeline, timelines], ([$activeTimeline, $timelines]) => {
  if ($activeTimeline && $timelines[$activeTimeline]) {
    const timeline = $timelines[$activeTimeline]
    const currentStep = timeline.steps[timeline.currentStep]

    removeTooltipTargetClass()

    if (currentStep && currentStep.domTarget) {
      console.log('data-tooltip-target', currentStep.domTarget)
      addTooltipTargetClass(currentStep.domTarget)
    }

    return currentStep
  }

  removeTooltipTargetClass()
  previousTargetElements = [] // Reset previousTargetElements

  return null
})

function removeTooltipTargetClass() {
  previousTargetElements.forEach((element) => {
    element.classList.remove('tooltip-target')
  })
}

let currentIntervalId: number | null = null

function addTooltipTargetClass(domTarget: string) {
  const addTooltipClass = () => {
    const targetElements = document.querySelectorAll(`[data-tooltip-target="${domTarget}"]`)

    console.log('data-tooltip-target', targetElements, domTarget)
    previousTargetElements = Array.from(targetElements)
    previousTargetElements.forEach((targetElement) => {
      targetElement.classList.add('tooltip-target')
    })
  }

  // Clear any existing interval
  if (currentIntervalId !== null) {
    clearInterval(currentIntervalId)
  }

  // Initial addition of tooltip-target class
  addTooltipClass()

  // Repeat adding the class for 10 seconds in 1-second intervals
  currentIntervalId = setInterval(addTooltipClass, 1000) as unknown as number
  setTimeout(() => {
    if (currentIntervalId !== null) {
      clearInterval(currentIntervalId)
      currentIntervalId = null
    }
  }, 10000)
}

// Function to launch a timeline
export function launchTimeline(timelineName: OnboardingFeature) {
  const allTimelines = get(timelines)
  if (allTimelines[timelineName]) {
    timelines.update((t) => {
      t[timelineName].currentStep = 0
      return t
    })
    activeTimeline.set(timelineName)
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
  activeTimeline.set(null)
}
