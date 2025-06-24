<script lang="ts">
  import Button from '../../Atoms/Button.svelte'
  import { createEventDispatcher } from 'svelte'
  import { ShortcutVisualizer } from '../../Utils/Keyboard'
  import { Icon } from '@horizon/icons'
  import { isMac } from '@horizon/utils'
  import { get, derived } from 'svelte/store'
  import {
    screenPickerSelectionActive,
    onboardingTabViewState,
    useOnboardingService,
    OnboardingLoadingState
  } from '../../../service/onboarding'
  import { fade, fly } from 'svelte/transition'
  import { flip } from 'svelte/animate'

  import example from '../../../../../public/assets/onboarding/vision/example.png'
  import article from '../../../../../public/assets/onboarding/chat/article.png'

  const dispatch = createEventDispatcher<{
    tryVision: void
  }>()

  const handleTryVision = () => {
    dispatch('tryVision')
  }

  const onboardingService = useOnboardingService()

  // Derived store for loading state
  const loadingState = derived(onboardingService.loadingState, ($loadingState) => $loadingState)

  // Derived store to check if any loading is happening
  const isLoading = derived(
    loadingState,
    ($loadingState) => $loadingState.state !== OnboardingLoadingState.Idle
  )

  $: shortcutKeys = [isMac() ? 'cmd' : 'ctrl', 'T']
</script>

<section
  class="min-h-screen flex flex-col items-center justify-center relative z-10 p-4 pb-8 md:!p-[6rem] md:!pb-[12rem] lg:!p-32 lg:!pb-[20rem]"
>
  {#if $onboardingTabViewState === 'default'}
    <div
      class="select-this-card flex flex-col gap-8 w-full items-center justify-center"
      transition:fade={{ duration: 400 }}
    >
      <div
        class="hint w-full max-w-7xl mx-auto flex flex-col items-center"
        class:invisible={!$screenPickerSelectionActive}
      >
        <div class="flex items-start gap-6 pr-6 mt-4">
          <div class="flex-shrink-0 text-xl font-medium text-white pb-2">Capture this card. 📸</div>

          <svg
            width="100%"
            height="75"
            viewBox="-70 0 198 121"
            xmlns="http://www.w3.org/2000/svg"
            color="#fff"
            opacity="0.75"
            stroke-width="6"
            stroke-linecap="round"
            style="transform: rotate(180deg) scale(1, -1);"
          >
            <g fill="none">
              <path
                id="svg_1"
                d="m176.81118,18.18184c-75.48311,4.19185 -132.95322,45.40562 -148,87"
                stroke="currentColor"
              />
              <line
                id="svg_4"
                y2="82.81239"
                x2="28.85533"
                y1="105.10472"
                x1="28.85533"
                stroke="currentColor"
              />
              <line
                id="svg_5"
                y2="94.11079"
                x2="47.59595"
                y1="104.92583"
                x1="28.63045"
                stroke="currentColor"
              />
            </g>
          </svg>
        </div>
      </div>
      <div class="bg-white shadow-lg rounded-3xl p-4 w-full md:!max-w-sm transform md:!rotate-3">
        <img
          src={example}
          alt="Vision Feature"
          class="w-full h-auto object-cover rounded-xl max-h-[320px]"
        />
        <p class="mt-3 text-center text-sm md:!text-base">
          <span class="opacity-50">Click the try button and ask something like:</span>
          "transcribe and translate into english"
        </p>
      </div>
    </div>
    <div class="flex flex-col items-center gap-6 max-w-2xl mt-12 px-4">
      <h1
        class="font-gambarino text-3xl md:!text-5xl text-center text-white leading-tight [text-shadow:0_1px_2px_rgba(0,0,0,0.1)]"
      >
        What You See Is What You Chat.
      </h1>

      <p class="text-center text-lg md:!text-xl text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.1)]">
        Draw a rectangle and ask a question.
      </p>
      <div class="vision-wrapper px-12">
        <Button on:click={handleTryVision}>Try Vision</Button>
      </div>

      <p class="text-center text-sm md:!text-md text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.1)]">
        or use <ShortcutVisualizer shortcut={shortcutKeys} size="medium" interactive={true} /> to activate.
      </p>
    </div>
  {:else if $onboardingTabViewState === 'chat-with-tab'}
    <div class="flex flex-col items-center gap-6 max-w-5xl mt-12 px-4">
      <img src={article} alt="Article" />
      <div class="content-container relative h-[120px] w-full overflow-hidden">
        {#key $isLoading}
          {#if $isLoading}
            <!-- Loading indicator -->
            <div
              class="loading-indicator absolute inset-0 flex flex-col items-center justify-center"
              in:fly={{ y: 20, duration: 300, delay: 150 }}
              out:fly={{ y: -20, duration: 300 }}
            >
              <Icon name="spinner" color="white" spin />
              <p
                class="text-center text-lg md:!text-xl text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.1)]"
              >
                {$loadingState.message || 'Loading...'}
              </p>
            </div>
          {:else}
            <div
              class="success-message absolute inset-0 flex flex-col items-center justify-center"
              in:fly={{ y: 20, duration: 300, delay: 150 }}
              out:fly={{ y: -20, duration: 300 }}
            >
              <p
                class="flex items-center gap-2 flex-col text-center max-w-xl mx-auto text-lg md:!text-xl text-white text-pretty [text-shadow:0_1px_2px_rgba(0,0,0,0.1)]"
              >
                <Icon name="circle.check.fill" size="2rem" color="white" />
                Surf opened a tab in the background that we now can chat with. We also inserted a question
                about the article. Hit send to continue.
              </p>
            </div>
          {/if}
        {/key}
      </div>
    </div>
  {/if}
</section>

<style lang="scss">
  .hint {
    z-index: 2147483647;
  }

  .loading-indicator {
    display: flex;
    gap: 0.5rem;
    align-items: center;
    justify-content: center;
  }
</style>
