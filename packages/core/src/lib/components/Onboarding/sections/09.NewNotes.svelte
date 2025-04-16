<script lang="ts">
  import { Icon } from '@horizon/icons'
  import Button from '@horizon/core/src/lib/components/Atoms/Button.svelte'
  import { createEventDispatcher } from 'svelte'
  import newNotesVideo from '../../../../../public/assets/demo/new.notes.mp4'
  import newNotesImage from '../../../../../public/assets/demo/new.notes.png'
  import { OnboardingFeature } from '../onboardingScripts'
  import type { OnboardingNote } from '@horizon/core/src/lib/constants/notes'

  import { completedFeatures } from '../featured'

  export let modShortcut: string

  const dispatch = createEventDispatcher<{
    launchTimeline: OnboardingFeature
  }>()

  let showLiveTip = true
  let showHelperText = true

  const handleTryNotes = () => {
    dispatch('launchTimeline', OnboardingFeature.NotesOnboarding)
  }
</script>

<section
  class="min-h-screen flex flex-col items-center justify-center pt-12 md:!pt-24 relative z-10 px-4"
>
  <div class="w-full max-w-7xl mx-auto flex flex-col items-center">
    <div class="flex items-start gap-6 pr-6 mt-4" class:opacity-0={!showHelperText}>
      <div class="flex-shrink-0 text-xl font-medium text-white pb-2">
        Surf's got all of your context 🏄‍♂️
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
    <div
      class="w-full max-w-[800px] h-fit rounded-3xl overflow-hidden relative shadow-2xl flex justify-center items-center"
    >
      <video
        src={newNotesVideo}
        autoplay
        muted
        loop
        class="teaser-video w-full h-full object-contain rounded-xl"
      ></video>

      <div class="absolute -bottom-8 right-3 flex flex-col items-center gap-4 mb-12">
        <div class="w-fit min-w-80" on:click={handleTryNotes} role="none">
          <Button>Try the demo</Button>
        </div>
      </div>
    </div>

    <div class="text-center mb-8 md:!mb-12 px-4 mt-20">
      <h1
        class="font-gambarino text-3xl md:!text-5xl text-center text-white leading-tight mb-4 [text-shadow:0_1px_2px_rgba(0,0,0,0.1)]"
      >
        Understand the Internet in a new way.
      </h1>
      <p
        class="text-white text-lg md:!text-xl [text-shadow:0_1px_2px_rgba(0,0,0,0.1)] max-w-[60ch]"
      >
        Unlike general AI assistants, Surf Notes don't just capture thoughts—they help you build
        understanding. You can annotate the web with your own context, making new ideas easier to
        explore, connect, and develop.
      </p>
    </div>

    <div class="w-full max-w-[800px] h-fit">
      <img src={newNotesImage} alt="Surf Notes Demo" class="w-full h-auto object-contain" />
    </div>
  </div>
</section>

<style lang="scss">
  .teaser-video {
    border-radius: 12px;
    overflow: hidden;
  }
</style>
