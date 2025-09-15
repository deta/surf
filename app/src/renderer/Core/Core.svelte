<script lang="ts">
  import { onMount, onDestroy } from 'svelte'

  import { useLogScope } from '@deta/utils/io'
  import { TelemetryCreateTabSource, type Fn } from '@deta/types'

  import { ShortcutActions } from '@deta/services/shortcuts'
  import { initServices } from '@deta/services/helpers'
  import { handlePreloadEvents } from './handlers/preloadEvents'

  import WebContentsView from './components/WebContentsView.svelte'
  import TabsList from './components/Tabs/TabsList/TabsList.svelte'
  import NavigationBar from './components/NavigationBar/NavigationBar.svelte'
  import AppSidebar from './components/Layout/AppSidebar.svelte'
  import { isLinux, isMac, isWindows, useDebounce, wait } from '@deta/utils'
  import { Button, prepareContextMenu } from '@deta/ui'
  import { debugMode } from './stores/debug'
  import AltWindowControls from './components/AltWindowControls.svelte'
  import { Icon } from '@deta/icons'

  const log = useLogScope('Core')

  const {
    telemetry,
    config,
    viewManager,
    tabsService,
    keyboardManager,
    shortcutsManager,
    browser
  } = initServices()

  const activeTabView = $derived(tabsService.activeTab?.view)

  let unsubs: Fn[] = []
  let activeTabNavigationBar: NavigationBar | undefined

  // TODO: move into searchinput directly?
  const handleSearchInput = useDebounce((value: string) => {
    tabsService.activeTab?.view?.webContents.updatePageQuery(value)
  }, 100)

  onMount(() => {
    let unsub
    wait(500).then(() => (unsub = prepareContextMenu(true)))
    return () => unsub?.()
  })
  onMount(async () => {
    log.debug('Core component mounted')
    await telemetry.init({ configService: config })

    if (isWindows()) document.body.classList.add('os_windows')
    if (isMac()) document.body.classList.add('os_mac')
    if (isLinux()) document.body.classList.add('os_linux')

    const settings = config.settingsValue
    log.debug('User settings:', settings)

    await tabsService.ready

    // @ts-ignore
    window.setLogLevel = (level: LogLevel) => {
      // @ts-ignore
      window.LOG_LEVEL = level
      log.debug(`[Logger]: Log level set to '${level}'`)

      return level
    }

    shortcutsManager.registerHandler(ShortcutActions.TOGGLE_DEBUG_MODE, () => {
      log.debug('Toggling debug mode')
      debugMode.update((mode) => !mode)

      // @ts-ignore
      if (window.LOG_LEVEL === 'debug') {
        // @ts-ignore
        window.setLogLevel('info')
      } else {
        // @ts-ignore
        window.setLogLevel('debug')
      }
      return true
    })

    shortcutsManager.registerHandler(ShortcutActions.NEW_TAB, () => {
      log.debug('Creating new tab (CMD+T)')
      tabsService.openNewTabPage()
      telemetry.trackCreateTab(TelemetryCreateTabSource.KeyboardShortcut)

      return true
    })

    shortcutsManager.registerHandler(ShortcutActions.CLOSE_TAB, () => {
      log.debug('Closing current tab (CMD+W)')
      if (tabsService.activeTab) {
        tabsService.delete(tabsService.activeTab.id, true)
      }
      return true
    })

    shortcutsManager.registerHandler(ShortcutActions.REOPEN_CLOSED_TAB, () => {
      log.debug('Reopening last closed tab (CMD+Shift+T)')
      tabsService.reopenLastClosed()
      return true
    })

    shortcutsManager.registerHandler(ShortcutActions.EDIT_TAB_URL, () => {
      window.api.focusMainRenderer()
      // TODO: This should target the active wcv if it has a locationbar attached, not just the "active tab"
      activeTabNavigationBar.setIsEditingLocation(true)
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
          tabsService.setActiveTab(targetTab.id, true)
        }
        return true
      })
    })

    shortcutsManager.registerHandler(ShortcutActions.SWITCH_TO_LAST_TAB, () => {
      const tabs = tabsService.tabs
      if (tabs.length > 0) {
        const lastTab = tabs.at(-1)
        log.debug(`Switching to last tab (${lastTab.id})`)
        tabsService.setActiveTab(lastTab.id, true)
      }
      return true
    })

    shortcutsManager.registerHandler(ShortcutActions.TOGGLE_SIDEBAR, () => {
      viewManager.setSidebarState({ open: !viewManager.sidebarViewOpen })
      return true
    })

    unsubs.push(handlePreloadEvents())

    wait(500).then(() => {
      if (tabsService.tabs.length <= 0) {
        tabsService.openNewTabPage()
      }
    })
  })

  onDestroy(() => {
    log.debug('Core component destroyed')
    unsubs.forEach((unsub) => unsub())
    viewManager.onDestroy()
    tabsService.onDestroy()
    browser.onDestroy()
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
  <div class="app-bar">
    <div class="tabs">
      {#if !isMac()}
        <div class="windows-menu-button">
          <Button onclick={window.api.showAppMenuPopup} square size="md">
            <Icon name="menu" size="1.1em" />
          </Button>
        </div>
      {/if}
      <TabsList />
      <!-- <Button onclick={handleClick}>Create Overlay</Button> -->

      <!-- <Overlay bounds={{ x: 200, y: 200, width: 400, height: 180 }}>
      <Test />
    </Overlay> -->
      {#if !isMac()}
        <AltWindowControls />
      {/if}
    </div>
  </div>

  <main>
    <div class="tab-view">
      {#if activeTabView}
        <NavigationBar
          bind:this={activeTabNavigationBar}
          view={activeTabView}
          onsearchinput={handleSearchInput}
          tab={tabsService.activeTab}
          roundLeftCorner
          roundRightCorner={!viewManager.sidebarViewOpen}
        />
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
    background: radial-gradient(
      453.65% 343.29% at 50.04% 0%,
      #deedff 0%,
      #abd6ff 69.23%,
      #c6ddff 93.37%
    );
    background: radial-gradient(
      453.65% 343.29% at 50.04% 0%,
      color(display-p3 0.8807 0.9291 0.9921) 0%,
      color(display-p3 0.7031 0.8325 0.9963) 69.23%,
      color(display-p3 0.7938 0.8654 0.9912) 93.37%
    );

    :global(body.os_mac) & {
      padding-left: 5rem;
    }
  }

  .tabs {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 5px;
    app-region: drag;
    gap: 10px;
  }

  main {
    height: 100%;
    display: flex;
    justify-content: end;
  }

  .tab-view {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-width: 0;
    width: 100%;
    flex-grow: 0;
    flex-shrink: 1;
  }
  .tab-contents {
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

  /// DRAG AND DROP
  :global(::view-transition-group(*)) {
    animation-duration: 170ms;
    animation-timing-function: ease;
  }

  :global(*[data-drag-preview]) {
    overflow: clip !important;
    position: fixed !important;
    top: 0 !important;
    left: 0 !important;

    pointer-events: none !important;
    user-select: none !important;

    width: var(--drag-width, auto);
    height: var(--drag-height, auto);
    opacity: 90%;
    box-shadow:
      0px 2px 3px 2px rgba(0, 0, 0, 0.045),
      0px 1px 4px 0px rgba(0, 0, 0, 0.145);

    transform-origin: center center !important;
    translate: var(--drag-offsetX, 0px) var(--drag-offsetY, 0px) 0px !important;
    transform: translate(-50%, -50%) scale(var(--drag-scale, 1)) rotate(var(--drag-tilt, 0)) !important;
    will-change: transform !important;

    transition:
      //translate 235ms cubic-bezier(0, 1.22, 0.73, 1.13),
     // translate 175ms cubic-bezier(0, 1, 0.73, 1.13),
      translate 235ms cubic-bezier(0, 1.22, 0.73, 1.13),
      transform 235ms cubic-bezier(0, 1.22, 0.73, 1.13),
      opacity 235ms cubic-bezier(0, 1.22, 0.73, 1.13),
      border 135ms cubic-bezier(0, 1.22, 0.73, 1.13),
      width 175ms cubic-bezier(0.4, 0, 0.2, 1),
      height 175ms cubic-bezier(0.4, 0, 0.2, 1) !important;

    // NOTE: Old ones kept for future tinkering
    /*transform-origin: center center;
    transform: translate(-50%, -50%) translate(var(--drag-offsetX, 0px), var(--drag-offsetY, 0px))
      scale(var(--drag-scale, 1)) scale(var(--drag-scaleX, 1), var(--drag-scaleY, 1))
      rotate(var(--drag-tilt, 0)) scale(var(--scale, 1)) !important;
    transition:
      transform 235ms cubic-bezier(0, 1.22, 0.73, 1.13),
      opacity 235ms cubic-bezier(0, 1.22, 0.73, 1.13),
      border 135ms cubic-bezier(0, 1.22, 0.73, 1.13) !important;*/
  }
  :global(body[data-dragging]:has([data-drag-target^='webview'])) {
    // NOTE: Only kinda works sometimes, still ahve to debug how/if we can reliably
    // have custom cursors during native dndn.
    //cursor: wait !important;
  }

  /* Necessary so that image & pdf view dont prevent dragging */
  :global(body[data-dragging] webview:not([data-drag-zone])) {
    pointer-events: none !important;
  }

  /* Necessary so that inputs dont go all janky wanky  */
  :global(body[data-dragging] input:not([data-drag-zone])) {
    pointer-events: none !important;
  }

  :global(.dragcula-drop-indicator) {
    --color: #3765ee;
    --dotColor: white;
    --inset: 3%;
    background: var(--color);
    transition:
      top 100ms cubic-bezier(0.2, 0, 0, 1),
      left 100ms cubic-bezier(0.2, 0, 0, 1);
  }
  :global(.dragcula-drop-indicator.dragcula-axis-vertical) {
    left: var(--inset);
    right: var(--inset);
    height: 2px;
    transform: translateY(-50%);
  }
  :global(.dragcula-drop-indicator.dragcula-axis-horizontal) {
    top: var(--inset);
    bottom: var(--inset);
    width: 2px;
    transform: translateX(-50%);
  }
  :global(.dragcula-drop-indicator.dragcula-axis-both) {
    left: 0;
    top: 0;
    width: 2px;
    height: 3rem;
    transform: translateY(-50%);
  }

  :global(.dragcula-drop-indicator.dragcula-axis-vertical::before) {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    transform: translate(-50%, calc(-50% + 1px));
    width: 7px;
    height: 7px;
    border-radius: 5px;
    background: var(--dotColor);
    border: 2px solid var(--color);
  }
  :global(.dragcula-drop-indicator.dragcula-axis-vertical::after) {
    content: '';
    position: absolute;
    top: 0;
    right: -6px;
    transform: translate(-50%, calc(-50% + 1px));
    width: 7px;
    height: 7px;
    border-radius: 5px;
    background: var(--dotColor);
    border: 2px solid var(--color);
  }
  :global(.dragcula-drop-indicator.dragcula-axis-horizontal::before) {
    content: '';
    position: absolute;
    bottom: 0;
    left: 0;
    transform: translate(calc(-50% + 1px), calc(-50% + 6px));
    width: 7px;
    height: 7px;
    border-radius: 50px;
    background: var(--dotColor);
    border: 2px solid var(--color);
  }
  :global(.dragcula-drop-indicator.dragcula-axis-horizontal::after) {
    content: '';
    position: absolute;
    top: -4px;
    left: 0;
    transform: translate(calc(-50% + 1px), calc(-50% + 6px));
    width: 7px;
    height: 7px;
    border-radius: 50px;
    background: var(--dotColor);
    border: 2px solid var(--color);
  }
  :global(.dragcula-drop-indicator.dragcula-axis-both::before) {
    content: '';
    position: absolute;
    bottom: 0;
    left: 0;
    transform: translate(calc(-50% + 1px), calc(-50% + 6px));
    width: 7px;
    height: 7px;
    border-radius: 50px;
    background: var(--dotColor);
    border: 2px solid var(--color);
  }
  :global(.dragcula-drop-indicator.dragcula-axis-both::after) {
    content: '';
    position: absolute;
    top: -4px;
    left: 0;
    transform: translate(calc(-50% + 1px), calc(-50% + 6px));
    width: 7px;
    height: 7px;
    border-radius: 50px;
    background: var(--dotColor);
    border: 2px solid var(--color);
  }

  :global([data-drag-zone][axis='vertical']) {
    // This is needed to prevent margin collapse when the first child has margin-top. Without this, it will move the container element instead.
    padding-top: 1px;
    margin-top: -1px;
  }

  .windows-menu-button {
    app-region: no-drag;
  }
</style>
