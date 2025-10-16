<script lang="ts">
  import { onDestroy, onMount, tick } from 'svelte'
  import { writable } from 'svelte/store'
  import type { UserSettings } from '@deta/types'

  import EmailView from './components/EmailView.svelte'
  import InviteView from './components/InviteView.svelte'
  import PersonaView from './components/PersonaView.svelte'
  import DoneView from './components/DoneView.svelte'
  import AnalyticsView from './components/AnalyticsView.svelte'

  type ViewType = 'email' | 'invite' | 'persona' | 'disclaimer' | 'done'

  //@ts-ignore
  let presetInviteCode: string = window.presetInviteCode || ''
  // @ts-ignore
  let presetEmail: string = window.presetEmail || ''

  let initialView: ViewType = presetInviteCode ? 'invite' : 'email'
  let view: ViewType = initialView

  let viewHistory: ViewType[] = [initialView]
  let tabsOrientation: 'horizontal' | 'vertical' = 'horizontal'
  let selectedPersonas: string[] = []

  let inviteView: InviteView

  const userEmailStore = writable(presetEmail)
  const mountUnsubscribers: (() => void)[] = []

  onMount(() => {
    if (presetInviteCode) {
      inviteView.submitInviteCode(presetInviteCode)
    }
  })

  onDestroy(() => {
    mountUnsubscribers.forEach((unsub) => unsub())
  })

  let setupPreloadEvents = {} as typeof window.preloadEvents
  for (const [key, value] of Object.entries(window.preloadEvents)) {
    if (typeof value === 'function') {
      setupPreloadEvents[key as keyof typeof window.preloadEvents] = (...args: any[]) => {
        const unsubscribe = (value as Function).apply(window.preloadEvents, args)
        if (typeof unsubscribe === 'function') {
          mountUnsubscribers.push(unsubscribe)
        }
        return unsubscribe
      }
    } else {
      setupPreloadEvents[key as keyof typeof window.preloadEvents] = value
    }
  }

  // @ts-ignore
  setupPreloadEvents.onSetupVerificationCode(async (code: string) => {
    view = 'invite'
    await tick()
    inviteView.submitInviteCode(code)
  })

  /**
   * Handle view changes in the setup flow
   */
  const handleViewChange = async (event: CustomEvent<ViewType>) => {
    // Get the target view from the event
    let targetView = event.detail

    // Set the view and update history
    view = targetView
    viewHistory.push(view)
  }

  const handleSetUserEmail = (event: CustomEvent<string>) => {
    userEmailStore.set(event.detail)
    view = 'invite'
    viewHistory.push(view)
  }

  const handleBack = () => {
    if (viewHistory.length > 1) {
      viewHistory.pop() // Remove current view
      view = viewHistory[viewHistory.length - 1] // Set view to previous
    }
  }

  const handlePersonasChange = (event: CustomEvent<string[]>) => {
    selectedPersonas = event.detail
  }

  const handleStart = async () => {
    await window.api.updateUserConfigSettings({
      tabs_orientation: tabsOrientation,
      personas: selectedPersonas
    })

    window.api.restartApp()
  }
</script>

