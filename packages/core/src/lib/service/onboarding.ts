import { getContext, setContext } from 'svelte'
import { useLogScope, wait } from '@horizon/utils'
import { writable, get, derived, type Writable } from 'svelte/store'
import type { TabsManager } from './tabs'
import MagicSidebar from '../components/Sidebars/MagicSidebar.svelte'
import type { AIService } from './ai/ai'
import {
  startAIGeneration,
  endAIGeneration,
  isGeneratingAI,
  updateAIGenerationProgress
} from './ai/generationState'
import { nextStep, activeStep, prevStep } from '../components/Onboarding/timeline'
import { CompletionEventID } from '../components/Onboarding/onboardingScripts'

export const screenPickerSelectionActive = writable(false)
export const onboardingTabViewState = writable<'default' | 'empty' | 'chat-with-tab'>('default')
export const activeOnboardingTabId = writable<string | null>(null)

const ONBOARDING_CONTEXT_KEY = 'onboarding'

// Define loading state types
export enum OnboardingLoadingState {
  Idle = 'idle',
  LoadingContent = 'loading-content', // For when content is loading (PDF, YouTube, etc.)
  GeneratingAI = 'generating-ai', // For when AI is generating content
  ProcessingAction = 'processing-action' // For other actions
}

export interface OnboardingLoadingInfo {
  state: OnboardingLoadingState
  message?: string
  actionId?: string
}

export class OnboardingService {
  log = useLogScope('OnboardingService')
  tabsManager: TabsManager
  magicSidebar: MagicSidebar | null = null
  aiService: AIService | null = null

  // Loading state store
  loadingState: Writable<OnboardingLoadingInfo> = writable({
    state: OnboardingLoadingState.Idle,
    message: undefined,
    actionId: undefined
  })

  // Derived store that simply tells if any loading is happening
  isLoading = derived(this.loadingState, ($state) => $state.state !== OnboardingLoadingState.Idle)

  static self: OnboardingService

  constructor(tabsManager: TabsManager) {
    this.tabsManager = tabsManager

    // Subscribe to the global AI generation state
    // This will synchronize our loading state with the global AI generation state
    this.unsubscribeFromAIGeneration = isGeneratingAI.subscribe((isGenerating) => {
      if (isGenerating) {
        // If AI generation has started, update our loading state
        this.setLoadingState(OnboardingLoadingState.GeneratingAI, 'Surf is generating content...')
      } else if (this.getLoadingState().state === OnboardingLoadingState.GeneratingAI) {
        // Only clear if we're in AI generation state (don't affect other loading states)
        this.clearLoadingState()

        // Check if we need to automatically proceed to the next step
        this.checkAndProceedAfterAIGeneration()
      }
    })
  }

  // Store the unsubscribe function
  private unsubscribeFromAIGeneration: () => void

  /**
   * Check if the current onboarding step has proceedAfterAIGeneration set to true
   * and automatically proceed to the next step if needed
   */
  private checkAndProceedAfterAIGeneration() {
    // Get the current active step
    const currentStep = get(activeStep)

    document.dispatchEvent(new CustomEvent(CompletionEventID.AIGenerationDone))

    // If there's an active step and it has proceedAfterAIGeneration set to true, proceed to the next step
    if (currentStep && currentStep.proceedAfterAIGeneration === true) {
      this.log.debug('Automatically proceeding to next step after AI generation completed')
      nextStep()
    }
  }

  /**
   * Set the loading state
   * @param state The loading state
   * @param message Optional message describing the loading state
   * @param actionId Optional identifier for the action causing the loading state
   */
  setLoadingState(state: OnboardingLoadingState, message?: string, actionId?: string) {
    this.log.debug('Setting loading state', { state, message, actionId })
    this.loadingState.set({ state, message, actionId })
  }

  /**
   * Clear the loading state
   */
  clearLoadingState() {
    this.log.debug('Clearing loading state')
    this.loadingState.set({
      state: OnboardingLoadingState.Idle,
      message: undefined,
      actionId: undefined
    })
  }

  /**
   * Get the current loading state
   */
  getLoadingState(): OnboardingLoadingInfo {
    return get(this.loadingState)
  }

  /**
   * Register the AI service with the onboarding service
   */
  attachAIService(aiService: AIService) {
    this.aiService = aiService
    this.log.debug('AIService registered with OnboardingService')
  }

  /**
   * Register the MagicSidebar component with the onboarding service
   */
  attachMagicSidebar(sidebar: MagicSidebar) {
    this.magicSidebar = sidebar
    this.log.debug('MagicSidebar registered with OnboardingService')
  }

