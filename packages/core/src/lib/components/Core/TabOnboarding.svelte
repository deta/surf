<script lang="ts">
  import { Icon } from '@horizon/icons'
  import ResourceOverlay from './ResourceOverlay.svelte'
</script>

<div class="flex flex-col items-center justify-center h-screen bg-white/95 p-5 text-lg">
  <div class="flex flex-col max-w-3xl gap-8">
    <div class="flex flex-col gap-4">
      <h1
        class="font-bold text-5xl animate-text-shimmer bg-clip-text text-transparent bg-gradient-to-r from-violet-900 to-blue-900 via-rose-300 bg-[length:250%_100%]"
      >
        Welcome to Surf
      </h1>
      <p class="text-2xl">Surf is a browser we're building to put us back in the drivers seat.</p>
    </div>
    <div class="flex flex-col my-8 gap-4">
      <iframe
        width="560"
        height="315"
        src="https://www.youtube.com/embed/dQw4w9WgXcQ"
        title="YouTube video player"
        class="bg-blue-500 w-full shadow-xl rounded-xl overflow-hidden"
        frameborder="0"
        allow="allowfullscreen"
      ></iframe>

      <!-- <webview
        src="https://www.youtube.com/embed/dQw4w9WgXcQ"
        partition="app"
        useragent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.6613.120 Safari/537.36"
      /> -->

      <div class="flex justify-center border-t border-gray-300 pt-4 w-2/3 mx-auto opacity-70">
        Tip: Hover over any element to see how it works.
      </div>
    </div>

    <div class="grid grid-cols-1 sm:grid-cols-2 gap-6 w-full">
      <ResourceOverlay>
        <div class="flex gap-4 h-full w-full" slot="content">
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
        <div class="flex gap-4 h-full w-full" slot="content">
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
        <div class="flex gap-4 h-full w-full" slot="content">
          <div
            class="relative w-12 h-12 bg-black/10 rounded-xl flex items-center justify-center font-semibold text-xl"
          >
            <Icon name="vision" />
          </div>
          <div class="flex-1 flex-grow">
            <h2 class="font-semibold">Smart Select</h2>
            <div>
              <span class="font-mono bg-black/10 px-1 text-xl rounded-md"
                >⌘ + <span class="text-sm">Shift</span> + 1</span
              > or highlight any text and have fun.
            </div>
          </div>
        </div>
      </ResourceOverlay>

      <ResourceOverlay>
        <div class="flex gap-4 h-full w-full" slot="content">
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

    <div class="flex flex-col items-center justify-center mt-8">
      <p class="text-center text-neutral-700">
        Need help? Check out our <a
          rel="noopener noreferrer"
          target="_blank"
          href="https://deta.notion.site/Surf-Zero-e9c49ddf02a8476fb3c53b7efdc7e0fd"
          class="text-[#2497e9] underline">documentation</a
        >
        or join our
        <a
          rel="noopener noreferrer"
          target="_blank"
          href="https://deta.surf/discord"
          class="text-[#2497e9] underline">Discord community</a
        >.
      </p>
    </div>
  </div>
</div>
