<script lang="ts">
  import { Icon } from '@horizon/icons'
  import ResourceOverlay from './ResourceOverlay.svelte'

  // Add any necessary script here
</script>

<div class="flex flex-col items-center justify-center h-screen bg-white/80 p-5 text-lg">
  <div class="flex flex-col items-center max-w-3xl gap-4">
    <h1 class="font-bold text-5xl">Welcome to Surf</h1>
    <p class="">Surf is a browser we're building to put us back in the drivers seat.</p>
    <p>Surf has 4 fundamental features:</p>
    <ResourceOverlay>
      <div class="flex gap-4" slot="content">
        <div
          class="relative w-12 h-12 bg-black/10 rounded-xl flex items-center justify-center font-semibold text-xl"
        >
          <Icon name="leave" />
        </div>
        <div class="flex-1 flex-grow">
          <h2 class="font-semibold">Stay on top of your Stuff</h2>
          <div>Save, organize and find all your media.</div>
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
          <h2 class="font-semibold">WYSYWIC</h2>
          <div>Ask your tabs any question.</div>
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
          <h2 class="font-semibold">Smart Select</h2>
          <div>⌘ + Shift + 1 or highlight any text and have fun.</div>
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
          <h2 class="font-semibold">Universal Drag and Drop</h2>
          <div>Drag and drop anything into Surf.</div>
        </div>
      </div>
    </ResourceOverlay>
  </div>
</div>
