<script lang="ts">
  import Button from '../../Atoms/Button.svelte'
  import { createEventDispatcher } from 'svelte'
  import stuffOnboarding01 from '../../../../../public/assets/onboarding/stuff.onboarding.teaser.webp'
  import { OnboardingFeature } from '../../Onboarding/onboardingScripts'
  import { ShortcutVisualizer } from '../../Utils/Keyboard'
  import { isMac } from '@deta/utils'

  const dispatch = createEventDispatcher<{
    tryStuff: void
    launchTimeline: OnboardingFeature
    'open-stuff': void
  }>()

  const handleTryStuff = () => {
    dispatch('open-stuff')
  }

  $: shortcutKeys = [isMac() ? 'cmd' : 'ctrl', 'shift', 'O']
</script>

<section
  class="min-h-screen flex flex-col items-center justify-center pt-12 md:!pt-24 relative z-10 px-4 font-rounded"
>
  <div class="w-full max-w-7xl mx-auto flex flex-col items-center">
    <div class="text-center mb-8 md:!mb-12 px-4">
      <h1
        class="font-gambarino text-3xl md:!text-5xl text-center text-white leading-tight mb-4 [text-shadow:0_1px_2px_rgba(0,0,0,0.1)]"
      >
        All of your saved items are<br />now in Your Stuff!
      </h1>
      <p class="text-white text-lg md:!text-xl [text-shadow:0_1px_2px_rgba(0,0,0,0.1)]">
        Save, find and (auto)-organize almost anything into Surf.
      </p>
    </div>

    <div class="w-full max-w-[500px] px-4">
      <img src={stuffOnboarding01} alt="Stuff Feature" class="w-full" />
    </div>

    <div class="flex flex-col items-center gap-4 mt-8">
      <div class="w-48" on:click={handleTryStuff} role="none">
        <Button>Open Your stuff.</Button>
      </div>

      <p class="text-sm text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.1)]">
        or use <ShortcutVisualizer shortcut={shortcutKeys} size="small" interactive={true} /> to open.
      </p>
    </div>
  </div>
</section>
