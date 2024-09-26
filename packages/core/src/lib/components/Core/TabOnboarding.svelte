<script lang="ts" context="module">
  export type OnboardingEvents = {
    openChat: void
    openStuff: void
    openScreenshot: void
  }
</script>

<script lang="ts">
  import { Icon } from '@horizon/icons'
  import ResourceOverlay from './ResourceOverlay.svelte'
  import { wait } from '@horizon/utils'
  import { createEventDispatcher, onMount } from 'svelte'
  import onboSave from '../../../../public/assets/demo/onbosave.gif'
  import onboChat from '../../../../public/assets/demo/onbochat.gif'
  import onboDragDrop from '../../../../public/assets/demo/onbodnd.gif'
  import onboVision from '../../../../public/assets/demo/onbovision.gif'
  import onboBg from '../../../../public/assets/demo/bg.webp'
  const dispatch = createEventDispatcher<OnboardingEvents>()

  onMount(async () => {
    await wait(500)

    const existingOnboardingSettings = window.api.getUserConfigSettings().onboarding
    await window.api.updateUserConfigSettings({
      onboarding: {
        ...existingOnboardingSettings,
        completed_welcome: true
      }
    })
  })
</script>

<div
  class="flex flex-col items-center justify-center h-screen bg-white/95 p-8 text-lg overflow-scroll"
>
  <img src={onboBg} class="w-full h-full absolute top-0 left-0 opacity-20" alt="Welcome" />
  <div class="absolute bg-gradient-to-t from-white to-transparent w-full h-full" />
  <div class="flex flex-col max-w-3xl gap-8 relative z-10">
    <div class="flex flex-col gap-4 overflow-y-scroll" style="z-index: 2147483647">
      <h1
        class="font-bold text-5xl animate-text-shimmer bg-clip-text text-transparent bg-gradient-to-r from-violet-900 to-blue-900 via-rose-300 bg-[length:250%_100%]"
      >
        Welcome to Surf
      </h1>
      <p class="text-2xl">Surf is like if your browser, Finder and ChatGPT had a baby.</p>
    </div>
    <div class="flex flex-col my-8 gap-4 h-[400px]">
      <webview
        src="https://www.youtube.com/embed/RFzdxhkWGX4"
        class=" w-full h-full shadow-xl rounded-xl overflow-hidden"
        partition="app"
        style="z-index: 2147483647"
      />

      <div class="flex justify-center border-t border-gray-300 pt-4 w-2/3 mx-auto opacity-70">
        Tip: Hover over any element to see how it works or click it.
      </div>
    </div>

    <div class="grid grid-cols-1 sm:grid-cols-2 gap-6 w-full">
      <ResourceOverlay>
        <!-- svelte-ignore a11y-no-noninteractive-tabindex -->
        <!-- svelte-ignore a11y-no-static-element-interactions -->
        <div
          class="flex gap-4 h-full w-full cursor-pointer"
          slot="content"
          on:click={() => dispatch('openStuff')}
          on:keydown={(event) => {
            if (event.key === 'Enter') {
              dispatch('openStuff')
            }
          }}
          tabindex="0"
        >
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

        <div slot="caption">
          <img src={onboSave} alt="Save" />
        </div>
      </ResourceOverlay>

      <ResourceOverlay>
        <!-- svelte-ignore a11y-no-noninteractive-tabindex -->
        <!-- svelte-ignore a11y-no-static-element-interactions -->
        <div
          class="flex gap-4 h-full w-full cursor-pointer"
          slot="content"
          on:click={() => dispatch('openChat')}
          on:keydown={(event) => {
            if (event.key === 'Enter') {
              dispatch('openChat')
            }
          }}
          tabindex="0"
        >
          <div
            class="relative w-12 h-12 bg-black/10 rounded-xl flex items-center justify-center font-semibold text-xl"
          >
            <Icon name="chat" />
          </div>
          <div class="flex-1 flex-grow">
            <h2 class="font-semibold">WYSYWIC</h2>
            <div>Ask your tabs any question.</div>
          </div>
        </div>

        <div slot="caption">
          <img src={onboChat} alt="Chat" />
        </div>
      </ResourceOverlay>

      <ResourceOverlay>
        <!-- svelte-ignore a11y-no-noninteractive-tabindex -->
        <!-- svelte-ignore a11y-no-static-element-interactions -->
        <div
          class="flex gap-4 h-full w-full cursor-pointer"
          slot="content"
          on:click={() => dispatch('openScreenshot')}
          on:keydown={(event) => {
            if (event.key === 'Enter') {
              dispatch('openScreenshot')
            }
          }}
          tabindex="0"
        >
          <div
            class="relative w-12 h-12 bg-black/10 rounded-xl flex items-center justify-center font-semibold text-xl"
          >
            <Icon name="cursor-arrow-rays" />
          </div>
          <div class="flex-1 flex-grow">
            <h2 class="font-semibold">Smart Select</h2>
            <div>
              <kbd
                class="px-2 py-0.5 text-lg font-semibold text-gray-900 bg-white border border-gray-200 rounded-lg"
                >{navigator.platform.startsWith('Mac') ? '⌘' : 'Ctrl'}</kbd
              >
              +
              <kbd
                class="px-2 py-1.5 text-xs font-semibold text-gray-900 bg-white border border-gray-200 rounded-lg"
                >Shift</kbd
              >
              +
              <kbd
                class="px-2 py-1.5 text-xs font-semibold text-gray-900 bg-white border border-gray-200 rounded-lg"
                >1</kbd
              >
              or highlight any text and have fun.
            </div>
          </div>
        </div>

        <div slot="caption">
          <img src={onboVision} alt="Vision" />
        </div>
      </ResourceOverlay>

      <ResourceOverlay>
        <!-- svelte-ignore a11y-no-noninteractive-tabindex -->
        <!-- svelte-ignore a11y-no-static-element-interactions -->
        <div class="flex gap-4 h-full w-full cursor-pointer" slot="content" tabindex="0">
          <div
            class="relative w-12 h-12 bg-black/10 rounded-xl flex items-center justify-center font-semibold text-xl"
          >
            <Icon name="cursor-grab" />
          </div>
          <div class="flex-1 flex-grow">
            <h2 class="font-semibold">Universal Drag and Drop</h2>
            <div>Drag and drop just about anything in Surf.</div>
          </div>
        </div>

        <div slot="caption">
          <img src={onboDragDrop} alt="Drag and Drop" />
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
