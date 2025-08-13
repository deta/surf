<script lang="ts">
  import { onMount, onDestroy } from 'svelte'

  import { Button, Link } from '@deta/ui'
  import { useLogScope } from '@deta/utils'
  import {
    provideConfig,
    useViewManager,
    createKeyboardManager,
    createShortcutManager,
    defaultShortcuts,
    ShortcutActions,
    ShortcutPriority
  } from '@deta/services'
  import type { Fn } from '@deta/types'

  import TeletypeEntry from './components/Teletype/TeletypeEntry.svelte'
  import WebContentsView from './components/WebContentsView.svelte'

  const log = useLogScope('Core')
  const config = provideConfig()
  const viewManager = useViewManager()

  const keyboardManager = createKeyboardManager()
  const shortcutsManager = createShortcutManager<ShortcutActions>(keyboardManager, defaultShortcuts)

  let count = $state(0)
  let open = $state(false)

  function onclick() {
    count += 1
  }

  let unsubs: Fn[] = []

  const actions = [
    {
      id: 'action1',
      name: 'Action 1',
      icon: 'save',
      handler: () => {
        log.debug('Action 1 clicked')
      }
    },
    {
      id: 'action2',
      name: 'Action 2',
      icon: 'reload',
      handler: () => {
        log.debug('Action 2 clicked')
      }
    }
  ] satisfies Action[]

  const testView = viewManager.create({
    url: 'https://en.wikipedia.org'
  })

  onMount(() => {
    log.debug('Core component mounted')

    const settings = config.settingsValue

    log.debug('User settings:', settings)

    // @ts-ignore
    window.testView = testView

    shortcutsManager.registerHandler(ShortcutActions.NEW_TAB, () => {
      log.debug('Opening Teletype')
      open = !open

      // shortcutsManager.setCustomShortcut(ShortcutActions.NEW_TAB, open ? 'Escape' : 'Meta+T')

      return true
    })

    shortcutsManager.registerHandler(ShortcutActions.CLOSE_TAB, () => {
      log.debug('Closing Tab')

      testView.destroy()

      return true
    })

    unsubs.push(
      testView.on('mounted', (webContentsView) => {
        unsubs.push(
          webContentsView.on('keydown', (event) => {
            keyboardManager.handleKeyDown(event)
          })
        )
      })
    )
  })

  onDestroy(() => {
    viewManager.onDestroy()
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

  <div class="web-contents">
    <WebContentsView view={testView} />
  </div>

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

  .web-contents {
    height: 100%;
    width: 100%;
    position: relative;
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
