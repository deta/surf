<script lang="ts">
  import { createEventDispatcher } from 'svelte'
  import { OnboardingFeature } from '../../Onboarding/onboardingScripts'
  import chatBackground01 from '../../../../../public/assets/demo/backgrounds/chat.background.01.webp'
  import chatBackground02 from '../../../../../public/assets/demo/backgrounds/chat.background.02.webp'
  import chatBackground03 from '../../../../../public/assets/demo/backgrounds/chat.background.03.webp'
  import chatBackground04 from '../../../../../public/assets/demo/backgrounds/chat.background.04.webp'

  const dispatch = createEventDispatcher<{
    tryChatWithSpace: void
    tryChatWithTabs: void
    tryChatWithPDF: void
    tryChatWithYoutubeVideo: void
    launchTimeline: OnboardingFeature
  }>()

  const handleTryChatWithSpace = () => {
    dispatch('tryChatWithSpace')
  }

  const handleTryChatWithTabs = () => {
    dispatch('tryChatWithTabs')
  }

  const handleTryChatWithPDF = () => {
    dispatch('tryChatWithPDF')
  }

  const handleTryChatWithYoutubeVideo = () => {
    dispatch('tryChatWithYoutubeVideo')
  }
</script>

<div
  class="w-full max-w-6xl min-h-screen mx-auto flex flex-col lg:!flex-row justify-center items-center gap-16 relative z-1 pointer-events-auto"
>
  <div class="flex flex-col w-full lg:!w-1/3 pt-2">
    <h1
      class="font-gambarino text-3xl md:!text-5xl text-white leading-tight mb-8 [text-shadow:0_1px_2px_rgba(0,0,0,0.1)]"
    >
      Chat with everything. You are in full control.
    </h1>

    <p class="text-lg md:!text-xl text-white/80 mb-4 [text-shadow:0_1px_2px_rgba(0,0,0,0.1)]">
      Surf's chat can power through dozens of tabs, hours of podcasts, and thousands of pages, in
      seconds.
    </p>

    <p class="text-lg md:!text-xl text-white/80 [text-shadow:0_1px_2px_rgba(0,0,0,0.1)]">
      It's aware of what you think is important.
    </p>
  </div>

  <div class="w-full lg:!w-2/3 relative pt-2">
    <p
      class="absolute -top-6 right-0 text-sm text-gray-100 [text-shadow:0_1px_2px_rgba(0,0,0,0.1)]"
    >
      Click on one to try it out
    </p>

    <div class="bg-white/40 backdrop-blur-sm rounded-3xl p-4">
      <div class="grid grid-cols-1 sm:!grid-cols-2 gap-4">
        <div
          class="bg-white rounded-2xl p-4 relative overflow-hidden transition-all hover:shadow-lg h-52"
          role="button"
          tabindex="0"
          on:click={handleTryChatWithTabs}
          style="background-image: url({chatBackground01}); background-size: cover; background-position: center;"
        >
          <p
            class="text-base md:!text-lg text-sky-900 bg-white/80 rounded-full px-3 py-1 inline-block"
          >
            → Try asking Your Tabs
          </p>
        </div>

        <div
          class="bg-white rounded-2xl p-4 relative overflow-hidden transition-all hover:shadow-lg h-52"
          role="button"
          tabindex="0"
          on:click={handleTryChatWithSpace}
          style="background-image: url({chatBackground02}); background-size: cover; background-position: center;"
        >
          <p
            class="text-base md:!text-lg text-sky-900 bg-white/80 rounded-full px-3 py-1 inline-block"
          >
            → Try asking a full context
          </p>
        </div>

        <div
          class="bg-white rounded-2xl p-4 relative overflow-hidden transition-all hover:shadow-lg h-52"
          role="button"
          tabindex="0"
          on:click={handleTryChatWithPDF}
          style="background-image: url({chatBackground03}); background-size: cover; background-position: center;"
        >
          <p
            class="text-base md:!text-lg text-sky-900 bg-white/80 rounded-full px-3 py-1 inline-block"
          >
            → Try asking a PDF
          </p>
        </div>

        <div
          class="bg-white rounded-2xl p-4 relative overflow-hidden transition-all hover:shadow-lg h-52"
          role="button"
          tabindex="0"
          on:click={handleTryChatWithYoutubeVideo}
          style="background-image: url({chatBackground04}); background-size: cover; background-position: center;"
        >
          <p
            class="text-base md:!text-lg text-sky-900 bg-white/80 rounded-full px-3 py-1 inline-block"
          >
            → Try Chat with a Youtube Video
          </p>
        </div>
      </div>
    </div>
  </div>
</div>
