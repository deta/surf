<script lang="ts" context="module">
  export type OnboardingEvents = {
    openChat: { query: string }
    openStuff: void
    openScreenshot: void
    launchTimeline: OnboardingFeature
    endTimeline: void
    createOnboardingSpace: void
    batchOpenTabs: string[]
  }
</script>

<script lang="ts">
  import { isMac, wait } from '@horizon/utils'
  import { writable } from 'svelte/store'
  import { OnboardingFeature } from '../Onboarding/onboardingScripts'
  import { get } from 'svelte/store'
  import { createEventDispatcher, onMount } from 'svelte'
  import { useOasis } from '../../service/oasis'
  import { onboardingSpace, onboardingTabs } from '../../constants/examples'
  import { Icon } from '@horizon/icons'
  import Button from '../Atoms/Button.svelte'
  import SpaceIcon from '../Atoms/SpaceIcon.svelte'
  import onboVision from '../../../../public/assets/demo/onbovision.gif'
  import onboBg from '../../../../public/assets/demo/bag_full_bg.png'
  import stuffOnboarding01 from '../../../../public/assets/onboarding/stuff.onboarding.teaser.png'
  import smartSpacesOnboarding from '../../../../public/assets/onboarding/smartspaces.png'
  import { createOnboardingSpace } from '../../service/demoitems'
  import { useConfig } from '@horizon/core/src/lib/service/config'

  const dispatch = createEventDispatcher<OnboardingEvents>()
  const oasis = useOasis()
  const config = useConfig()
  const userSettings = config.settings

  export const onboardingRunning = writable(true)

  $: modShortcut = isMac() ? '⌘' : 'Ctrl'

  const handleTryVision = () => {
    dispatch('openScreenshot')
  }

  const handleTryChat = async () => {
    const ONBOARDING_SPACE_NAME = onboardingSpace.name
    const ONBOARDING_SPACE_QUERY = onboardingSpace.query
    const spaces = get(oasis.spaces)
    const space = spaces.find((space) => {
      return space.dataValue.folderName === ONBOARDING_SPACE_NAME
    })

    if (space) {
      console.debug('detaSpace found:', space.id)
      dispatch('openChat', { query: ONBOARDING_SPACE_QUERY })
    } else {
      dispatch('createOnboardingSpace')
      console.error(`Space "${ONBOARDING_SPACE_NAME}" not found`)
    }

    dispatch('launchTimeline', OnboardingFeature.ChatWithSpaceOnboardingInStuff)
    dispatch('openStuff')
    await wait(2000)
  }

  const handleTryStuff = () => {
    dispatch('launchTimeline', OnboardingFeature.StuffOnboarding)
    dispatch('openStuff')
  }

  const handleTrySmartSpaces = () => {
    dispatch('launchTimeline', OnboardingFeature.SmartSpacesOnboarding)
    dispatch('openStuff')
  }

  const handleTrySaveEverything = () => {
    dispatch('launchTimeline', OnboardingFeature.SavingOnboarding)
    dispatch('batchOpenTabs', onboardingTabs)
  }

  onMount(async () => {
    await wait(500)

    await config.updateSettings({
      onboarding: {
        ...$userSettings.onboarding,
        completed_welcome: true,
        completed_welcome_v2: true
      }
    })
  })

  let activeTab = 'welcome'
</script>

