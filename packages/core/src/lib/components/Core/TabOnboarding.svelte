<script lang="ts">
  import { Icon } from '@horizon/icons'
  import ResourceOverlay from './ResourceOverlay.svelte'

  // Add any necessary script here
</script>

<div class="flex flex-col items-center justify-center h-screen bg-white/80 p-5 text-lg">
  <div class="flex flex-col items-center max-w-3xl gap-4">
    <h1 class="font-bold text-5xl">Welcome to Surf</h1>
    <p class="">
      Using a computer can feel overwhelming: lots of information and lots of contexts — as users
      we're forced to live with it. Surf is a browser we're building to put us back in the drivers
      seat.
    </p>
    <p>Surf has 6 fundamental features:</p>
    <div class="grid grid-cols-3">
      <ResourceOverlay>
        <div class="flex gap-4" slot="content">
          <div
            class="relative w-12 h-12 bg-black/10 rounded-xl flex items-center justify-center font-semibold text-xl"
          >
            <Icon name="leave" />
          </div>
          <div class="flex-1 flex-grow">
            <h2 class="font-semibold">Stuff</h2>
            <div>Save anything</div>
            <p class="opacity-70">Hit the leaf or (Cmd + D)</p>
          </div>
        </div>
      </ResourceOverlay>

      <ResourceOverlay>
        <div class="flex gap-4" slot="content">
          <div
            class="relative w-12 h-12 bg-black/10 rounded-xl flex items-center justify-center font-semibold text-xl"
          >
            <Icon name="search" />
          </div>
          <div class="flex-1 flex-grow">
            <h2 class="font-semibold">Find anything</h2>
            <div>Hit the Stuff Icon or (Cmd + O) and search.</div>
          </div>
        </div>
      </ResourceOverlay>

      <ResourceOverlay>
        <div class="flex gap-4" slot="content">
          <div
            class="relative w-12 h-12 bg-black/10 rounded-xl flex items-center justify-center font-semibold text-xl"
          >
            <Icon name="folder" />
          </div>
          <div class="flex-1 flex-grow">
            <h2 class="font-semibold">Organize everything</h2>
            <div>
              Create folders and manually curate your stuff. Or let Surf organize it, hands free.
            </div>
          </div>
        </div>
      </ResourceOverlay>

      <ResourceOverlay>
        <div class="flex gap-4" slot="content">
          <div
            class="relative w-12 h-12 bg-black/10 rounded-xl flex items-center justify-center font-semibold text-xl"
          >
            <Icon name="youtube" />
          </div>
          <div class="flex-1 flex-grow">
            <h2 class="font-semibold">What you see is what you chat</h2>
            <div>Power-through your media — ask a YouTube video, website or PDF any question.</div>
          </div>
        </div>
      </ResourceOverlay>

      <ResourceOverlay>
        <div class="flex gap-4" slot="content">
          <div
            class="relative w-12 h-12 bg-black/10 rounded-xl flex items-center justify-center font-semibold text-xl"
          >
            <Icon name="vision" />
          </div>
          <div class="flex-1 flex-grow">
            <h2 class="font-semibold">Highlight and ask</h2>
            <div>Bring help to any corner Cmd + Shift + 1 — have fun.</div>
          </div>
        </div>
      </ResourceOverlay>

      <ResourceOverlay>
        <div class="flex gap-4" slot="content">
          <div
            class="relative w-12 h-12 bg-black/10 rounded-xl flex items-center justify-center font-semibold text-xl"
          >
            <Icon name="dnd" />
          </div>
          <div class="flex-1 flex-grow">
            <h2 class="font-semibold">Drag and Drop</h2>
            <div>Born in the 70's, rebooted in Surf.</div>
          </div>
        </div>
      </ResourceOverlay>
    </div>
  </div>
</div>