  /**
   * Create a surflet in the current editor
   * @param surfletCode The code to use for the surflet
   */
  createSurflet(surfletCode?: string) {
    this.log.debug('Creating surflet')
    // This method will be called from the Tooltip component
    // It will dispatch a custom event that can be listened for in TextResource.svelte
    const event = new CustomEvent('create-surflet', {
      detail: { code: surfletCode },
      bubbles: true,
      composed: true
    })
    document.dispatchEvent(event)
    this.log.debug('Dispatched create-surflet event')
  }

  /**
   * Stream surflet code to simulate AI generation
   * @param fullCode The complete code to stream
   * @param initialChunkSize Initial code chunk size to show immediately
   * @param chunkSize Size of each chunk to add during streaming
   * @param delayBetweenChunks Delay in ms between adding chunks
   */
  streamSurfletCode(
    fullCode: string,
    initialChunkSize = 200,
    chunkSize = 50,
    delayBetweenChunks = 100
  ) {
    this.log.debug('Starting surflet code streaming')

    // Clean the code by removing markdown code block markers if present
    const cleanCode = fullCode.replace(/```javascript|```/g, '')

    // Create initial surflet with just the first chunk
    const initialCode = cleanCode.substring(0, initialChunkSize)
    this.createSurflet(initialCode)

    // Stream the rest of the code in chunks
    let currentPosition = initialChunkSize

    const streamNextChunk = () => {
      if (currentPosition >= cleanCode.length) {
        this.log.debug('Surflet code streaming complete')
        return
      }

      // Calculate next chunk end position
      const nextPosition = Math.min(currentPosition + chunkSize, cleanCode.length)
      const updatedCode = cleanCode.substring(0, nextPosition)

      // Update the surflet with the new chunk added
      const updateEvent = new CustomEvent('update-surflet', {
        detail: { code: updatedCode },
        bubbles: true,
        composed: true
      })
      document.dispatchEvent(updateEvent)

      // Update position and schedule next chunk
      currentPosition = nextPosition
      setTimeout(streamNextChunk, delayBetweenChunks)
    }

    // Start streaming after a short delay
    setTimeout(streamNextChunk, delayBetweenChunks * 2)
  }

  /**
   * Open a URL and trigger the chat onboarding flow
   * @param url The URL to open
   * @param question Optional question to ask about the content
   */
  async openURLAndChat(url: string, question?: string, active?: boolean) {
    this.log.debug('Opening URL and starting chat', url)

    // Set loading state for content loading
    this.setLoadingState(OnboardingLoadingState.LoadingContent, 'Loading content...', url)

    try {
      const tabResult = await this.tabsManager.addPageTab(url, { active: active })

      if (tabResult) {
        const tabId = tabResult.id
        this.log.debug('Created new tab with ID', tabId)

        // Wait for the content to load
        await this.waitForContentLoad(tabId)

        // Explicitly add the specific tab to the context (not necessarily the active tab)
        this.log.debug('Explicitly adding tab to context', tabId)
        this.setLoadingState(
          OnboardingLoadingState.LoadingContent,
          'Adding tab to context...',
          tabId
        )

        // Wait for the tab to be added to the context
        await this.addTabToContext(tabId)

        // Give a small delay to ensure everything is ready
        await wait(500)

        // Update loading state to indicate content is loaded
        this.clearLoadingState()

        // If a question was provided, generate a response
        if (question && this.magicSidebar) {
          this.log.debug('Preparing to ask question about content', question)

          // Set loading state for AI generation
          this.setLoadingState(
            OnboardingLoadingState.GeneratingAI,
            "Preparing Surf's response...",
            question
          )
          await wait(500)
          // Generate the response with the provided question
          // The question will be inserted by the insertQuestionAndGenerateResponse method
          await this.insertQuestion(question)
        }
      } else {
        this.log.error('Failed to create tab for URL', url)
        this.clearLoadingState()
      }
    } catch (error) {
      this.log.error('Error in openURLAndChat', error)
      this.clearLoadingState()
      prevStep()
    }
  }

