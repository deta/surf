<script lang="ts" context="module">
  export type OnboardingEvents = {
    close: void
  }
</script>

<script lang="ts">
  import { createEventDispatcher } from 'svelte'
  import overviewDemoFull from '../../../../public/assets/demo/overview-demo-full.gif'
  import ResourceOverlay from './ResourceOverlay.svelte'

  const dispatch = createEventDispatcher<OnboardingEvents>()
</script>

<div
  class="absolute top-0 left-0 w-full h-full flex flex-col items-center justify-center bg-black/50 rounded-xl backdrop-blur-sm select-none text-white text-lg gap-12 px-24"
  style="z-index: 2147483647;"
>
  <div class="gap-4 flex flex-col items-center">
    <h1 class="text-2xl font-bold">What You See is What You Chat</h1>
    <p class="opacity-70 text-center">Tip: Hover over any element to see how it works.</p>
  </div>

  <div class="flex flex-col gap-10 w-full">
    <ResourceOverlay>
      <div class="flex items-center gap-4" slot="content">
        <svg
          width="32"
          height="32"
          viewBox="0 0 32 32"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          class="w-12 h-12"
        >
          <rect width="32" height="32" rx="8" fill="#F0F0F0" />
          <circle cx="8" cy="16" r="4" fill="#FFD700" />
          <rect x="14" y="10" width="6" height="12" rx="2" fill="#000" />
          <rect x="22" y="10" width="6" height="12" rx="2" fill="#000" />
          <path
            d="M20 16C20 14.8954 20.8954 14 22 14H26C27.1046 14 28 14.8954 28 16V20C28 21.1046 27.1046 22 26 22H22C20.8954 22 20 21.1046 20 20V16Z"
            fill="#00BFFF"
          />
        </svg>
        <div class="flex-1 flex-grow">
          <h2 class="font-semibold">Context Window</h2>
          <p>Most chatbots are clueless about your stuff.</p>
          <p>
            Surf gives you high quality answers from the tabs, folders, and content you add to the
            "Context Window".
          </p>
        </div>
      </div>

      <div slot="caption">
        <img src={overviewDemoFull} class="w-80 h-80 object-contain" alt="Context Window" />
      </div>
    </ResourceOverlay>

    <ResourceOverlay>
      <div class="flex items-center gap-4" slot="content">
        <svg
          width="32"
          height="32"
          viewBox="0 0 32 32"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          class="w-12 h-12"
        >
          <rect width="32" height="32" rx="8" fill="#F0F0F0" />
          <circle cx="8" cy="16" r="4" fill="#FFD700" />
          <rect x="14" y="10" width="6" height="12" rx="2" fill="#000" />
          <rect x="22" y="10" width="6" height="12" rx="2" fill="#000" />
          <path
            d="M20 16C20 14.8954 20.8954 14 22 14H26C27.1046 14 28 14.8954 28 16V20C28 21.1046 27.1046 22 26 22H22C20.8954 22 20 21.1046 20 20V16Z"
            fill="#00BFFF"
          />
        </svg>
        <div class="flex-1 flex-grow">
          <h2 class="font-semibold">Add Context</h2>
          <p>
            Use <span class="font-mono bg-white/10 px-1 rounded-md">+</span> to include an item in your
            chat.
          </p>
          <p class="opacity-70">
            Hint: you can also <span class="font-mono bg-white/10 px-1 text-xl rounded-md">⌘</span>
            or
            <span class="font-mono bg-white/10 px-1 py-1 rounded-md text-sm">Shift</span> + click to
            select multiple items.
          </p>
        </div>
      </div>

      <div slot="caption">
        <img src={overviewDemoFull} class="w-80 h-80 object-contain" alt="Add Context" />
      </div>
    </ResourceOverlay>

    <ResourceOverlay>
      <div class="flex items-center gap-4" slot="content">
        <svg
          width="32"
          height="32"
          viewBox="0 0 32 32"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          class="w-12 h-12"
        >
          <rect width="32" height="32" rx="8" fill="#F0F0F0" />
          <circle cx="8" cy="16" r="4" fill="#FFD700" />
          <rect x="14" y="10" width="6" height="12" rx="2" fill="#000" />
          <rect x="22" y="10" width="6" height="12" rx="2" fill="#000" />
          <path
            d="M20 16C20 14.8954 20.8954 14 22 14H26C27.1046 14 28 14.8954 28 16V20C28 21.1046 27.1046 22 26 22H22C20.8954 22 20 21.1046 20 20V16Z"
            fill="#00BFFF"
          />
        </svg>
        <div class="flex-1 flex-grow">
          <h2 class="font-semibold">Remove Context</h2>
          <p>
            Remove an individual item by clicking it's own <span
              class="font-mono bg-white/10 px-1 rounded-md">x</span
            > button. Or clear the whole window to start fresh.
          </p>
        </div>
      </div>
      <div slot="caption">
        <img src={overviewDemoFull} class="w-80 h-80 object-contain" alt="Add Context" />
      </div>
    </ResourceOverlay>
  </div>

  <p class="opacity-70 text-center">Chat can make mistakes. Verify results.</p>

  <button class="bg-sky-500 text-white py-2 px-4 rounded-2xl" on:click={() => dispatch('close')}
    >Continue</button
  >
</div>
