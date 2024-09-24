<script lang="ts" context="module">
  export type OnboardingEvents = {
    close: void
  }
</script>

<script lang="ts">
  import { createEventDispatcher } from 'svelte'

  const dispatch = createEventDispatcher<OnboardingEvents>()
</script>

<div
  class="absolute top-0 left-0 w-full h-full flex flex-col items-center justify-center bg-black/50 rounded-xl backdrop-blur-sm select-none text-white text-lg gap-8 px-24"
  style="z-index: 2147483647;"
>
  <h1 class="text-2xl font-bold">What You See is What You Chat</h1>

  <div class="flex flex-col gap-4 w-full">
    <div class="flex items-center gap-4">
      <img src="path/to/shared-icon.png" alt="Shared with You" class="w-8 h-8" />
      <div>
        <h2 class="font-semibold">Context Window</h2>
        <p>Most chatbots are clueless about your stuff.</p>
        <p>
          Surf gives you high quality answers from the tabs, folders, and content you add to the
          "Context Window".
        </p>
      </div>
    </div>

    <div class="flex items-center gap-4">
      <img src="path/to/memories-icon.png" alt="Memories" class="w-8 h-8" />
      <div>
        <h2 class="font-semibold">Add Context</h2>
        <p>
          Use <span class="font-mono bg-white/10 px-1 rounded-md">+</span> to include an item in your
          chat.
        </p>
        <p class="opacity-70">
          Hint: you can also <span class="font-mono bg-white/10 px-1 text-xl rounded-md">⌘</span> or
          <span class="font-mono bg-white/10 px-1 py-1 rounded-md text-sm">Shift</span> + click to select
          multiple items.
        </p>
      </div>
    </div>

    <div class="flex items-center gap-4">
      <img src="path/to/richer-info-icon.png" alt="Richer Info" class="w-8 h-8" />
      <div>
        <h2 class="font-semibold">Remove Context</h2>
        <p>
          Remove an individual item by clicking it's own <span
            class="font-mono bg-white/10 px-1 rounded-md">x</span
          > button. Or clear the whole window to start fresh.
        </p>
      </div>
    </div>
  </div>

  <button
    class="bg-blue-500 text-white py-2 px-4 rounded-full mt-8"
    on:click={() => dispatch('close')}>Continue</button
  >
</div>