  /**
   * Wait for the content to load and show the right sidebar
   * @private
   */
  private async waitForContentLoad(tabId: string): Promise<void> {
    return new Promise(async (resolve) => {
      // Show the right sidebar if we have access to it
      if (this.tabsManager.showRightSidebar) {
        this.tabsManager.showRightSidebar.set(true)
      }

      try {
        // Update loading state with more specific message
        this.setLoadingState(
          OnboardingLoadingState.LoadingContent,
          'Waiting for tab to initialize...',
          tabId
        )

        let activeTab = tabId

        if (!activeTab) {
          this.log.error(`No active tab found`)
          this.setLoadingState(OnboardingLoadingState.Idle, 'Failed to find active tab')
          setTimeout(resolve, 2000)
          return
        }

        // Wait for the browser tab to be available
        let browserTab = this.tabsManager.browserTabsValue[activeTab]
        if (!browserTab) {
          this.log.debug(
            'Browser tab not immediately available, waiting for it to initialize...',
            activeTab
          )

          // Update loading state
          this.setLoadingState(
            OnboardingLoadingState.LoadingContent,
            'Waiting for browser tab to initialize...',
            activeTab
          )

          // Try to get the browser tab for up to 5 attempts with 300ms intervals
          let attempts = 0
          const maxAttempts = 5

          while (!browserTab && attempts < maxAttempts) {
            await wait(300)
            browserTab = this.tabsManager.browserTabsValue[activeTab]
            attempts++
            this.log.debug(`Waiting for browser tab (attempt ${attempts}/${maxAttempts})`)
          }

          if (!browserTab) {
            this.log.error(`Browser tab not found after ${maxAttempts} attempts`, activeTab)
            this.setLoadingState(OnboardingLoadingState.Idle, 'Failed to find browser tab')
            setTimeout(resolve, 2000) // Fallback to timeout
            return
          }

          this.log.debug('Browser tab found after waiting', activeTab)
        }

        this.log.debug('Waiting for app detection to complete')
        this.setLoadingState(
          OnboardingLoadingState.LoadingContent,
          'Detecting content type...',
          activeTab
        )

        // Wait for app detection to complete with a timeout
        const detectedApp = await browserTab.waitForAppDetection(5000)

        if (detectedApp) {
          this.log.debug('App detection completed successfully', detectedApp)
          // Update loading state
          this.setLoadingState(
            OnboardingLoadingState.LoadingContent,
            'Parsing page content...',
            activeTab
          )
          // Give a small additional delay for any final processing
          setTimeout(() => {
            this.clearLoadingState()
            resolve()
          }, 1000)
        } else {
          this.log.debug('App detection timed out, proceeding anyway')
          // Update loading state
          this.setLoadingState(
            OnboardingLoadingState.LoadingContent,
            'Content loaded (timeout)',
            activeTab
          )
          // If app detection times out, we still proceed but with a slightly longer delay
          setTimeout(() => {
            this.clearLoadingState()
            resolve()
          }, 1000)
        }
      } catch (error) {
        this.log.error('Error waiting for content to load:', error)
        // Update loading state to indicate error
        this.setLoadingState(OnboardingLoadingState.Idle, 'Error loading content')
        // Fallback to timeout in case of errors
        setTimeout(resolve, 2000)
      }
    })
  }

  /**
   * Add a specific tab to the context manager and wait for the resource to be fully prepared
   * @param tabId The ID of the tab to add to the context
   * @private
   */
  private async addTabToContext(tabId: string): Promise<void> {
    if (!this.aiService) {
      this.log.error('AIService not registered, cannot add tab to context')
      return
    }

    try {
      const contextManager = this.aiService.contextManager
      if (!contextManager) {
        this.log.error('Context manager not available')
        return
      }

      // Get the specific tab by ID
      const tab = this.tabsManager.get(tabId)
      if (!tab) {
        this.log.error(`Tab with ID ${tabId} not found when trying to add to context`)
        return
      }

      this.log.debug(`Adding tab ${tabId} to context before submitting message`)

      // Temporarily make this tab active to use the existing context system
      const previousActiveTabId = this.tabsManager.activeTabIdValue

      // Add the now-active tab to the context
      const activeTabItem = await contextManager.addTabs([tabId])

      await wait(1000)

      if (!activeTabItem) {
        this.log.error('Failed to add tab to context, item not created')

        // Restore the previous active tab if needed
        if (previousActiveTabId && previousActiveTabId !== tabId) {
          await this.tabsManager.makeActive(previousActiveTabId)
        }
        return
      }

      // Wait for the active tab item to finish loading and prepare the resource
      if (activeTabItem.loadingValue) {
        this.log.debug('Waiting for tab item to finish loading')

        // Create a promise that resolves when loading is complete
        await new Promise<void>((resolve) => {
          const unsubscribe = activeTabItem.loading.subscribe((loading) => {
            if (!loading) {
              this.log.debug('Tab item finished loading')
              unsubscribe()
              resolve()
            }
          })
        })
      }

      // Wait for the resource to be available in the context
      let resourceReady = false
      let waitAttempts = 0
      const maxWaitAttempts = 15 // 3 seconds total max wait time

      while (!resourceReady && waitAttempts < maxWaitAttempts) {
        const item = activeTabItem.itemValue
        if (item) {
          this.log.debug('Resource is ready in context', item.id)
          resourceReady = true
        } else {
          this.log.debug(
            `Waiting for resource to be ready (attempt ${waitAttempts + 1}/${maxWaitAttempts})`
          )
          await new Promise((r) => setTimeout(r, 200))
          waitAttempts++
        }
      }

      if (!resourceReady) {
        this.log.warn(`Resource not ready after ${maxWaitAttempts} attempts, continuing anyway`)
      }

      // Ensure the context is persisted
      contextManager.persistItems()
      this.log.debug('Tab added to context successfully')

      // Restore the previous active tab if needed
      if (previousActiveTabId && previousActiveTabId !== tabId) {
        await this.tabsManager.makeActive(previousActiveTabId)
      }
    } catch (error) {
      this.log.error('Failed to add tab to context:', error)
      throw error
    }
  }

