<script lang="ts">
  import { Icon } from '@horizon/icons'
  import Button from '@horizon/core/src/lib/components/Atoms/Button.svelte'
  import { createEventDispatcher } from 'svelte'
  import stuffOnboarding01 from '../../../../../public/assets/onboarding/stuff.onboarding.teaser.webp'
  import { OnboardingFeature } from '../onboardingScripts'
  import TextResource from '@horizon/core/src/lib/components/Resources/Previews/Text/TextResource.svelte'
  import type { OnboardingNote } from '@horizon/core/src/lib/constants/notes'

  import { completedFeatures } from '../featured'

  export let modShortcut: string

  const dispatch = createEventDispatcher<{
    tryStuff: void
    launchTimeline: OnboardingFeature
  }>()

  let showLiveTip = true
  let showHelperText = true

  const handleChangeOnboardingNote = (e: CustomEvent<OnboardingNote>) => {
    if (e.detail.id === 'basics') {
      showLiveTip = false
      $completedFeatures = [...$completedFeatures, '0.1.8']
    } else if (e.detail.id === 'usecases') {
      showHelperText = false
    }
  }
</script>

<section
  class="min-h-screen flex flex-col items-center justify-center pt-12 md:!pt-24 relative z-10 px-4"
>
  <div class="w-full max-w-7xl mx-auto flex flex-col items-center">
    <div class="text-center mb-8 md:!mb-12 px-4">
      <h1
        class="font-gambarino text-3xl md:!text-5xl text-center text-white leading-tight mb-4 [text-shadow:0_1px_2px_rgba(0,0,0,0.1)]"
      >
        Generate Notes From Your Knowledge
      </h1>
      <p class="text-white text-lg md:!text-xl [text-shadow:0_1px_2px_rgba(0,0,0,0.1)]">
        Use your saved stuff and Surf AI to write notes, connect ideas and gain insights.
      </p>
    </div>

    <div class="w-full max-w-[800px] h-[850px] rounded-3xl overflow-hidden relative shadow-2xl">
      <!-- <img src={stuffOnboarding01} alt="Stuff Feature" class="w-full" /> -->

      {#if showLiveTip}
        <div
          class="absolute top-12 right-10 z-[10000] text-base md:!text-lg text-sky-900 bg-sky-500/20 rounded-full px-3 py-1"
        >
          This is live, try it out!
        </div>
      {/if}

      <TextResource
        resourceId="onboarding"
        showOnboarding
        hideContextSwitcher
        autofocus={false}
        similaritySearch
        on:change-onboarding-note={handleChangeOnboardingNote}
        on:highlightWebviewText
        on:seekToTimestamp
      />
    </div>

    <div class="flex items-end gap-6 pr-6" class:opacity-0={!showHelperText}>
      <div class="flex-shrink-0 text-xl font-medium text-white pb-2">
        Go through the intro to learn more
      </div>

      <svg
        width="100%"
        height="75"
        viewBox="-70 0 198 121"
        xmlns="http://www.w3.org/2000/svg"
        color="#fff"
        opacity="0.75"
        stroke-width="6"
        stroke-linecap="round"
        style="transform: rotate(180deg);"
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

    <!-- <div class="flex flex-col items-center gap-4 mt-8">
      <div class="w-fit" on:click={handleTryStuff} role="none">
        <Button>Try It</Button>
      </div>

      <p class="text-sm text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.1)]">
        or try the intro above.
      </p>
    </div> -->
  </div>
</section>
