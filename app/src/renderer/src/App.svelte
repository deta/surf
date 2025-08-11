<script lang="ts">
  import { TeletypeProvider, Teletype, type Action } from '@deta/teletype/src'
  import { DynamicIcon } from '@horizon/icons'

  // import { Browser } from '@horizon/core'
  // import '../../app.css'
  // import './assets/fonts/Bayshore.woff2'
  // import './assets/fonts/Bayshore.woff'
  // import './assets/fonts/Gambarino-Regular.woff'
  // import './assets/fonts/Gambarino-Regular.woff2'
  // import './assets/fonts/SNPro-Variable.ttf'
  // import './assets/fonts/SNPro-Variable.woff2'
  // import './assets/fonts/SNPro-Variable.woff'
  import '../../output.css'
  // import '../../../../../packages/core/src/output.css'
  // import { isMac, isWindows } from '@horizon/utils'

  let count = $state(0)

  function onclick() {
    count += 1
  }

  const actions = [
    {
      id: 'action1',
      name: 'Action 1',
      icon: 'save',
      handler: () => {
        console.log('Action 1 clicked')
      }
    },
    {
      id: 'action2',
      name: 'Action 2',
      icon: 'reload',
      handler: () => {
        console.log('Action 2 clicked')
      }
    }
  ] satisfies Action[]
</script>

<div class="main">
  <!-- <Browser /> -->

  <div class="content">
    <h1>Surf Greenfield</h1>

    <p>Svelte 5, Vite 7, electron-vite 4, Electron 37</p>
    <button {onclick}>Clicks {count}</button>
  </div>
  ^
  <TeletypeProvider
    {actions}
    class="teletype-provider"
    options={{
      iconComponent: DynamicIcon,
      placeholder: 'Search the web, enter URL or ask a question...'
    }}
  >
    <Teletype />
  </TeletypeProvider>
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

    --border-radius: 18px;
  }
</style>
