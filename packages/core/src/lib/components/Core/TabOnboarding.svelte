<script lang="ts" context="module">
  export type OnboardingEvents = {
    openChat: { query: string; preserveContext?: boolean }
    openStuff: void
    openScreenshot: void
    launchTimeline: OnboardingFeature
    endTimeline: void
    createOnboardingSpace: void
    batchOpenTabs: string[]
    wipecontext: void
  }
</script>

<script lang="ts">
  import { isMac, wait } from '@horizon/utils'
  import { writable } from 'svelte/store'
  import { OnboardingFeature } from '../Onboarding/onboardingScripts'
  import { get } from 'svelte/store'
  import { createEventDispatcher, onMount, tick } from 'svelte'
  import { useOasis } from '../../service/oasis'
  import {
    onboardingSpace,
    onboardingResources,
    onboardingTabs,
    onboardingPDF,
    onboardingYoutube
  } from '../../constants/examples'
  import onboardingSky from '../../../../public/assets/demo/onboarding-sky.png'
  import { useConfig } from '@horizon/core/src/lib/service/config'

  import type { ResourceManager } from '@horizon/core/src/lib/service/resources'
  import { type Resource } from '@horizon/core/src/lib/service/resources'

  import { useDesktopManager } from '../../service/desktop'
  import { savedResources } from '../Onboarding/store'

  import SaveAnythingSection from '../Onboarding/sections/01.SaveAnything.svelte'
  import YourStuffSection from '../Onboarding/sections/02.YourStuff.svelte'
  import DesktopSection from '../Onboarding/sections/03.Desktop.svelte'
  import VisionSection from '../Onboarding/sections/04.Vision.svelte'
  import ChatSection from '../Onboarding/sections/05.Chat.svelte'
  import SmartNotesSection from '../Onboarding/sections/07.SmartNotes.svelte'
  import Codegen from '../Onboarding/sections/08.Codegen.svelte'
  import NewNotes from '../Onboarding/sections/09.NewNotes.svelte'
  import Done from '../Onboarding/sections/00.Done.svelte'
  import { OpenHomescreenEventTrigger } from '@horizon/types'
  import { MAIN_ONBOARDING_VIDEO_URL } from '@horizon/core/src/lib/utils/env'

  const dispatch = createEventDispatcher<OnboardingEvents>()
  const oasis = useOasis()
  const config = useConfig()
  const desktopManager = useDesktopManager()
  const userSettings = config.settings

  export let resourceManager: ResourceManager
  export const onboardingRunning = writable(true)
  export let section: string | undefined = undefined

  // Navigation state and config
  let activeSection = 'welcome'
  let observer: IntersectionObserver
  const sections = [
    { id: 'save-anything', label: 'Save Anything' },
    { id: 'your-stuff', label: 'Your Stuff' },
    { id: 'desktop', label: 'Desktop' },
    { id: 'vision', label: 'Vision' },

    ...($userSettings.experimental_notes_chat_sidebar
      ? [
          {
            id: 'notes',
            label: 'Notes'
          }
        ]
      : [
          { id: 'chat', label: 'Chat' },
          { id: 'smart-notes', label: 'Notes' }
        ]),
    { id: 'surflets', label: 'Surflets' }
    // { id: 'contexts', label: 'Contexts' }
  ]

  let allSavedResources: Resource[] = []

  // Subscribe to the store
  savedResources.subscribe((resources) => {
    allSavedResources = resources
  })

  $: modShortcut = isMac() ? '⌘' : 'Ctrl'

  const handleTryVision = () => {
    dispatch('openScreenshot')
  }

  const handleTryChatWithSpace = async () => {
    const ONBOARDING_SPACE_NAME = onboardingSpace.name
    const ONBOARDING_SPACE_QUERY = onboardingSpace.query
    const spaces = get(oasis.spaces)
    const space = spaces.find((space) => {
      return space.dataValue.folderName === ONBOARDING_SPACE_NAME
    })

    if (space) {
      console.debug('detaSpace found:', space.id)
      dispatch('openChat', { query: ONBOARDING_SPACE_QUERY, preserveContext: true })
    } else {
      dispatch('createOnboardingSpace')
      dispatch('openChat', { query: ONBOARDING_SPACE_QUERY, preserveContext: true })
      console.error(`Space "${ONBOARDING_SPACE_NAME}" not found`)
    }

    dispatch('launchTimeline', OnboardingFeature.ChatWithSpaceOnboardingInStuff)
    dispatch('openStuff')
    await wait(2000)
  }

  const handleTryChatWithTabs = async () => {
    dispatch('launchTimeline', OnboardingFeature.ChatWithTabsOnboarding)
    dispatch('batchOpenTabs', onboardingTabs)

    await wait(2000)

    dispatch('openChat', {
      query: 'Summarize this page and show me the historical context of the playstation.',
      preserveContext: true
    })
  }

  const handleTryChatWithPDF = async () => {
    dispatch('launchTimeline', OnboardingFeature.ChatWithPDFOnboarding)
    dispatch('wipecontext')
    await tick()
    dispatch('batchOpenTabs', [onboardingPDF])

    await wait(2000)

    dispatch('openChat', {
      query: 'How is intelligence related to context?',
      preserveContext: true
    })
  }

  const handleTryChatWithYoutubeVideo = async () => {
    dispatch('launchTimeline', OnboardingFeature.ChatWithYoutubeVideoOnboarding)
    dispatch('batchOpenTabs', [onboardingYoutube])
    await wait(2000)
    dispatch('openChat', { query: 'What did steve say about styluses?', preserveContext: true })
  }

  const handleTryStuff = () => {
    dispatch('launchTimeline', OnboardingFeature.StuffOnboarding)
    dispatch('openStuff')
  }

  const handleTryDesktop = async () => {
    desktopManager.setVisible(true, { trigger: OpenHomescreenEventTrigger.Onboarding })
    await wait(250)
    dispatch('launchTimeline', OnboardingFeature.DesktopOnboarding)
  }

  const handleResourcesSaved = (event: CustomEvent<{ resources: Resource[] }>) => {
    savedResources.addResources(event.detail.resources)
  }

  function scrollToSection(sectionId: string) {
    const element = document.getElementById(sectionId)
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' })
    }
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

    // Enhanced intersection observer configuration
    observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            // Find the first visible section with highest intersection ratio
            const visibleSections = entries
              .filter((e) => e.isIntersecting)
              .sort((a, b) => b.intersectionRatio - a.intersectionRatio)

            if (visibleSections.length > 0) {
              activeSection = visibleSections[0].target.id
            }
          }
        })
      },
      {
        // Adjusted threshold array for more precise tracking
        threshold: [0, 0.25, 0.5, 0.75, 1],
        rootMargin: '-10% 0px -90% 0px' // Adjusted to better detect current section
      }
    )

    // Observe all sections
    document.querySelectorAll('section[id]').forEach((section) => {
      observer.observe(section)
    })

    return () => {
      if (observer) {
        observer.disconnect()
      }
    }
  })
