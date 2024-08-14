<script lang="ts">
  import icon from './assets/icon_512.png'

  import type { AppActivationResponse } from '@horizon/api'
  import LayoutPicker from './components/LayoutPicker.svelte'

  const REQUEST_INVITE_URL = 'https://deta.surf'
  const TERMS_URL = 'https://deta.surf/terms'
  const PRIVACY_URL = 'https://deta.surf/privacy'

  let view: 'invite' | 'disclaimer' | 'ai_features' | 'language' | 'prefs' | 'done' = 'invite'

  let inviteCode = ''
  let embeddingModel = 'english_small'
  let tabsOrientation: 'horizontal' | 'vertical' = 'horizontal'
  let acceptedTerms = false
  let loading = false
  let error = ''

  const languageConfig = {
    english_small: 'English',
    english_large: 'English XL',
    multilingual_small: 'Polyglot',
    multilingual_large: 'Polyglot XL'
  }

  const handleSubmit = async () => {
    try {
      loading = true

      // @ts-ignore
      const data = (await window.api.activateAppUsingKey(
        inviteCode,
        acceptedTerms
      )) as Promise<AppActivationResponse | null>
      if (!data) {
        error = 'Invalid invite code.'
        return
      }

      view = 'disclaimer'
    } catch (e) {
      console.error(e)
      error = 'Failed to check invite code, please try again.'
    } finally {
      loading = false
    }
  }

  const handleAcceptPrefs = async () => {
    try {
      // @ts-ignore
      await window.api.saveUserConfigSettings({
        embedding_model: embeddingModel,
        tabs_orientation: tabsOrientation
      })
      view = 'done'
    } catch (e) {
      console.error(e)
      error =
        'Sorry: failed to save your preference. Please try again or contact us if problem persists.'
    }
    view = 'done'
  }

  const handleLanguageSubmit = async () => {
    try {
      // @ts-ignore
      await window.api.saveUserConfigSettings({
        embedding_model: embeddingModel,
        tabs_orientation: tabsOrientation
      })
      view = 'prefs'
    } catch (e) {
      console.error(e)
      error =
        'Sorry: failed to save your preference. Please try again or contact us if problem persists.'
    }
  }

  const handleAcceptDisclaimer = (currView) => () => {
    if (currView === 'disclaimer') {
      view = 'ai_features'
    } else {
      view = 'language'
    }
  }

  const handleStart = () => {
    // @ts-expect-error
    window.api.restartApp()
  }
</script>

