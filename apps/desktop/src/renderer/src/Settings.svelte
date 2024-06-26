<script lang="ts">
  import { onMount } from 'svelte'
  import { writable } from 'svelte/store'
  import { Icon } from '@horizon/icons'

  import appIcon from './assets/icon.png'
  import inlineAIScreenshot from './assets/inline-ai.png'
  import pageInsightsScreenshot from './assets/page-insights.png'
  import customPromptsScreenshot from './assets/custom-prompts.png'
  import promptFallback from './assets/prompt-fallback.png'

  import PromptSection from './components/PromptSection.svelte'
  import Prompt from './components/Prompt.svelte'
  import { useDebounce } from '@horizon/core/src/lib/utils/debounce'
  import type { EditablePrompt } from '@horizon/types'

  // let error = ''
  // let loading = false

  let version = ''

  const activeTab = writable<'general' | 'prompts'>('general')

  let prompts: EditablePrompt[] = []

  $: console.log('prompts', prompts)

  const debouncedPromptUpdate = useDebounce((id: string, content: string) => {
    console.log('prompt update', id, content)

    // @ts-ignore
    window.api.updatePrompt(id, content)
  }, 500)

  const getAppInfo = async () => {
    // @ts-ignore
    const info = await window.api.getAppInfo()

    console.log(info)
    version = info.version
  }

  const checkForUpdates = async () => {
    // @ts-ignore
    await window.api.checkForUpdates()
  }

  // const handleStart = () => {
  //   // @ts-expect-error
  //   window.api.restartApp()
  // }

  onMount(async () => {
    getAppInfo()

    // @ts-ignore
    window.api.onSetPrompts((data) => {
      console.log('set prompts', data)
      prompts = data
    })

    // @ts-ignore
    window.api.getPrompts()
  })
</script>

<!-- svelte-ignore a11y-click-events-have-key-events -->
<main>
  <div class="tabs drag">
    <div
      on:click={() => activeTab.set('general')}
      role="tab"
      tabindex="0"
      class="tab no-drag"
      class:active={$activeTab === 'general'}
    >
      <Icon name="settings" size="24" />
      <h1>General</h1>
    </div>

    <div
      on:click={() => activeTab.set('prompts')}
      role="tab"
      tabindex="0"
      class="tab no-drag"
      class:active={$activeTab === 'prompts'}
    >
      <Icon name="file-text-ai" size="24" />
      <h1>Prompts</h1>
    </div>
  </div>

  <div class="content-wrapper">
    {#if $activeTab === 'general'}
      <article class="general">
        <img src={appIcon} alt="App Icon" />
        <h1>Farc v{version}</h1>

        <button on:click={checkForUpdates}>Check for Updates</button>
      </article>
    {:else if $activeTab === 'prompts'}
      <article class="prompts">
        <div class="prompts-list">
          <!-- <PromptSection
            title="General"
            description="Customize prompts for general features like summarizing."
            image={promptFallback}
          >
            coming soon…
          </PromptSection> -->

          <PromptSection
            title="Inline Page Menu"
            description="Customize prompts used for the inline AI menu in web pages."
            image={inlineAIScreenshot}
          >
            {#each prompts.filter((x) => x.kind === 'inline') as prompt}
              <Prompt
                title={prompt.title}
                description={prompt.description}
                content={prompt.content}
                on:update={(e) => debouncedPromptUpdate(prompt.id, e.detail)}
              />
            {/each}
          </PromptSection>

          <PromptSection
            title="Page Insights"
            description="Customize prompts used for the page chat feature."
            image={pageInsightsScreenshot}
          >
            {#each prompts.filter((x) => x.kind === 'page') as prompt}
              <Prompt
                title={prompt.title}
                description={prompt.description}
                content={prompt.content}
                on:update={(e) => debouncedPromptUpdate(prompt.id, e.detail)}
              />
            {/each}
          </PromptSection>

          <PromptSection
            title="Custom Prompts"
            description="Define your own prompts to use across the app."
            image={customPromptsScreenshot}
          >
            coming soon…
          </PromptSection>
        </div>

        <div class="box">
          <Icon name="info" size="22px" />
          <p>Prompts can be written with basic Markdown syntax.</p>
        </div>
      </article>
    {/if}
  </div>
</main>

<style lang="scss">
  :global(:root) {
    --color-text: #0c081a;
    --color-text-muted: #262332a2;
    --color-text-light: #ffffff;
    // --color-brand: #F73B95;
    // --color-brand-dark: #e6348a;
    --color-brand: #ff4eed;
    --color-brand-dark: #ff4eed;
    --color-brand-light: #ffa7f6;
    --color-link: #007bff;
    --color-link-dark: #0056b3;
    --color-background: #f8f8f8;
    --color-background-dark: #f0f0f0;
    --color-background-light: #ffffff;
    --color-border: #e0e0e0;
  }

  :global(*) {
    box-sizing: border-box;
  }

  main {
    height: 100vh;
    width: 100vw;
    color: var(--color-text);
    background: var(--color-background-light);
    display: flex;
    flex-direction: column;
  }

  .drag {
    -webkit-app-region: drag;
  }

  .no-drag {
    -webkit-app-region: no-drag;
  }

  a {
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

  .tabs {
    display: flex;
    gap: 1rem;
    justify-content: center;
    align-items: center;
    flex-wrap: wrap;
    padding: 1rem;
    background: var(--color-background);
    border-bottom: 1px solid var(--color-border);
  }

  .tab {
    display: flex;
    gap: 0.5rem;
    align-items: center;
    padding: 0.5rem 1rem;
    border-radius: 0.5rem;
    color: var(--color-text-muted);
    cursor: pointer;
    transition: all 0.1s ease-in-out;

    &.active {
      background: var(--color-background-dark);
      color: var(--color-text);
    }

    &:hover {
      background: var(--color-background);
      color: var(--color-text);
    }

    h1 {
      font-size: 1.2rem;
      font-weight: 400;
    }
  }

  .content-wrapper {
    flex: 1;
    overflow: auto;
    padding: 1rem;
    height: 100%;
    width: 100%;
  }

  .general {
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 1rem;

    img {
      border-radius: 50%;
    }

    h1 {
      font-size: 2rem;
      font-weight: 700;
    }

    button {
      padding: 0.75rem 1rem;
      border: none;
      outline: none;
      border-radius: 0.5rem;
      background: none;
      color: var(--color-link);
      cursor: pointer;
      transition: color 0.2s;
      font-size: 1.1rem;

      &:hover {
        color: var(--color-link-dark);
      }
    }
  }

  .box {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 1rem;
    border-radius: 0.5rem;
    color: var(--color-text);
    text-align: center;

    p {
      font-size: 1.1rem;
      color: var(--color-text-muted);
    }
  }

  .prompts {
    display: flex;
    flex-direction: column;
    gap: 2rem;
    padding-top: 2rem;
  }

  .prompts-list {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }
</style>
