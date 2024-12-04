<script lang="ts">
  import { Icon } from '@horizon/icons'
  import Button from '../../Atoms/Button.svelte'
  import { createEventDispatcher } from 'svelte'

  export let modShortcut: string

  const dispatch = createEventDispatcher<{
    tryVision: void
  }>()

  const handleTryVision = () => {
    dispatch('tryVision')
  }
</script>

<section
  class="min-h-screen flex flex-col items-center justify-center relative z-10 p-4 md:!p-8 lg:!p-32"
>
  <div class="flex flex-col md:!flex-row gap-8 w-full items-center justify-center">
    <div class="bg-white shadow-lg rounded-3xl p-4 w-full md:!max-w-sm transform md:!rotate-3">
      <img
        src="https://images.beta.cosmos.so/63aad48c-f037-4159-a189-b11e502f9152?format=jpeg"
        alt="Vision Feature"
        class="w-full h-auto object-cover rounded-xl max-h-[320px]"
      />
      <p class="mt-2 text-center text-sm md:!text-base">
        Click the Try Button and ask something like: "how is this built?"
      </p>
    </div>
    <div class="bg-white shadow-lg rounded-3xl p-4 w-full md:!max-w-sm transform md:!-rotate-2">
      <img
        src="https://images.beta.cosmos.so/cdf5aaac-8a7e-4e16-8951-e2f8874415ef?format=jpeg"
        alt="Vision Feature"
        class="w-full h-auto object-cover rounded-xl max-h-[220px]"
      />
      <p class="mt-2 text-center text-sm md:!text-base">
        Click the Try Button and ask something like: "convert into text"
      </p>
    </div>
  </div>
  <div class="flex flex-col items-center gap-6 max-w-2xl mt-12 px-4">
    <h1
      class="font-gambarino text-3xl md:!text-5xl text-center text-white leading-tight [text-shadow:0_1px_2px_rgba(0,0,0,0.1)]"
    >
      What You See, Is What You Chat.
    </h1>
    <p class="text-center text-lg md:!text-xl text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.1)]">
      Draw a rectangle and ask a question.
    </p>
    <Button on:click={handleTryVision}>Try Vision</Button>
    <p class="text-center text-sm md:!text-md text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.1)]">
      or use <span class="px-2 rounded-md">{modShortcut} + Shift + 1</span> to activate.
    </p>
  </div>
</section>
