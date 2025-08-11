<script lang="ts">
  import Button from '../../Atoms/Button.svelte'
  import { createEventDispatcher } from 'svelte'
  import { type Resource } from '@horizon/core/src/lib/service/resources'
  import { ShortcutVisualizer } from '../../Utils/Keyboard'
  import { isMac } from '@deta/utils'
  import OasisResourceLoader from '@horizon/core/src/lib/components/Oasis/OasisResourceLoader.svelte'
  import background01 from '../../../../../public/assets/demo/backgrounds/01.webp'
  import background02 from '../../../../../public/assets/demo/backgrounds/02.webp'
  import background03 from '../../../../../public/assets/demo/backgrounds/03.webp'

  export let savedResources: Resource[]

  const dispatch = createEventDispatcher<{
    tryDesktop: void
  }>()

  let currentBackground = background01
  let activeIndex = 0
  let backgrounds = [background01, background02, background03]

  const changeBackground = (index: number) => {
    currentBackground = backgrounds[index]
    activeIndex = index
  }

  const handleTryDesktop = () => {
    dispatch('tryDesktop')
  }

  $: shortcutKeys = [isMac() ? 'cmd' : 'ctrl', '1']
</script>

<section class="min-h-screen flex flex-col items-center justify-center relative z-10 px-4 gap-8">
  <h1
    class="font-gambarino text-3xl md:!text-5xl text-center text-white leading-tight mt-16 mb-8 [text-shadow:0_1px_2px_rgba(0,0,0,0.1)]"
  >
    Make yourself a home.
  </h1>
  <div
    class="w-full max-w-[60vw] aspect-[16/9] bg-gray-100 rounded-3xl shadow-2xl relative mx-4"
    style="background-image: url({currentBackground}); background-size: cover; background-position: center;"
  >
    <div
      class="absolute top-[-4rem] left-[-4rem] bg-white rounded-2xl p-4 md:!p-8 max-w-[90%] md:!max-w-md -rotate-1 z-50 shadow-lg"
    >
      <h2 class="text-xl md:!text-2xl font-medium mb-4 md:!mb-6">Your new Desktop</h2>
      <p class="text-gray-700 mb-4 md:!mb-6 text-sm md:!text-base">
        On your Desktop you can drop links, notes, files, whole contexts — whatever you want on it
        to make it yours.
      </p>
      <p class="text-gray-700 text-sm md:!text-base">
        Personalize your space by dropping in your favorite images or GIFs as custom backgrounds.
        Your browser theme will automatically adapt to match your desktop and your context.
      </p>
    </div>
    <div
      class="relative top-8 right-8 text-sm text-gray-600 font-medium tracking-tight w-full text-right text-white"
    >
      {#if savedResources.length === 0}
        Save Items in the first section of the demo for them to show up here.
      {/if}
    </div>
    <div
      class="absolute w-full h-full top-1 md:!top-2 right-4 md:!right-2 flex flex-row gap-2 md:!gap-4 scale-[0.25] sm:!scale-[0.35] lg:!scale-50 xl:scale-75 2xl:scale-90 origin-top-right"
    >
      {#each savedResources as item, index}
        <div
          class="w-[22rem]"
          style="position: absolute; top: {Math.min(
            10,
            Math.random() * 40 * index * index
          )}%; right: {index * 280}px; transform: rotate({-1.5 + Math.random() * 3}deg)"
        >
          <OasisResourceLoader
            resourceOrId={item.resource.id}
            mode={'responsive'}
            origin="homescreen"
            draggable={false}
            frameless={false}
            interactive={false}
            hideProcessing={true}
          />
        </div>
      {/each}
    </div>
    <div class="absolute bottom-4 md:!bottom-8 left-4 md:!left-8 flex gap-2 md:!gap-4 z-50">
      {#each backgrounds as bg, index}
        <button
          class="w-8 md:!w-10 h-8 md:!h-10 rounded-lg transition-all duration-200 hover:scale-110 active:scale-95 focus:outline-none relative p-0.5 bg-gradient-to-r from-white/50 to-white/30 hover:from-white/70 hover:to-white/50 ring-offset-1 {activeIndex ===
          index
            ? 'ring-2 ring-white scale-110'
            : ''}"
          on:click={() => changeBackground(index)}
          aria-label={`Switch to background ${index + 1}`}
        >
          <div
            class="w-full h-full rounded-lg shadow-sm"
            style="background-image: url({bg}); background-size: cover;"
          />
        </button>
      {/each}
    </div>
    <div
      class="absolute bottom-4 md:!bottom-8 left-0 w-full flex flex-col items-center gap-2 md:!gap-3"
    >
      <div class="w-48 md:!w-64" on:click={handleTryDesktop} role="none">
        <Button>Open your Desktop</Button>
      </div>
      <p class="text-xs md:!text-sm text-sky-900/70">
        or use <ShortcutVisualizer
          shortcut={shortcutKeys}
          size="small"
          interactive={true}
          separatorStyle="dark"
        /> to open.
      </p>
    </div>
  </div>
  <div class="text-center text-white text-lg">
    Surf lets you create unlimited desktops and hyperlink them together. More
    <a
      href="https://deta.notion.site/Surf-Zero-One-e9c49ddf02a8476fb3c53b7efdc7e0fd#152a5244a7178034abb9ecf6fa2986ac"
      target="_blank"
      class="text-white-400 hover:text-white-300 underline">here</a
    >.
  </div>
</section>