</script>

<div class="flex flex-col w-full onboarding-wrapper">
  <div class="background-gradient" />

  <div class="h-screen overflow-y-auto">
    {#if !section || section === 'welcome'}
      <section
        id="welcome"
        class="hero h-[80vh] flex flex-col items-center justify-center relative z-10 p-4 md:!p-8 lg:!p-32"
        style="background-image: url({onboardingSky})"
      >
        <div class="absolute top-4 right-1 p-3 bg-white/90 z-50 rounded-xl w-full md:!w-auto mx-4">
          <div class="flex flex-col items-center justify-center">
            <p class="text-center text-gray-700 text-sm md:!text-base">
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
        <div class="flex flex-col gap-4 w-full max-w-7xl mx-auto px-4" style="z-index: 2147483647">
          <h1
            class="font-gambarino text-3xl md:!text-5xl text-center text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.1)]"
          >
            Welcome to Surf
          </h1>
          <p
            class="text-lg md:!text-xl text-center text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.1)]"
          >
            It's a browser, file manager, and AI assistant — all in one.
          </p>
        </div>
        <div
          class="flex flex-col my-8 gap-4 w-full max-w-7xl max-h-full aspect-video"
          style="z-index: 2147483647;"
        >
          <webview
            src={MAIN_ONBOARDING_VIDEO_URL}
            class="w-full h-full shadow-xl rounded-xl overflow-hidden"
            partition="app"
          />
        </div>
      </section>
    {/if}

    {#if !section}
      <div
        class="sticky-topbar sticky z-50 bg-white/90 backdrop-blur-sm border-b border-gray-200 shadow-sm top-2 ml-2 rounded-lg"
      >
        <nav class="max-w-7xl mx-auto px-4">
          <ul class="flex items-center justify-center space-x-1 h-16">
            {#each sections as sectionItem}
              <li>
                <button
                  on:click={() => scrollToSection(sectionItem.id)}
                  class="px-4 py-2 rounded-lg text-sm transition-colors duration-200 {activeSection ===
                  sectionItem.id
                    ? 'bg-[#4592ef] text-white'
                    : 'text-gray-600 hover:bg-gray-100'}"
                >
                  {sectionItem.label}
                </button>
              </li>
            {/each}
          </ul>
        </nav>
      </div>
    {/if}

    {#if !section || section === 'save-anything'}
      <section id="save-anything">
        <SaveAnythingSection
          {onboardingResources}
          {resourceManager}
          on:resourcesSaved={handleResourcesSaved}
        />
      </section>
    {/if}

    {#if !section || section === 'your-stuff'}
      <section id="your-stuff">
        <YourStuffSection
          on:tryStuff={handleTryStuff}
          on:launchTimeline={({ detail }) => dispatch('launchTimeline', detail)}
        />
      </section>
    {/if}

    {#if !section || section === 'desktop'}
      <section id="desktop">
        <DesktopSection on:tryDesktop={handleTryDesktop} savedResources={allSavedResources} />
      </section>
    {/if}

    {#if !section || section === 'vision'}
      <section id="vision">
        <VisionSection on:tryVision={handleTryVision} />
      </section>
    {/if}

    {#if $userSettings.experimental_notes_chat_sidebar}
      {#if !section || section === 'notes'}
        <section id="notes">
          <NewNotes on:launchTimeline />
        </section>
      {/if}
    {:else}
      {#if !section || section === 'chat'}
        <section id="chat" style="position: relative; z-index: 1;">
          <ChatSection
            on:tryChatWithSpace={handleTryChatWithSpace}
            on:tryChatWithTabs={handleTryChatWithTabs}
            on:tryChatWithPDF={handleTryChatWithPDF}
            on:tryChatWithYoutubeVideo={handleTryChatWithYoutubeVideo}
            on:launchTimeline={({ detail }) => dispatch('launchTimeline', detail)}
          />
        </section>
      {/if}

      {#if !section || section === 'smart-notes'}
        <section id="smart-notes">
          <SmartNotesSection on:highlightWebviewText on:seekToTimestamp />
        </section>
      {/if}
    {/if}

    {#if !section || section === 'surflets'}
      <section id="surflets">
        <Codegen on:tryVision={handleTryVision} />
      </section>
    {/if}

    <!-- {#if !section || section === 'contexts'}
    <section id="contexts">
      <ContextsSection />
    </section>
    {/if} -->

    {#if !section}
      <Done {modShortcut} />
    {/if}
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

  .hero {
    background-image: --onboarding-sky;
    background-size: cover;
    background-position: top center;
  }

  .background-gradient {
    position: fixed;
    background: linear-gradient(
      to top,
      white -20%,
      rgba(255, 255, 255, 0.9) 0%,
      rgba(255, 255, 255, 0.7) 10%,
      rgba(255, 255, 255, 0.4) 25%,
      rgba(255, 255, 255, 0.2) 35%,
      transparent 50%,
      transparent 75%,
      rgba(255, 255, 255, 0.05) 85%,
      rgba(255, 255, 255, 0.1) 92%,
      rgba(255, 255, 255, 0.12) 100%
    );
    width: 100%;
    height: 100%;
    z-index: 0;
  }

  .onboarding-wrapper {
    background: #4592ef;
  }

  .sticky-topbar {
    margin: 8px;
  }
</style>