  /**
   * Insert a question into the chat and trigger AI completion
   * @param question Optional question to ask, defaults to a generic question about the paper
   */
  async insertQuestion(question?: string): Promise<void> {
    return new Promise((resolve) => {
      if (!this.magicSidebar) {
        this.log.error('MagicSidebar not registered, cannot insert question')
        this.clearLoadingState()
        resolve()
        return
      }

      const defaultQuestion = 'What are the key findings of this paper?'
      const finalQuestion = question?.includes('?') ? question : question || defaultQuestion

      // Start AI generation using the global state
      startAIGeneration('onboarding', `Preparing to answer: ${finalQuestion}`)

      // Insert the question
      if (typeof this.magicSidebar.insertQueryIntoChat === 'function') {
        this.magicSidebar.insertQueryIntoChat(`<p>${finalQuestion}</p>`, 'input')

        // The active tab has already been added to the context in openURLAndChat
        // Just update the progress and submit the chat message
        updateAIGenerationProgress(25, 'Hit submit to ask Surf...')

        document.dispatchEvent(
          new CustomEvent(CompletionEventID.ArticleAddedToContext, { bubbles: true })
        )

        endAIGeneration()
      } else {
        this.log.error('insertQueryIntoChat not available on MagicSidebar')
        // End AI generation if we can't insert the query
        endAIGeneration()
        resolve()
      }
    })
  }

  /**
   * Insert a question into the chat and trigger AI completion
   * @param question Optional question to ask, defaults to a generic question about the paper
   */
  async generateResponse(): Promise<void> {
    return new Promise((resolve) => {
      if (!this.magicSidebar) {
        this.log.error('MagicSidebar not registered, cannot insert question')
        this.clearLoadingState()
        resolve()
        return
      }

      if (typeof this.magicSidebar?.submitChatMessage === 'function') {
        this.log.debug('Submitting chat message after ensuring editor is initialized')
        updateAIGenerationProgress(50, 'Submitting query to AI...')
        this.magicSidebar.submitChatMessage()

        // The global AI generation state will be updated by TextResource
        // when the generation completes, which will automatically update our loading state
        // through the subscription we set up in the constructor
      } else {
        // If we can't submit the message, end the AI generation
        this.log.error('insertQueryIntoChat not available on MagicSidebar')
        endAIGeneration()
      }

      resolve()
    })
  }

  /**
   * Provide the onboarding service to the Svelte context
   */
  static provide(tabsManager: TabsManager) {
    const service = new OnboardingService(tabsManager)
    OnboardingService.self = service
    setContext(ONBOARDING_CONTEXT_KEY, service)
    return service
  }

  static use() {
    if (OnboardingService.self) {
      return OnboardingService.self
    }

    const service = getContext<OnboardingService>(ONBOARDING_CONTEXT_KEY)
    if (!service) {
      throw new Error('OnboardingService not provided')
    }

    return service
  }

  /**
   * Create an onboarding space and ensure context is switched
   * @param tabsManager TabsManager instance
   * @param oasis OasisService instance
   * @param createSpaceTab Function to create a space tab
   * @param resourceManager ResourceManager instance
   * @param callback Optional callback function to signal completion
   * @returns Promise that resolves when space creation and context switch are complete
   */
  async createOnboardingSpace(
    tabsManager: TabsManager,
    oasis: any, // Using any here to avoid circular dependencies
    createSpaceTab: any,
    resourceManager: any,
    callback?: (success: boolean) => void
  ) {
    try {
      // Create the onboarding space and wait for it to complete
      this.log.debug('Creating onboarding space')

      // Import the createOnboardingSpace function from demoitems
      const { createOnboardingSpace } = await import('./demoitems')

      const space = await createOnboardingSpace(tabsManager, oasis, createSpaceTab, resourceManager)
      this.log.debug('Onboarding space creation and context switch complete')

      // Call the callback to signal completion if provided
      if (typeof callback === 'function') {
        callback(true)
      }

      return space
    } catch (error) {
      this.log.error('Error creating onboarding space:', error)

      // Call the callback with false to signal failure if provided
      if (typeof callback === 'function') {
        callback(false)
      }

      throw error
    }
  }
}

export const provideOnboardingService = OnboardingService.provide
export const useOnboardingService = OnboardingService.use