<div class="flex h-full w-full onboarding-wrapper">
  <div class="fixed bg-gradient-to-t from-white to-transparent w-full h-full z-0" />
  <div class="flex flex-col w-1/4 px-8 h-screen relative z-20 justify-center items-center">
    <div class="flex flex-col items-start pb-8 gap-4">
      <button
        class="selector font-gambarino py-4 px-6 text-left flex flex-col text-2xl hover:text-blue-700 transition-colors duration-300 bg-white hover:bg-gray-100 border border-gray-300 rounded-2xl w-full {activeTab ===
        'welcome'
          ? 'active'
          : ''}"
        on:click={() => (activeTab = 'welcome')}
      >
        <span class="index">1.</span> <span>Welcome</span>
      </button>
      <button
        class="selector font-gambarino py-4 px-6 text-left flex flex-col text-2xl hover:text-blue-700 transition-colors duration-300 bg-white hover:bg-gray-100 border border-gray-300 rounded-2xl w-full {activeTab ===
        'vision'
          ? 'active'
          : ''}"
        on:click={() => (activeTab = 'vision')}
      >
        <span class="index">2.</span> <span>How to use Vision</span>
      </button>
      <button
        class="selector font-gambarino py-4 px-6 text-left flex flex-col text-2xl hover:text-blue-700 transition-colors duration-300 bg-white hover:bg-gray-100 border border-gray-300 rounded-2xl w-full {activeTab ===
        'saveEverything'
          ? 'active'
          : ''}"
        on:click={() => (activeTab = 'saveEverything')}
      >
        <span class="index">3.</span> <span>How to save everything</span>
      </button>
      <button
        class="selector font-gambarino py-4 px-6 text-left flex flex-col text-2xl hover:text-blue-700 transition-colors duration-300 bg-white hover:bg-gray-100 border border-gray-300 rounded-2xl w-full {activeTab ===
        'stuff'
          ? 'active'
          : ''}"
        on:click={() => (activeTab = 'stuff')}
      >
        <span class="index">4.</span> <span>How to use your Stuff</span>
      </button>
      <button
        class="selector font-gambarino py-4 px-6 text-left flex flex-col text-2xl hover:text-blue-700 transition-colors duration-300 bg-white hover:bg-gray-100 border border-gray-300 rounded-2xl w-full {activeTab ===
        'chat'
          ? 'active'
          : ''}"
        on:click={() => (activeTab = 'chat')}
      >
        <span class="index">5.</span> <span>How to use Chat</span>
      </button>
      <button
        class="selector font-gambarino py-4 px-6 text-left flex flex-col text-2xl hover:text-blue-700 transition-colors duration-300 bg-white hover:bg-gray-100 border border-gray-300 rounded-2xl w-full {activeTab ===
        'smartSpaces'
          ? 'active'
          : ''}"
        on:click={() => (activeTab = 'smartSpaces')}
      >
        <span class="index">6.</span> <span>Smart Spaces</span>
      </button>
      <button
        class="selector font-gambarino py-4 px-6 text-left flex flex-col text-2xl hover:text-blue-700 transition-colors duration-300 bg-white hover:bg-gray-100 border border-gray-300 rounded-2xl w-full {activeTab ===
        'complete'
          ? 'active'
          : ''}"
        on:click={() => (activeTab = 'complete')}
      >
        <span class="index">7.</span> <span>Complete!</span>
      </button>
    </div>
  </div>
  <div
    class="flex flex-col w-3/4 bg-white px-8 text-lg overflow-y-auto relative justify-center items-center"
  >
    <div class="flex flex-col w-full gap-8 relative z-10 p-32 max-w-7xl mx-auto">
      {#if activeTab === 'welcome'}
        <div class="flex flex-col gap-4 overflow-y-scroll" style="z-index: 2147483647">
          <h1
            class="font-gambarino text-5xl text-center animate-text-shimmer bg-clip-text text-transparent bg-gradient-to-r from-violet-900 to-blue-900 via-rose-300 bg-[length:250%_100%]"
          >
            Welcome to Surf
          </h1>
          <p class="text-xl text-center text-sky-900">
            It's a browser, file manager, and AI assistant — all in one.
          </p>
        </div>
        <div
          class="flex flex-col my-8 gap-4 h-[600px]"
          style="z-index: 2147483647; aspect-ratio: 16/9;"
        >
          <webview
            src="https://www.youtube.com/embed/RFzdxhkWGX4"
            class="w-full h-full shadow-xl rounded-xl overflow-hidden z-"
            partition="app"
            style="z-index: 2147483647; aspect-ratio: 16/9;"
          />
        </div>
      {/if}

      {#if activeTab === 'vision'}
        <div
          class="flex flex-col items-center justify-center w-full h-screen relative"
          style="gap: 4rem;"
        >
          <div class="flex gap-12 sm:gap-8 w-full h-fit items-center justify-center max-h-[400px]">
            <div class="bg-white shadow-lg rounded-3xl p-4 w-full transform rotate-3 max-w-sm">
              <img
                src="https://images.beta.cosmos.so/63aad48c-f037-4159-a189-b11e502f9152?format=jpeg"
                alt="Vision Feature"
                class="w-full h-auto object-cover rounded-xl"
                style="max-height: 320px;"
              />
              <p class="mt-2 text-center">
                Click the Try Button and ask something like: "how is this built?"
              </p>
            </div>
            <div class="bg-white shadow-lg rounded-3xl p-4 w-full transform -rotate-2 max-w-sm">
              <img
                src="https://images.beta.cosmos.so/cdf5aaac-8a7e-4e16-8951-e2f8874415ef?format=jpeg"
                alt="Vision Feature"
                class="w-full h-auto object-cover rounded-xl"
                style="max-height: 220px;"
              />
              <p class="mt-2 text-center">
                Click the Try Button and ask something like: "convert into text"
              </p>
            </div>
          </div>
          <div class="flex flex-col items-center gap-6 max-w-2xl">
            <h1
              class="font-gambarino text-5xl text-center animate-text-shimmer bg-clip-text text-transparent bg-gradient-to-r from-violet-900 to-blue-900 via-rose-300 bg-[length:250%_100%] leading-tight"
            >
              What You See, Is What You Chat.
            </h1>
            <p class="text-center text-xl text-sky-900">Draw a rectangle and ask a question.</p>
            <Button on:click={handleTryVision}>Try Vision</Button>
            <p class="text-center text-md text-gray-500">
              or use <span class="px-2 rounded-md text-md">{modShortcut} + Shift + 1</span> to activate.
            </p>
          </div>
        </div>
      {/if}

      {#if activeTab === 'saveEverything'}
        <div
          class="flex flex-col items-center justify-center gap-6 w-full py-64 h-screen max-w-xl mx-auto"
        >
          <Icon name="save" color="#2497e9" size="44" />
          <h1
            class="font-gambarino text-5xl text-center animate-text-shimmer bg-clip-text text-transparent bg-gradient-to-r from-violet-900 to-blue-900 via-rose-300 bg-[length:250%_100%] leading-tight"
          >
            Save Anything.
          </h1>
          <p class="max-w-xl text-center">Save and organize what you think is important.</p>
          <Button on:click={handleTrySaveEverything}>Try Saving (open a bunch of tabs)</Button>
        </div>
      {/if}

      {#if activeTab === 'stuff'}
        <div
          class="flex flex-col items-center justify-center gap-6 w-full py-64 h-screen max-w-xl mx-auto"
        >
          <div
            class="flex bg-white shadow-lg rounded-3xl p-4 w-full transform rotate-3 max-w-sm justify-center items-center gap-2"
          >
            <div class="w-6 h-6 flex justify-center items-center">
              <SpaceIcon />
            </div>
            <p class="text-center">Your Stuff</p>
          </div>
          <div class=" rounded-3xl p-4 w-full transform rotate-3 max-w-sm flex items-center">
            <img
              src={stuffOnboarding01}
              alt="Stuff Feature"
              class="w-full h-auto object-cover rounded-xl"
            />
          </div>
          <h1
            class="font-gambarino text-5xl text-center animate-text-shimmer bg-clip-text text-transparent bg-gradient-to-r from-violet-900 to-blue-900 via-rose-300 bg-[length:250%_100%] leading-tight"
          >
            "The Future of Bookmarks"
          </h1>
          <p class="max-w-xl text-center">
            Save, find and (auto)-organize almost anything into Surf.
          </p>
          <Button on:click={handleTryStuff}>Try Your Stuff</Button>
          <p class="text-center text-md text-gray-500">
            or use <span class="px-2 rounded-md text-md">{modShortcut} + O</span> to open.
          </p>
        </div>
      {/if}

      {#if activeTab === 'chat'}
        <div
          class="flex flex-col items-center justify-center gap-6 w-full py-64 h-screen max-w-xl mx-auto"
        >
          <div
            class="flex bg-white shadow-lg rounded-3xl p-4 w-full transform rotate-3 max-w-sm justify-center items-center gap-2"
          >
            <div class="w-6 h-6 flex justify-center items-center">
              <SpaceIcon />
            </div>
            <p class="text-center">Apple Keynotes</p>
          </div>

          <h1
            class="font-gambarino text-5xl text-center animate-text-shimmer bg-clip-text text-transparent bg-gradient-to-r from-violet-900 to-blue-900 via-rose-300 bg-[length:250%_100%] leading-tight"
          >
            Super-charged Chat
          </h1>
          <p class="max-w-xl text-center">
            Surf's chat can power through dozens of tabs, hours of podcasts, and thousands of pages,
            in seconds.
          </p>
          <p class="max-w-xl text-center">It's aware of what you think is important.</p>
          <Button on:click={handleTryChat}>Try Chat with Space</Button>
        </div>
      {/if}

      {#if activeTab === 'smartSpaces'}
        <div
          class="flex flex-col items-center justify-center gap-6 w-full py-64 h-screen max-w-xl mx-auto"
        >
          <div class="max-h-[420px]">
            <img
              src={smartSpacesOnboarding}
              alt="Stuff Feature"
              class="w-full h-full object-contain rounded-xl"
            />
          </div>
          <h1
            class="font-gambarino text-5xl text-center animate-text-shimmer bg-clip-text text-transparent bg-gradient-to-r from-violet-900 to-blue-900 via-rose-300 bg-[length:250%_100%] leading-tight"
          >
            Self-organizing stuff
          </h1>
          <p class="max-w-xl text-center">Ask a folder what you want, and watch it fill itself.</p>
          <div class="flex gap-4">
            <Button on:click={handleTrySmartSpaces}>Try Smart Spaces</Button>
          </div>
        </div>
      {/if}

      {#if activeTab === 'complete'}
        <div
          class="flex flex-col items-center justify-center gap-8 w-full py-64 h-screen max-w-2xl mx-auto"
        >
          <h1
            class="font-gambarino text-5xl text-center animate-text-shimmer bg-clip-text text-transparent bg-gradient-to-r from-violet-900 to-blue-900 via-rose-300 bg-[length:250%_100%] leading-tight"
          >
            You're all set!
          </h1>
          <p class="text-xl text-center text-sky-900">
            Here are some helpful resources to get the most out of Surf:
          </p>
          <div class="grid grid-cols-2 gap-8 w-full">
            <div class="bg-white p-6 rounded-xl shadow-lg border border-gray-100">
              <h3 class="font-bold text-lg mb-2">Quick Reference</h3>
              <ul class="space-y-2">
                <li><span class="text-gray-600">{modShortcut} + O</span> - Open Stuff</li>
                <li><span class="text-gray-600">{modShortcut} + Shift + 1</span> - Vision</li>
                <li>
                  <a
                    href="https://deta.notion.site/Shortcuts-10ca5244a71780a7ae1aee4b51fab009"
                    target="_blank"
                    class="text-blue-500 hover:underline">View all Shortcuts</a
                  >
                </li>
              </ul>
            </div>
            <div class="bg-white p-6 rounded-xl shadow-lg border border-gray-100">
              <h3 class="font-bold text-lg mb-2">Community & Support</h3>
              <ul class="space-y-2">
                <li>
                  <a
                    href="https://deta.surf/discord"
                    target="_blank"
                    class="text-blue-500 hover:underline">Join Discord</a
                  >
                </li>
                <li>
                  <a
                    href="https://deta.notion.site/Surf-Zero-e9c49ddf02a8476fb3c53b7efdc7e0fd"
                    target="_blank"
                    class="text-blue-500 hover:underline">Documentation</a
                  >
                </li>
                <li>
                  <a
                    href="mailto:support@deta.surf"
                    target="_blank"
                    class="text-blue-500 hover:underline">Email Support</a
                  >
                </li>
              </ul>
            </div>
          </div>
        </div>
      {/if}
    </div>

    <div
      class="surfy fixed w-full h-full top-0 left-0 opacity-20 z--1 pointer-events-none"
      style="background-image: url({onboBg}); background-size: cover; background-position: center; opacity: 0.1;"
    ></div>
  </div>
</div>

<div
  class="fixed bottom-0 left-1/2 transform -translate-x-1/2 p-4 bg-white z-50 shadow-lg rounded-tl-2xl rounded-tr-2xl border border-gray-200"
  style="box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.05), 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04); border-top-left-radius: 12px; border-top-right-radius: 12px;"
>
  <div class="flex flex-col items-center justify-center">
    <p class="text-center text-gray-700">
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

<style lang="scss">
  :global(.font-gambarino) {
    font-family: 'Gambarino-Display', sans-serif;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    text-rendering: optimizeLegibility;
    font-smooth: always;
    font-feature-settings:
      'kern' 1,
      'liga' 1,
      'calt' 1;
  }

  button.selector {
    display: flex;
    flex-direction: row;
    align-items: baseline;
    .index {
      display: inline;
      margin-right: 0.5rem;
      font-size: 1rem;
      opacity: 0.7;
    }

    &.active {
      background: #4592ef !important;
      color: #fff;
    }
  }

  .onboarding-wrapper {
    background: #4592ef;
  }
</style>
