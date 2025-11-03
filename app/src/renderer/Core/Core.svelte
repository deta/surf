<script lang="ts">
  import { onMount, onDestroy } from 'svelte'
  import { derived } from 'svelte/store'

  import { useLogScope, setLogLevel } from '@deta/utils/io'
  import { ViewLocation, ViewType, type Fn } from '@deta/types'

  import { ShortcutActions } from '@deta/services/shortcuts'
  import { initServices } from '@deta/services/helpers'
  import { handlePreloadEvents } from './handlers/preloadEvents'

  import WebContentsView from './components/WebContentsView.svelte'
  import TabsListWrapper from './components/Tabs/TabsListWrapper.svelte'
  import {
    tabOrientation,
    toggleTabOrientation,
    TabOrientation,
    initializeTabOrientation
  } from '@deta/services/tabs'
  import NavigationBar from './components/NavigationBar/NavigationBar.svelte'
  import NavigationBarGroup from './components/NavigationBar/NavigationBarGroup.svelte'
  import AppSidebar from './components/Layout/AppSidebar.svelte'
  import { isLinux, isMac, isWindows, ResourceTag, useDebounce, wait } from '@deta/utils'
  import { Button, prepareContextMenu } from '@deta/ui'
  import { debugMode } from './stores/debug'
  import AltWindowControls from './components/AltWindowControls.svelte'
  import { Icon } from '@deta/icons'
  import { checkAndCreateDemoItems } from '@deta/services'

  const log = useLogScope('Core')

  const {
    config,
    viewManager,
    tabsService,
    keyboardManager,
    shortcutsManager,
    browser,
    resourceManager,
    ai
  } = initServices()

  const customBackgroundStyle = derived(config.settings, ($settings) => {
    const image = (($settings as any)?.background_image_url ?? '').trim()
    return image
      ? `background: url("${image}") center / cover no-repeat !important; backdrop-filter: blur(100px);`
      : ''
  })

  const activeTabView = $derived(tabsService.activeTab?.view)

  let unsubs: Fn[] = []
  let activeTabNavigationBar: NavigationBar | undefined

  // TODO: move into searchinput directly?
  const handleSearchInput = useDebounce((value: string) => {
    tabsService.activeTab?.view?.webContents.updatePageQuery(value)
  }, 100)

  // Listen for settings changes and apply color scheme
  onMount(() => {
    const unsubscribe = config.settings.subscribe((settings) => {
      const appStyle = settings?.app_style || 'light'
      document.documentElement.dataset.colorScheme = appStyle
      document.documentElement.style.colorScheme = appStyle
    })
    return unsubscribe
  })

  onMount(() => {
    let unsub
    wait(500).then(() => (unsub = prepareContextMenu(true)))
    return () => unsub?.()
  })
  onDestroy(
    debugMode.subscribe((v) => {
      window.LOG_DEBUG = v
    })
  )
  onMount(async () => {
    log.debug('Core component mounted')
    // Initialize tab orientation from saved config
    initializeTabOrientation()

    if (isWindows()) document.body.classList.add('os_windows')
    if (isMac()) document.body.classList.add('os_mac')
    if (isLinux()) document.body.classList.add('os_linux')

    const settings = config.settingsValue
    log.debug('User settings:', settings)

    await tabsService.ready

    // @ts-ignore
    window.setLogLevel = (level: LogLevel) => {
      setLogLevel(level)

      return level
    }

    shortcutsManager.registerHandler(ShortcutActions.TOGGLE_DEBUG_MODE, () => {
      debugMode.update((mode) => !mode)

      if ($debugMode) {
        log.info('Setting log to warn')
        setLogLevel('warn')
      } else {
        setLogLevel('verbose')
        log.info('Setting log to verbose')
      }

      return true
    })

    shortcutsManager.registerHandler(ShortcutActions.NEW_TAB, () => {
      log.debug('Creating new tab (CMD+T)')

      if (
        viewManager.sidebarViewOpen &&
        [ViewType.NotebookHome, ViewType.Notebook].includes(
          viewManager.activeSidebarView?.typeValue
        )
      )
        viewManager.setSidebarState({ open: false })

      tabsService.openNewTabPage()

      return true
    })

    shortcutsManager.registerHandler(ShortcutActions.CLOSE_TAB, () => {
      log.debug('Closing current tab (CMD+W)')

      const activeTab = tabsService.activeTab
      if (!activeTab) {
        log.error('No active tab')
        return true
      }

      tabsService.closeTab(activeTab.id, true)
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

    //shortcutsManager.registerHandler(ShortcutActions.SWITCH_TO_LAST_TAB, () => {
    //  const tabs = tabsService.tabs
    //  if (tabs.length > 0) {
    //    const lastTab = tabs.at(-1)
    //    log.debug(`Switching to last tab (${lastTab.id})`)
    //    tabsService.setActiveTab(lastTab.id, true)
    //  }
    //  return true
    //})

    shortcutsManager.registerHandler(ShortcutActions.TOGGLE_SIDEBAR, () => {
      if (
        [ViewType.NotebookHome, ViewType.Notebook].includes(tabsService.activeTab?.view?.typeValue)
      ) {
        tabsService.delete(tabsService.activeTabIdValue)
      }
      viewManager.setSidebarState({ open: !viewManager.sidebarViewOpen })
      return true
    })

    shortcutsManager.registerHandler(ShortcutActions.TOGGLE_TAB_ORIENTATION, () => {
      log.debug('Toggling tab orientation (CMD+O)')
      toggleTabOrientation().catch((error) => {
        log.error('Failed to toggle tab orientation:', error)
      })
      return true
    })

    shortcutsManager.registerHandler(ShortcutActions.INCREASE_PAGE_ZOOM, async () => {
      log.debug('Increasing page zoom')

      const webContents = tabsService.activeTab.view?.webContents
      if (!webContents) return true
      const currZoom = (await webContents.getZoomFactor()) || 1.0
      webContents.setZoomFactor(currZoom + 0.1)
      return true
    })

    shortcutsManager.registerHandler(ShortcutActions.DECREASE_PAGE_ZOOM, async () => {
      log.debug('Decreasing page zoom')

      const webContents = tabsService.activeTab.view?.webContents
      if (!webContents) return true
      const currZoom = (await webContents.getZoomFactor()) || 1.0
      webContents.setZoomFactor(currZoom - 0.1)
      return true
    })

    shortcutsManager.registerHandler(ShortcutActions.RESET_PAGE_ZOOM, async () => {
      log.debug('Reset page zoom')

      const webContents = tabsService.activeTab.view?.webContents
      if (!webContents) return true
      webContents.setZoomFactor(1.0)
      return true
    })

    unsubs.push(handlePreloadEvents())

    await checkAndCreateDemoItems()
    // cleanup temporary resources created for chat
    await resourceManager.deleteResourcesByTags([ResourceTag.createdForChat(true)])

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
    ai.onDestroy()
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

<div
  class="main"
  class:vertical-layout={$tabOrientation === TabOrientation.Vertical}
  style={$customBackgroundStyle}
>
  {#if $tabOrientation === TabOrientation.Horizontal || !isMac()}
    <div class="app-bar" class:vertical-layout={$tabOrientation === TabOrientation.Vertical}>
      <div class="tabs">
        {#if !isMac()}
          <div class="windows-menu-button">
            <Button onclick={window.api.showAppMenuPopup} square size="md">
              <Icon name="menu" size="1.1em" />
            </Button>
          </div>
        {/if}
        {#if $tabOrientation === TabOrientation.Horizontal}
          <TabsListWrapper orientation={$tabOrientation} />
        {/if}

        {#if !isMac()}
          <AltWindowControls />
        {/if}
      </div>
    </div>
  {/if}

  <main class:vertical-layout={$tabOrientation === TabOrientation.Vertical}>
    {#if $tabOrientation === TabOrientation.Vertical}
      <div class="vertical-tabs-container">
        <TabsListWrapper orientation={$tabOrientation} />
      </div>{/if}

    <div class="tab-view">
      {#if activeTabView}
        <NavigationBar
          bind:this={activeTabNavigationBar}
          view={activeTabView}
          onsearchinput={handleSearchInput}
          tab={tabsService.activeTab}
        />
      {/if}
      <div class="tab-contents">
        {#each tabsService.tabs as tab, idx (tab.id)}
          {#if tabsService.activatedTabs.includes(tab.id)}
            <WebContentsView
              view={tabsService.tabs[idx].view}
              active={tabsService.activeTab?.id === tab.id}
              location={ViewLocation.Tab}
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
    background: radial-gradient(
      300% 7% at 50.04% 0%,
      light-dark(#deedfe, #1a2438) 0%,
      light-dark(#b3d4fe, #0f141f) 69.23%,
      light-dark(#c9dcfd, #0f141f) 93.37%
    );
    background: radial-gradient(
      300% 7% at 50.04% 0%,
      light-dark(color(display-p3 0.8807 0.9291 0.9921), color(display-p3 0.102 0.1412 0.2196)) 0%,
      light-dark(color(display-p3 0.7031 0.8325 0.9963), color(display-p3 0.06 0.08 0.12)) 69.23%,
      light-dark(color(display-p3 0.7938 0.8654 0.9912), color(display-p3 0.06 0.08 0.12)) 93.37%
    );
    display: flex;
    flex-direction: column;

    &.vertical-layout {
      flex-direction: column;
      background: radial-gradient(
        50% 300% at 0% 50%,
        light-dark(#deedfe, #1a2438) 0%,
        light-dark(#b3d4fe, #0f141f) 69.23%,
        light-dark(#c9dcfd, #0f141f) 93.37%
      );
      background: radial-gradient(
        50% 300% at 0% 50%,
        light-dark(color(display-p3 0.8807 0.9291 0.9921), color(display-p3 0.102 0.1412 0.2196)) 0%,
        light-dark(color(display-p3 0.7031 0.8325 0.9963), color(display-p3 0.06 0.08 0.12)) 69.23%,
        light-dark(color(display-p3 0.7938 0.8654 0.9912), color(display-p3 0.06 0.08 0.12)) 93.37%
      );
    }
  }

  .app-bar {
    :global(body.os_mac) & {
      padding-left: 5rem;
    }

    &.vertical-layout {
      //height: 40px;
      min-height: 32px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 8px;
      app-region: drag;

      :global(body.os_mac) & {
        padding-left: 5rem;
      }
    }
  }

  .tabs {
    width: 100%;
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

    &.vertical-layout {
      flex: 1;
      display: flex;
      height: calc(100% - 32px);
      justify-content: unset;
      overflow: hidden;
    }
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

  /* Visual indicators for fine-grained drop positions */
  // :global(.dragcula-drop-indicator[data-drop-position='before']) {
  //   --color: #00ff00; /* Green for "before" */
  // }

  // :global(.dragcula-drop-indicator[data-drop-position='after']) {
  //   --color: #ff0000; /* Red for "after" */
  // }

  // :global(.dragcula-drop-indicator[data-drop-position='on']) {
  //   --color: #ffaa00; /* Orange for "on" */
  // }
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
    //margin-top: -1px;
  }

  .windows-menu-button {
    app-region: no-drag;
  }

  .vertical-app-bar {
    height: 40px;
    min-height: 32px;
    background: light-dark(var(--app-background), var(--app-background-dark));
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 8px;
    app-region: drag;

    :global(body.os_mac) & {
      padding-left: 5rem;
    }

    .windows-menu-button {
      app-region: no-drag;
    }

    .mac-traffic-lights-spacer {
      width: 5rem;
      height: 100%;
    }
  }

  .vertical-main {
    flex: 1;
    display: flex;
    height: calc(100% - 32px);
    overflow: hidden;
  }

  .vertical-tabs-container {
    flex-shrink: 0;
    height: 100%;
  }
</style>
