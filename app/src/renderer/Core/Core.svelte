<script lang="ts">
  import { onMount, onDestroy } from 'svelte'

  import { useLogScope } from '@deta/utils/io'
  import type { Fn } from '@deta/types'

  import { ShortcutActions } from '@deta/services/shortcuts'
  import { initServices } from '@deta/services/helpers'
  import { handlePreloadEvents } from './handlers/preloadEvents'

  import WebContentsView from './components/WebContentsView.svelte'
  import TabsList from './components/Tabs/TabsList/TabsList.svelte'
  //import Overlay from './components/Overlays/Overlay.svelte'

  //import Test from './components/Overlays/Test.svelte'
  //import Split from './components/Layout/Split.svelte'
  import NavigationBar from './components/NavigationBar/NavigationBar.svelte'
  import AppSidebar from './components/Layout/AppSidebar.svelte'
  import { wait } from '@deta/utils'
  import TeletypeEntry from './components/Teletype/TeletypeEntry.svelte';

  const log = useLogScope('Core')

  const { config, viewManager, tabsService, ai, keyboardManager, shortcutsManager } = initServices()

  // const overlayManager = useOverlayManager()

  const contextManager = ai.contextManager

  const activeTabView = $derived(tabsService.activeTab?.view)

  let unsubs: Fn[] = []

  // let overlayWrapper: HTMLDivElement | null = null

  // const view1 = viewManager.create({ url: 'https://google.com', permanentlyActive: true })
  // const view2 = viewManager.create({ url: 'https://wikipedia.org', permanentlyActive: true })

  let open = $state(false)

  onMount(async () => {
    log.debug('Core component mounted')

    const settings = config.settingsValue
    log.debug('User settings:', settings)

    await tabsService.ready

    shortcutsManager.registerHandler(ShortcutActions.NEW_TAB, () => {
      log.debug('Creating new tab (CMD+T)')
      tabsService.create('surf://notebook')
      return true
    })

    shortcutsManager.registerHandler(ShortcutActions.CLOSE_TAB, () => {
      log.debug('Closing current tab (CMD+W)')
      if (tabsService.activeTab) {
        tabsService.delete(tabsService.activeTab.id)
      }
      return true
    })

    const tabSwitchActions = [
      ShortcutActions.SWITCH_TO_TAB_1,
      ShortcutActions.SWITCH_TO_TAB_2,
      ShortcutActions.SWITCH_TO_TAB_3,
      ShortcutActions.SWITCH_TO_TAB_4,
      ShortcutActions.SWITCH_TO_TAB_5,
      ShortcutActions.SWITCH_TO_TAB_6,
      ShortcutActions.SWITCH_TO_TAB_7,
      ShortcutActions.SWITCH_TO_TAB_8,
      ShortcutActions.SWITCH_TO_TAB_9
    ]

    tabSwitchActions.forEach((action, index) => {
      shortcutsManager.registerHandler(action, () => {
        const tabIndex = index
        const tabs = tabsService.tabs

        if (tabs.length > tabIndex) {
          const targetTab = tabs[tabIndex]
          log.debug(`Switching to tab ${tabIndex + 1} (${targetTab.id})`)
          tabsService.setActiveTab(targetTab.id)
        }
        return true
      })
    })

    shortcutsManager.registerHandler(ShortcutActions.SWITCH_TO_LAST_TAB, () => {
      const tabs = tabsService.tabs
      if (tabs.length > 0) {
        const lastTab = tabs.at(-1)
        log.debug(`Switching to last tab (${lastTab.id})`)
        tabsService.setActiveTab(lastTab.id)
      }
      return true
    })

    shortcutsManager.registerHandler(ShortcutActions.TOGGLE_SIDEBAR, () => {
      viewManager.setSidebarState({ open: !viewManager.sidebarViewOpen })
      return true
    })

    unsubs.push(handlePreloadEvents())

    wait(2000).then(() => {
      const tab = tabsService.tabsValue[0]
      log.debug('Adding tab to context', tab.id)
      contextManager.addTab(tab)
    })
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
  <TeletypeEntry bind:open />

  <div class="app-bar">
    <div class="tabs">
      <TabsList />
      <!-- <Button onclick={handleClick}>Create Overlay</Button> -->

      <!-- <Overlay bounds={{ x: 200, y: 200, width: 400, height: 180 }}>
      <Test />
    </Overlay> -->
    </div>
  </div>

  <main>
    <div class="tab-view">
      {#if activeTabView}
        <NavigationBar view={activeTabView} />
      {/if}
      <div class="tab-contents">
        {#each tabsService.tabs as tab, idx (tab.id)}
          {#if tabsService.activatedTabs.includes(tab.id)}
            <WebContentsView
              view={tabsService.tabs[idx].view}
              active={tabsService.activeTab?.id === tab.id}
            />
          {/if}
        {/each}
      </div>
    </div>

    <AppSidebar />
  </main>

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
    background: var(--app-background);
    display: flex;
    flex-direction: column;
  }

  .app-bar {
    background: var(--app-background);
  }

  .tabs {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 0 5px;
    //border-bottom: 1px solid var(--border-color);
    app-region: drag;
  }

  main {
    height: 100%;
    display: flex;
    gap: 0rem;
  }

  .tab-view {
    display: flex;
    flex-direction: column;
    height: 100%;
    flex-grow: 1;
    flex-shrink: 1;
  }
  .tab-contents {
    height: 100%;
    width: 100%;
    position: relative;
    margin-inline: 1px;
    border-inline: 1px solid var(--border-color);
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