<main>
  <div class="wrapper" class:wide={view === 'disclaimer'}>
    {#if view === 'invite'}
      <img src={icon} alt="Surf icon" />

      <h1>Welcome to Surf!</h1>
      <form on:submit|preventDefault={handleSubmit}>
        <div class="welcome-text-wrap">
          <p class="info text-md">
            Surf is under active development — you need to be part of our early access program to
            use it.
          </p>

          <div class="details" style="margin-top: 2rem;">
            <p class="info text-md">
              Enter your <b>invite code</b> to get started:
            </p>
            <input bind:value={inviteCode} class="input" placeholder="your code" required />
          </div>

          <div class="terms-privacy-wrap">
            <label class="check">
              <input bind:checked={acceptedTerms} type="checkbox" required />
              <span>
                I agree to the <a href={TERMS_URL} target="_blank">Terms and Conditions</a> and
                <a href={PRIVACY_URL} target="_blank">Privacy Policy</a>.
              </span>
            </label>
          </div>
        </div>

        <div class="submit">
          {#if error}
            <p class="error">{error}</p>
          {/if}
          <div class="actions">
            {#if loading}
              <button type="submit" disabled>Checking Invite…</button>
            {:else}
              <button type="submit">Get Started</button>
            {/if}
            <p class="apply">
              No invite code? <a href={REQUEST_INVITE_URL} target="_blank">Apply here</a>.
            </p>
          </div>
        </div>
      </form>
    {:else if view === 'disclaimer'}
      <img src={icon} alt="Surf icon" />

      <h1>Telemetry, to improve Surf.</h1>

      <div class="details">
        <p class="info text-md">
          As part of the early access program, we track some of your usage of Surf. We do this to
          make Surf better.
        </p>
      </div>

      <div class="tracking">
        <div class="box">
          <div class="icon-heading">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              ><path stroke="none" d="M0 0h24v24H0z" fill="none" /><path
                d="M10 12a2 2 0 1 0 4 0a2 2 0 0 0 -4 0"
              /><path
                d="M21 12c-2.4 4 -5.4 6 -9 6c-3.6 0 -6.6 -2 -9 -6c2.4 -4 5.4 -6 9 -6c3.6 0 6.6 2 9 6"
              /></svg
            >
            <h2>What shows up</h2>
          </div>
          <p>
            We track your interactions with app features and the types of data you store. For
            example: activating a tab, opening the sidebar, or saving an image.
          </p>
        </div>

        <div class="box">
          <div class="icon-heading">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              ><path stroke="none" d="M0 0h24v24H0z" fill="none" /><path
                d="M10.585 10.587a2 2 0 0 0 2.829 2.828"
              /><path
                d="M16.681 16.673a8.717 8.717 0 0 1 -4.681 1.327c-3.6 0 -6.6 -2 -9 -6c1.272 -2.12 2.712 -3.678 4.32 -4.674m2.86 -1.146a9.055 9.055 0 0 1 1.82 -.18c3.6 0 6.6 2 9 6c-.666 1.11 -1.379 2.067 -2.138 2.87"
              /><path d="M3 3l18 18" /></svg
            >
            <h2>What does not</h2>
          </div>
          <p>
            The urls you visit and the contents of the data you store are in Surf are <i
              ><b>not</b></i
            > part of our Telemetry.
          </p>
        </div>
        <div class="actions">
          <button on:click={handleAcceptDisclaimer('disclaimer')}>I understand</button>

          <!-- <button on:click={handleClose} class="close">Close App Instead</button> -->
        </div>
      </div>
    {:else if view === 'ai_features'}
      <img src={icon} alt="Surf icon" />
      <h1>Smart Surfing</h1>
      <div class="box">
        <div class="icon-heading">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            ><path stroke="none" d="M0 0h24v24H0z" fill="none" /><path
              d="M16 18a2 2 0 0 1 2 2a2 2 0 0 1 2 -2a2 2 0 0 1 -2 -2a2 2 0 0 1 -2 2zm0 -12a2 2 0 0 1 2 2a2 2 0 0 1 2 -2a2 2 0 0 1 -2 -2a2 2 0 0 1 -2 2zm-7 12a6 6 0 0 1 6 -6a6 6 0 0 1 -6 -6a6 6 0 0 1 -6 6a6 6 0 0 1 6 6z"
            /></svg
          >
          <h2>AI Features</h2>
        </div>

        <div class="details text-md">
          <p>Surf offers AI features, which sends certain data to our servers and / or OpenAI:</p>
          <ul>
            <li>If you <b>save an image</b>, our servers tag them, to make them searchable.</li>
            <li>
              If you <b>chat</b> with a website or a Space, content from the website or Space is sent
              to OpenAI through Deta's servers.
            </li>
            <li>
              <b>Live Spaces</b> collect content from websites for you. If you create a Live Space, some
              of this content is sent to OpenAI through Deta's servers (to create summaries).
            </li>
          </ul>
          <p>
            Read our <a href={PRIVACY_URL} target="_blank">Privacy Policy</a> for more info.
          </p>
        </div>
      </div>
      <div class="actions">
        <button on:click={handleAcceptDisclaimer('ai_features')}>I understand</button>

        <!-- <button on:click={handleClose} class="close">Close App Instead</button> -->
      </div>
    {:else if view === 'language'}
      <img src={icon} alt="Surf icon" />
      <h1>Language</h1>
      <div class="settings-option">
        <br />
        <form class="radio-form" on:submit|preventDefault={handleLanguageSubmit}>
          <div class="details">
            <p class="info text-md">
              Some of Surf's AI features are language dependent. For example, you can chat with
              YouTube videos in Surf. Choose a language configuration that suits your needs.
            </p>
            <p class="info text-md">
              <strong>English</strong> will give you the best experience for English content, but
              Surf's AI features will not work with content in other languages. If you interact with
              content in another language on a daily basis, select a <strong>Polyglot</strong> option.
            </p>
            <p class="info text-md">
              <strong>XL</strong> options understand language better, but are slower and use more of
              your computer's storage.
            </p>
          </div>

          <div class="settings-ai-models">
            <div class="radio-wrapper">
              <input
                type="radio"
                id="english_small"
                value="english_small"
                checked
                bind:group={embeddingModel}
              />
              <label for="english_small"> <span>English</span></label>
            </div>
            <div class="radio-wrapper">
              <input
                type="radio"
                id="multilingual_small"
                value="multilingual_small"
                bind:group={embeddingModel}
              />
              <label for="multilingual_small"><span>Polyglot</span></label>
            </div>
            <div class="radio-wrapper">
              <input
                type="radio"
                id="english_large"
                value="english_large"
                bind:group={embeddingModel}
              />
              <label for="english_large">
                <span>English XL</span>
              </label>
            </div>
            <div class="radio-wrapper">
              <input
                type="radio"
                id="multilingual_large"
                value="multilingual_large"
                bind:group={embeddingModel}
              />
              <label for="multilingual_large">
                <span>Polyglot XL</span>
              </label>
            </div>
          </div>
          <div class="details">
            <p class="info text-md">You will not be able to change this for now.</p>
          </div>
          <div class="Submit radio-submit">
            <button type="submit">Surf with {languageConfig[embeddingModel]}</button>
          </div>
        </form>
      </div>
    {:else if view === 'prefs'}
      <img src={icon} alt="Surf icon" />
      <h1>Surf Layout</h1>

      <LayoutPicker bind:orientation={tabsOrientation} />

      <p>
        You can change this behavior later at <br /> <span class="pill">View</span> →
        <span class="pill">Toggle Tabs Orientation</span>
      </p>
      <button on:click={handleAcceptPrefs}>Surf {tabsOrientation}</button>
    {:else if view === 'done'}
      <img src={icon} alt="Surf icon" />

      <h1>Thank you.</h1>

      <p class="text-lg">You're all set to start using Surf 🎉</p>

      <div class="box contact">
        <p>
          If you have any questions or feedback, please email us at <a href="mailto:team@deta.space"
            >team@deta.space</a
          >
          or join our <a href="https://deta.surf/discord" target="_blank">Discord server</a> to chat
          with the team and the other amazing early adopters.
        </p>
      </div>

      <button on:click={handleStart}>Go Surfing</button>
    {/if}
  </div>
</main>

<style lang="scss">
  * {
    box-sizing: border-box;
  }

  :root {
    --color-text: #0c081a;
    --color-text-muted: #110f18a2;
    // --color-brand: #F73B95;
    // --color-brand-dark: #e6348a;
    --color-brand: #1d8aff;
    --color-brand-dark: #006cdf;
    --color-link: #1d8aff;
    --color-link-dark: #006cdf;
    --color-background: #f6faff;
    --color-background-dark: #e2eeff;
  }

  p,
  span {
    font-family: 'Helvetica Neue', Arial, sans-serif;
    font-size: 1rem;
    line-height: 1.6;
    color: var(--color-text);
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    margin: 0;
    padding: 0;
    letter-spacing: 0.01em;
  }

  p {
    margin-top: 0.375rem;
    margin-bottom: 0.375rem;
  }

  .details ul {
    font-size: 0.9rem;
    line-height: 1.6;
    color: var(--color-text);
    font-weight: normal;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    margin-left: 0;
    padding-left: 1rem;
  }

  span {
    display: inline-block;
  }

  p {
    span.pill {
      background: #eff5ff;
      padding: 0 0.25rem;
      border-radius: 4px;
      box-shadow: 0px 1px 0 var(--color-background-dark);
    }
  }

  main {
    height: 100vh;
    width: 100vw;
    display: flex;
    justify-content: center;
    align-items: center;
    color: var(--color-text);
    background: var(--color-background);
    background-position: center 0;
    background-size: cover;
  }

  .wrapper {
    width: 100%;
    max-width: 425px;
    padding: 1rem;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1.75rem;
    text-align: center;
    font-size: 1.075rem;

    &.wide {
      max-width: 445px;
      text-align: center;
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

    .details {
      font-size: 1rem;
      display: flex;
      flex-direction: column;
      text-align: left;
      gap: 0.75rem;
      width: 100%;
    }

    form {
      display: flex;
      flex-direction: column;
      gap: 2rem;
      width: 100%;
    }

    .apply {
      color: var(--color-text-muted);
      font-size: 0.9rem;
      margin-top: 0.25rem;
    }

    .input {
      width: 100%;
      padding: 0.75rem 0.5rem;
      border: 1px solid #ccc;
      border-radius: 8px;
      font-size: 1.1rem;

      &:focus {
        outline: none;
        border-color: var(--color-brand);
      }
    }

    .check {
      display: flex;
      justify-content: center;
      align-items: center;
      gap: 0.5rem;
    }

    button {
      padding: 0.75rem 0.5rem;
      background: var(--color-brand);
      color: white;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      font-size: 1.1rem;
      width: 100%;
      transition: background 0.2s;

      &:hover {
        background: var(--color-brand-dark);
      }

      &:disabled {
        background: #ccc;
        cursor: not-allowed;
      }

      &:active {
        transform: scale(0.98);
      }
    }

    .submit {
      display: flex;
      align-items: center;
      flex-direction: column;
      gap: 0.75rem;
      width: 100%;
    }

    .icon-heading {
      display: flex;
      align-items: center;
      gap: 0.5rem;

      h2 {
        font-size: 1.25rem;
        font-weight: 500;
      }
    }

    .welcome-text-wrap {
      display: flex;
      flex-direction: column;
      text-align: left;
    }

    .terms-privacy-wrap {
      display: flex;
      margin-top: 3rem;
      padding-left: 0.25rem;
    }

    .box {
      width: 100%;
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
      padding: 1rem;
      background: var(--color-background-dark);
      border-radius: 8px;
      text-align: center;
      font-size: 1rem;
    }

    .tracking {
      width: 100%;
      display: flex;
      flex-direction: column;
      gap: 1rem;

      .box {
        text-align: left;
      }

      ul {
        padding-left: 1rem;
        font-size: 1.075rem;
        line-height: 1.5rem;
      }
    }

    .contact {
      text-align: left;
    }

    .actions {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.5rem;
      width: 100%;
    }

    .text-sm {
      font-size: 0.9rem;
    }

    .text-md {
      font-size: 1.075rem;
    }

    .text-lg {
      font-size: 1.2rem;
    }

    .error {
      color: #dc3545;
    }

    .settings-ai-models {
      text-align: left;
    }
    video {
      width: 240px;
      height: 100%;
      border-radius: 8px;
    }
  }
</style>