<main>
  <div class="wrapper" class:wide={view === 'disclaimer'}>
    {#if view === 'email'}
      <EmailView on:setUserEmail={handleSetUserEmail} on:viewChange={handleViewChange} />
    {:else if view === 'invite'}
      <InviteView
        bind:this={inviteView}
        emailStore={userEmailStore}
        on:viewChange={handleViewChange}
      />
    {:else if view === 'persona'}
      <PersonaView
        {selectedPersonas}
        on:personasChange={handlePersonasChange}
        on:viewChange={handleViewChange}
        on:back={handleBack}
      />
      <!-- {:else if view === 'import'}
      <ImportView on:viewChange={handleViewChange} on:back={handleBack} /> -->
      <!-- {:else if view === 'explainer.stuff'}
      <ExplainerStuff
        persona={selectedPersonas}
        on:viewChange={handleViewChange}
        on:back={handleBack}
      />
    {:else if view === 'contexts'}
      <ContextView {selectedPersonas} on:viewChange={handleViewChange} on:back={handleBack} /> -->
      <!-- {:else if view === 'explainer.chat'}
      <ExplainerChat
        persona={selectedPersonas}
        on:viewChange={handleViewChange}
        on:back={handleBack}
      /> -->
      <!-- {:else if view === 'language'}
      <LanguageView
        {embeddingModel}
        on:modelChange={handleModelChange}
        on:viewChange={handleViewChange}
        on:back={handleBack}
      />
    {:else if view === 'prefs'}
      <PrefsView
        {tabsOrientation}
        on:orientationChange={handleOrientationChange}
        on:viewChange={handleViewChange}
        on:back={handleBack}
      /> -->
    {:else if view === 'disclaimer'}
      <AnalyticsView on:viewChange={handleViewChange} />
    {:else if view === 'done'}
      <DoneView on:start={handleStart} />
    {/if}
  </div>
</main>

<style lang="scss">
  :global(*) {
    box-sizing: border-box;
    text-rendering: optimizeLegibility;
    -webkit-font-smoothing: antialiased;
  }

  :global(:root) {
    --color-text: #0c081a;
    --color-text-muted: #110f18a2;
    --color-brand: #1d8aff;
    --color-brand-dark: #006cdf;
    --color-link: #1d8aff;
    --color-link-dark: #006cdf;
    --color-background: #f6faff;
    --color-background-dark: #e2eeff;
  }

  :global(p),
  :global(span) {
    font-family: 'Inter', sans-serif;
    font-size: 1rem;
    line-height: 1.6;
    color: var(--color-text);
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    margin: 0;
    padding: 0;
    letter-spacing: 0.01em;
  }

  :global(p) {
    font-family: 'Inter', sans-serif;
    margin-top: 0.375rem;
    margin-bottom: 0.375rem;
  }

  :global(.details ul) {
    font-size: 0.9rem;
    line-height: 1.6;
    color: var(--color-text);
    font-weight: normal;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    margin-left: 0;
    padding-left: 1rem;
  }

  :global(span) {
    display: inline-block;
  }

  :global(p span.pill) {
    background: #4592f0;
    color: #e0e0e0;
    font-size: 1.1rem;
    font-family: 'Inter', sans-serif;
    font-weight: 400;
    line-height: 1;
    padding: 0.3rem 0.5rem;
    border-radius: 4px;
    box-shadow: 0px 1px 0 #3474c0;
  }

  :global(p) {
    font-size: 1rem;
    font-family: 'Inter', sans-serif;
    color: rgba(0, 0, 0, 0.5);
    margin-bottom: 1rem;
    text-align: left;
  }

  :global(h1) {
    font-family: 'Gambarino-Display', sans-serif;
    font-size: 2rem;
    margin-bottom: 2rem;
  }

  :global(h2) {
    font-size: 1.5rem;
    font-family: 'Gambarino-Display';
    font-weight: 700;
    margin-bottom: 0.25rem;
  }

  main {
    min-height: 100vh;
    display: flex;
    color: var(--color-text);
    background: var(--color-background);
    background-position: center 0;
    background-size: cover;
  }

  .wrapper {
    width: 100%;
    height: 100%;
    min-height: 100vh;
    display: flex;
    gap: 1.75rem;
    text-align: center;
    font-size: 1.075rem;

    :global(a) {
      color: var(--color-link);
      text-decoration: none;

      &:hover {
        color: var(--color-link-dark);
      }
    }

    img {
      width: 100px;
      height: 100px;
    }
  }

  :global(.back-button) {
    background: 0;
    border: 0;
    transition:
      transform 0.2s,
      color 0.2s;

    &:hover {
      transform: translateX(-3px);
      color: var(--color-brand);
    }
  }
</style>
