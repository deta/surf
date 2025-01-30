<script lang="ts">
  import { Icon } from '@horizon/icons'
  import Button from '../../Atoms/Button.svelte'
  import { createEventDispatcher } from 'svelte'

  export let modShortcut: string

  let copyText = 'Build an interactive double pendulum simulation with trails.'
  let copied = false

  const dispatch = createEventDispatcher<{
    tryVision: void
  }>()

  const handleTryVision = () => {
    dispatch('tryVision')
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(copyText)
    copied = true
    setTimeout(() => (copied = false), 2000)
  }

  const handleMoreDemos = () => {
    //@ts-ignore
    window.showCodegenOnboarding()
  }
</script>

<section
  class="min-h-screen flex flex-col items-center justify-center relative z-10 p-4 md:!p-8 lg:!p-32"
>
  <div class="flex flex-col md:!flex-row gap-32 w-full items-center justify-center pt-32">
    <div class="bg-white shadow-lg rounded-3xl p-4 w-full md:!max-w-sm transform md:!rotate-3">
      <img
        src="https://upload.wikimedia.org/wikipedia/commons/3/32/Double_pendulum_simulation.gif"
        alt="Vision Feature"
        class="w-full h-auto object-cover rounded-xl max-h-[320px]"
      />
      <p class="mt-2 text-sm md:!text-base">Click the Try Button and ask something like:</p>
      <div class="flex items-center justify-between">
        <span class="text-start">{copyText}</span>
        <button class="ml-2" on:click={handleCopy}>
          <Icon name={copied ? 'check' : 'copy'} />
        </button>
      </div>
    </div>

    <div class="flex flex-col items-center gap-6 max-w-xl mt-12 px-4">
      <h1
        class="font-gambarino text-3xl md:!text-5xl text-center text-white leading-tight [text-shadow:0_1px_2px_rgba(0,0,0,0.1)]"
      >
        Generate your own Artifacts
      </h1>
      <p class="text-center text-lg md:!text-xl text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.1)]">
        Draw a rectangle and ask to build an artifact or generate them directly in Chat.
      </p>
      <Button on:click={handleTryVision}>Try it out</Button>
      <p class="text-center text-sm md:!text-md text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.1)]">
        or use <span class="px-2 rounded-md">{modShortcut} + Shift + 1</span> to activate.
      </p>
    </div>
  </div>

  <div
    class="flex-shrink-0 text-xl font-medium text-white pb-2 pt-20 underline cursor-pointer"
    aria-hidden="true"
    on:click={handleMoreDemos}
  >
    Check out more Demos
  </div>
</section>
