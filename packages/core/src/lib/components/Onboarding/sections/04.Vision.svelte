<script lang="ts">
  import Button from '../../Atoms/Button.svelte'
  import { createEventDispatcher } from 'svelte'
  import { ShortcutVisualizer } from '../../Utils/Keyboard'
  import { isMac } from '@horizon/utils'
  import { screenPickerSelectionActive, visionViewState } from '../../../service/onboarding'
  import { fade } from 'svelte/transition'

  import example from '../../../../../public/assets/onboarding/vision/example.png'
  const dispatch = createEventDispatcher<{
    tryVision: void
  }>()

  const handleTryVision = () => {
    dispatch('tryVision')
  }

  $: shortcutKeys = [isMac() ? 'cmd' : 'ctrl', 'T']
</script>

<section
  class="min-h-screen flex flex-col items-center justify-center relative z-10 p-4 pb-8 md:!p-[6rem] md:!pb-[12rem] lg:!p-32 lg:!pb-[20rem]"
>
  {#if $visionViewState === 'default'}
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
  {/if}
</section>

<style lang="scss">
  .hint {
    z-index: 2147483647;
  }
</style>
