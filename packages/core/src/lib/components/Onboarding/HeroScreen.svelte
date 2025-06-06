<script lang="ts">
  import { onMount, createEventDispatcher, tick } from 'svelte'

  import { fade, fly, scale } from 'svelte/transition'
  import { launchTimeline } from './timeline'
  import { Icon } from '@horizon/icons'
  import { OnboardingFeature } from './onboardingScripts'
  import { useTabsManager } from '@horizon/core/src/lib/service/tabs'

  const dispatch = createEventDispatcher()

  const tabsManager = useTabsManager()

  let visible = false
  let showButton = false // Start with button hidden
  let isLoading = false // Track loading state
  let heroElement: HTMLElement

  // Function to start notes onboarding and dismiss hero screen
  const startAppOnboarding = async () => {
    isLoading = true

    try {
      // Create a promise that will be resolved by the callback
      const spaceCreationPromise = new Promise((resolve) => {
        // Dispatch event with a callback function that will be called when space creation is complete
        dispatch('create-onboarding-space', {
          callback: (success) => {
            console.log(
              'ccc-HeroScreen: Received callback - space creation ' +
                (success ? 'succeeded' : 'failed')
            )
            resolve(success)
          }
        })
      })

      // Wait for the callback to be called
      const success = await spaceCreationPromise

      if (!success) {
        console.error('Space creation failed')
        isLoading = false
        return
      }

      console.log('ccc-HeroScreen: Space creation and context switch confirmed complete')

      // Check if View Transitions API is supported
      if (typeof document !== 'undefined' && 'startViewTransition' in document) {
        try {
          // Apply view transition name directly before transition
          if (heroElement) {
            heroElement.style.viewTransitionName = 'hero-exit'
          }

          // Use the View Transitions API
          document.startViewTransition(async () => {
            // First animate out the hero screen
            visible = false

            // Launch the timeline only after space creation and context switch are complete
            console.log('ccc-HeroScreen: Launching timeline after context switch')
            launchTimeline(OnboardingFeature.AppOnboarding)

            // Dispatch dismiss event
            await tick()
            dispatch('dismiss')
          })
        } catch (error) {
          // Fallback if View Transitions API fails
          visible = false
          console.log('ccc-HeroScreen: Launching timeline after context switch (fallback)')
          launchTimeline(OnboardingFeature.AppOnboarding)
          await tick()
          dispatch('dismiss')
        }
      } else {
        // Fallback for browsers without View Transitions API
        visible = false
        console.log('ccc-HeroScreen: Launching timeline after context switch (no transitions API)')
        launchTimeline(OnboardingFeature.AppOnboarding)
        await tick()
        dispatch('dismiss')
      }
    } catch (error) {
      console.error('Error during onboarding process:', error)
      isLoading = false
    }
  }

  onMount(() => {
    setTimeout(() => {
      visible = true

      setTimeout(() => {
        showButton = true
      }, 3400) // Increased from 1500ms to 2000ms for better sequencing
    }, 1200)

    // HACK: We just mute all the tabs & unmute them on exit / completion
    for (let [_, browserTab] of Object.entries(tabsManager.browserTabsValue)) {
      browserTab.setMute(true)
    }
  })
</script>

