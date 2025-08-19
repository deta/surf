<script lang="ts">
  import { onMount, onDestroy } from 'svelte'

  import { useLogScope } from '@deta/utils'
  import {
    provideConfig,
    useViewManager,
    useTabs,
    createKeyboardManager,
    createShortcutManager,
    defaultShortcuts,
    ShortcutActions,
    useOverlayManager
  } from '@deta/services'
  import type { Fn } from '@deta/types'

  import { handlePreloadEvents } from './handlers/preloadEvents'

  import TeletypeEntry from './components/Teletype/TeletypeEntry.svelte'
  import WebContentsView from './components/WebContentsView.svelte'
  import TabsList from './components/Tabs/TabsList.svelte'
  import Overlay from './components/Overlays/Overlay.svelte'

  import Test from './components/Overlays/Test.svelte'
  import Split from './components/Layout/Split.svelte'

  const log = useLogScope('Core')
  const config = provideConfig()
  const viewManager = useViewManager()
  const tabsService = useTabs()
  const overlayManager = useOverlayManager()

  const keyboardManager = createKeyboardManager()
  const shortcutsManager = createShortcutManager<ShortcutActions>(keyboardManager, defaultShortcuts)

  let open = $state(false)

  let unsubs: Fn[] = []
  let overlayWrapper: HTMLDivElement | null = null

  // const view1 = viewManager.create({ url: 'https://google.com', permanentlyActive: true })
  // const view2 = viewManager.create({ url: 'https://wikipedia.org', permanentlyActive: true })

  onMount(async () => {
    log.debug('Core component mounted')

    const settings = config.settingsValue
    log.debug('User settings:', settings)

    await tabsService.ready

    shortcutsManager.registerHandler(ShortcutActions.NEW_TAB, () => {
      log.debug('Opening Teletype')
      open = !open
      // shortcutsManager.setCustomShortcut(ShortcutActions.NEW_TAB, open ? 'Escape' : 'Meta+T')
      return true
    })

    // shortcutsManager.registerHandler(ShortcutActions.CLOSE_TAB, () => {
    //   log.debug('Closing Tab')
    //   tabsService.delete(tabsService.activeTab?.id)
    //   return true
    // })

    unsubs.push(handlePreloadEvents())
  })

  onDestroy(() => {
    log.debug('Core component destroyed')
    unsubs.forEach((unsub) => unsub())
    viewManager.onDestroy()
    tabsService.onDestroy()
  })

  $inspect(tabsService.tabs).with((...e) => {
    log.debug('tabs changed:', e)
  })

  $inspect(tabsService.activeTab).with((...e) => {
    log.debug('active tab changed:', e)
  })

  $inspect(tabsService.activatedTabs).with((...e) => {
    log.debug('activated tabs changed:', e)
  })
</script>

<svelte:window onkeydown={keyboardManager.handleKeyDown} />

<div class="main">
  <!-- <Browser /> -->

  <!-- <div class="content">
    <h1>Surf Greenfield</h1>

    <p>Svelte 5, Vite 7, electron-vite 4, Electron 37</p>
    <Button {onclick}>Clicks {count}</Button>

    <Link url="https://deta.surf">What is Surf?</Link>
  </div> -->

  <div class="tabs">
    <TabsList />
    <!-- <Button onclick={handleClick}>Create Overlay</Button> -->

    <!-- <Overlay bounds={{ x: 200, y: 200, width: 400, height: 180 }}>
      <Test />
    </Overlay> -->
  </div>

  <div class="web-contents">
    {#each tabsService.tabs as tab, idx (tab.id)}
      {#if tabsService.activatedTabs.includes(tab.id)}
        <WebContentsView
          view={tabsService.tabs[idx].view}
          active={tabsService.activeTab?.id === tab.id}
        />
      {/if}
    {/each}
  </div>

  <!-- <Split>
    {#snippet left()}
      <WebContentsView
        view={view1}
        active
      />
    {/snippet}

    {#snippet right()}
      <WebContentsView
        view={view2}
        active
      />
    {/snippet}
  </Split> -->

  <TeletypeEntry bind:open />
</div>

<style lang="scss">
  :global(html) {
    height: 100vh;
    width: 100vw;
    overflow: hidden;
    font-family: Inter, sans-serif;
    font-size: 16px;
  }

  .main {
    width: 100%;
    height: 100%;
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
  }

  .content {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 15px;
    height: 100%;
    width: 100%;
    background: rgb(237, 237, 237);

    h1 {
      font-size: 2rem;
      color: var(--text);
    }

    button {
      padding: 10px 20px;
      font-size: 16px;
      border: none;
      border-radius: 4px;
      background-color: #007bff;
      color: white;
      cursor: pointer;
    }
  }

  .tabs {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 0 5px;
    background: var(--app-background);
    border-bottom: 1px solid var(--border-color);
    app-region: drag;
  }

  .tab {
    padding: 10px;
    background-color: var(--background-accent);
    border-radius: var(--border-radius);
    cursor: pointer;
    transition: background-color 0.3s;

    &:hover {
      background-color: var(--primary-dark);
      color: white;
    }
  }

  .web-contents {
    height: 100%;
    width: 100%;
    position: relative;
  }

  .overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    pointer-events: none;
    z-index: 1000;
  }

  :global(:root) {
    --text: #586884;
    --text-p3: color(display-p3 0.3571 0.406 0.5088);
    --text-light: #666666;
    --background-dark: radial-gradient(
      143.56% 143.56% at 50% -43.39%,
      #eef4ff 0%,
      #ecf3ff 50%,
      #d2e2ff 100%
    );
    --background-dark-p3: radial-gradient(
      143.56% 143.56% at 50% -43.39%,
      color(display-p3 0.9373 0.9569 1) 0%,
      color(display-p3 0.9321 0.9531 1) 50%,
      color(display-p3 0.8349 0.8849 0.9974) 100%
    );
    --background-accent: #ffffff;
    --background-accent-p3: color(display-p3 1 1 1);
    --border-color: #e0e0e088;
    --outline-color: #e0e0e080;
    --primary: #2a62f1;
    --primary-dark: #a48e8e;
    --green: #0ec463;
    --red: #f24441;
    --orange: #fa870c;
    --border-width: 0.5px;
    --border-color: #58688460;
    --color-brand: #b7065c;
    --color-brand-muted: #b7065cba;
    --color-brand-dark: #ff4fa4;

    --border-radius: 18px;
  }
</style>
