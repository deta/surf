import { writable, get, derived } from 'svelte/store'
import { useLogScope } from '@deta/utils/io'

// Define the AI generation state interface
export interface AIGenerationState {
  isGenerating: boolean
  source?: string
  message?: string
  progress?: number
}

// Create a writable store with the initial state
const generationState = writable<AIGenerationState>({
  isGenerating: false,
  source: undefined,
  message: undefined,
  progress: undefined
})

// Logger for the AI generation state
const log = useLogScope('AIGenerationState')

/**
 * Start AI generation with the given source and message
 * @param source The source of the generation (e.g., 'text-resource', 'onboarding')
 * @param message Optional message describing the generation
 */
export function startAIGeneration(source: string, message?: string) {
  log.debug('Starting AI generation', { source, message })
  generationState.update((state) => ({
    ...state,
    isGenerating: true,
    source,
    message,
    progress: 0
  }))
}

/**
 * Update the AI generation progress
 * @param progress Progress value between 0 and 100
 * @param message Optional updated message
 */
export function updateAIGenerationProgress(progress: number, message?: string) {
  log.debug('Updating AI generation progress', { progress, message })
  generationState.update((state) => ({
    ...state,
    progress,
    message: message || state.message
  }))
}

/**
 * End AI generation
 */
export function endAIGeneration() {
  log.debug('Ending AI generation')
  generationState.set({
    isGenerating: false,
    source: undefined,
    message: undefined,
    progress: undefined
  })
}

/**
 * Get the current AI generation state
 */
export function getAIGenerationState(): AIGenerationState {
  return get(generationState)
}

// Derived store that simply tells if any AI generation is happening
export const isGeneratingAI = derived(generationState, ($state) => $state.isGenerating)

// Export the store for direct subscription
export { generationState }