<div class="fullscreen" bind:this={heroElement} out:fade={{ duration: 1800 }}>
  {#if visible}
    <div class="text-container" in:fade={{ duration: 1000 }}>
      <h1 in:fly={{ y: 500, duration: 3800, delay: 500 }}>
        Meet Surf, the first browser driven by your personal context.
      </h1>
      <p in:fly={{ y: 400, duration: 3600, delay: 750 }}>Let us show you how it works.</p>

      <div class="button-container">
        <div class="button-and-loading">
          {#if showButton}
            <button
              class="start-button"
              on:click={startAppOnboarding}
              in:scale={{ start: 0.8, duration: 800 }}
              disabled={isLoading}
            >
              {#if isLoading}
                <Icon name="spinner" size="1.72rem" />
              {:else}
                →
              {/if}
            </button>
          {/if}
          <span class="loading-text-container">
            {#if isLoading}
              <span
                class="loading-text"
                in:fly={{ y: 8, duration: 300, delay: 1500 }}
                out:fly={{ y: -8, duration: 300, delay: 1500 }}>Setting up your space...</span
              >
            {/if}
          </span>
        </div>
      </div>
    </div>
  {/if}
</div>

<style lang="scss">
  @use '@horizon/core/src/lib/styles/utils' as utils;
  /* View Transition API styles */
  @keyframes hero-exit-animation {
    from {
      opacity: 1;
      transform: scale(1);
    }
    to {
      opacity: 0;
      transform: scale(0.9);
    }
  }

  ::view-transition-old(hero-exit) {
    animation: 800ms cubic-bezier(0.4, 0, 0.2, 1) both hero-exit-animation;
  }

  ::view-transition-new(hero-exit) {
    animation: none;
    opacity: 0;
  }

  .button-and-loading {
    display: flex;
    flex-direction: column;
    align-items: center;
    min-height: 5rem; /* Ensure enough space for both button and text */
  }

  .loading-text-container {
    display: block;
    height: 1.5rem; /* Fixed height to prevent layout shifts */
    margin-top: 0.5rem;
  }

  .loading-text {
    font-size: 1rem;
    font-family: 'Inter', sans-serif;
    font-weight: 400;
    color: #ffffff;
    margin-top: 0.5rem;
    display: inline-block;
  }

  .fullscreen {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    display: flex;
    justify-content: center;
    align-items: center;
    background: radial-gradient(
        116.05% 111.85% at 44.33% 115.39%,
        #008ad7 0%,
        #43a3e2 57.27%,
        #009dfc 100%
      ),
      #fff;
    background: radial-gradient(
        116.05% 111.85% at 44.33% 115.39%,
        color(display-p3 0.2048 0.5316 0.8202) 0%,
        color(display-p3 0.3669 0.6319 0.866) 57.27%,
        color(display-p3 0.2 0.6039 0.9608) 100%
      ),
      color(display-p3 1 1 1);
    color: #1a1a1a;
    font-family: 'Inter', sans-serif;
    text-align: center;
    z-index: 100000000000000;
  }

  .text-container {
    max-width: 65ch;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  h1 {
    font-family: 'Gambarino-Display';
    font-size: clamp(3rem, 8vw, 4.5rem);
    margin-bottom: 1.5rem;
    letter-spacing: -0.02em;
    line-height: 1.1;
    color: #ffffff;
    text-rendering: optimizeLegibility;
  }

  p {
    font-size: clamp(1.125rem, 3vw, 1.5rem);
    opacity: 0.85;
    line-height: 1.5;
    letter-spacing: 0.01em;
    font-weight: 300;
    max-width: 50ch;
    margin: 0 auto;
    color: #ffffff;
    margin-bottom: 2.5rem;
    text-rendering: optimizeLegibility;
  }

  .button-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
  }

  .start-button {
    background: paint(squircle) !important;
    --squircle-radius: 18px;
    --squircle-smooth: 0.28;
    --squircle-fill: rgba(255, 255, 255, 0.9);
    color: #008ad7;
    border: none;
    padding: 0.8rem 2rem;
    border-radius: 1.2rem;
    font-size: 1.125rem;
    font-weight: 500;
    cursor: pointer;
    transition:
      transform 0.2s ease,
      box-shadow 0.2s ease;
    box-shadow: 0 4px 12px rgba(73, 82, 242, 0.25);
  }

  .start-button:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 16px rgba(73, 82, 242, 0.35);
  }

  .start-button:disabled {
    opacity: 0.8;
    cursor: wait;
    transform: none;
    box-shadow: 0 4px 12px rgba(73, 82, 242, 0.15);
  }

  .start-button:active {
    transform: translateY(1px);
    box-shadow: 0 2px 8px rgba(73, 82, 242, 0.2);
  }

  @media (max-width: 768px) {
    h1 {
      margin-bottom: 1rem;
    }

    p {
      margin-bottom: 2rem;
    }

    .start-button {
      padding: 0.7rem 1.8rem;
      font-size: 1rem;
    }
  }
</style>
