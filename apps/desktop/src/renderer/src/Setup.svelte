<script lang="ts">
  import icon from './assets/icon_512.png'
  import prefsVerticalVideo from './assets/vertical.tabs.mp4'
  import prefsHorizontalVideo from './assets/horizontal.tabs.mp4'

  import type { AppActivationResponse } from '@horizon/api'

  const REQUEST_INVITE_URL = 'https://horizon.space'
  const TERMS_URL = 'https://deta.space/terms'
  const PRIVACY_URL = 'https://deta.space/privacy'

  let view: 'invite' | 'disclaimer' | 'prefs' | 'settings' | 'done' = 'invite'

  let inviteCode = ''
  let embeddingModel = 'english_small'
  let tabsOrientation = 'vertical'
  let acceptedTerms = false
  let loading = false
  let error = ''

  let videoRefs = {
    vertical: null,
    horizontal: null
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
      await window.api.saveSettings({
        embedding_model: embeddingModel,
        tabs_orientation: tabsOrientation
      })
      view = 'done'
    } catch (e) {
      console.error(e)
      error =
        'Sorry: failed to save your preference. Please try again or contact us if problem persists.'
    }
    view = 'settings'
  }

  const handleSettingsSubmit = async () => {
    try {
      // @ts-ignore
      await window.api.saveSettings({
        embedding_model: embeddingModel,
        tabs_orientation: tabsOrientation
      })
      view = 'done'
    } catch (e) {
      console.error(e)
      error =
        'Sorry: failed to save your preference. Please try again or contact us if problem persists.'
    }
  }

  const handleAcceptDisclaimer = () => {
    view = 'prefs'
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
        <p class="info text-md">
          Surf is still under active development and you need to be part of our early adopter
          program to use the app.
        </p>

        <div class="details">
          <p class="info text-md">
            Enter the <b>invite code</b> that was sent to you to get started:
          </p>
          <input bind:value={inviteCode} class="input" placeholder="your invite code" required />
        </div>

        <div class="submit">
          <label class="check">
            <input bind:checked={acceptedTerms} type="checkbox" required />
            <span>
              I agree to the <a href={TERMS_URL} target="_blank">Terms and Conditions</a> and
              <a href={PRIVACY_URL} target="_blank">Privacy Policy</a>
            </span>
          </label>
        </div>

        <div class="submit">
          {#if error}
            <p class="error">{error}</p>
          {/if}
          <div class="actions">
            {#if loading}
              <button type="submit" disabled>Checking Invite…</button>
            {:else}
              <button type="submit">Check Invite</button>
            {/if}
            <p class="apply">
              No invite code? <a href={REQUEST_INVITE_URL} target="_blank"
                >Apply to be a early adopter</a
              >
            </p>
          </div>
        </div>
      </form>
    {:else if view === 'disclaimer'}
      <img src={icon} alt="Surf icon" />

      <h1>One More Thing…</h1>

      <div class="details">
        <p class="info text-md">
          We're in the early stages of developing Surf and to make the app better for you and others
          we are keeping track of some of your activities within the app.
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
            <h2>What is being tracked</h2>
          </div>

          <ul>
            <li>How many horizons and cards you create</li>
            <li>What type of cards you create</li>
            <li>How often you use the app</li>
          </ul>
        </div>

        <!-- <div class="box">
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
            <h2>What is <i><b>not</b></i> being tracked</h2>
          </div>

          <ul>
            <li>The notes you write</li>
            <li>The images you save</li>
            <li>What websites you navigate to</li>
          </ul>
        </div> -->

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
            <p>We process the following data on our servers:</p>
            <ul>
              <li>Images you save</li>
              <li>Text content you summarize</li>
              <li>Audio/Video content you transcribe</li>
            </ul>
            <p>
              Read our <a href={PRIVACY_URL} target="_blank">Privacy Policy</a> for more info.
            </p>
          </div>

          <!-- <ul>
            <li>The notes you write</li>
            <li>The images you save</li>
            <li>What websites you navigate to</li>
            <li>Any other personal data</li>
          </ul> -->
        </div>
      </div>

      <div class="details">
        <p class="info text-md">
          If you have any questions or concerns, please contact us at <a
            href="mailto:team@deta.space">team@deta.space</a
          >.
        </p>
      </div>

      <div class="actions">
        <button on:click={handleAcceptDisclaimer}>I Understand</button>

        <!-- <button on:click={handleClose} class="close">Close App Instead</button> -->
      </div>
    {:else if view === 'prefs'}
      <img src={icon} alt="Surf icon" />
      <h3>Choose your style</h3>

      <div class="radio-container">
        <div class="radio-item">
          <input
            type="radio"
            id="vertical"
            name="radio-group"
            value="vertical"
            checked
            bind:group={tabsOrientation}
          />
          <label for="vertical">
            <video
              src={prefsVerticalVideo}
              loop
              muted
              preload="auto"
              on:mouseover={() => videoRefs.vertical?.play()}
              on:mouseout={() => {
                videoRefs.vertical?.pause()
                videoRefs.vertical.currentTime = 0
              }}
              bind:this={videoRefs.vertical}
            ></video>

            <span>Vertical Tabs</span>
          </label>
        </div>
        <div class="radio-item">
          <input
            type="radio"
            id="horizontal"
            name="radio-group"
            value="horizontal"
            bind:group={tabsOrientation}
          />
          <label for="horizontal">
            <video
              src={prefsHorizontalVideo}
              loop
              muted
              preload="auto"
              on:mouseover={() => videoRefs.horizontal?.play()}
              on:mouseout={() => {
                videoRefs.horizontal?.pause()
                videoRefs.horizontal.currentTime = 0
              }}
              bind:this={videoRefs.horizontal}
            ></video>

            <span>Horizontal Tabs</span>
          </label>
        </div>
      </div>
      <p>
        You can easily change this behavior later at <br /> <span class="pill">View</span> →
        <span class="pill">Toggle Tabs Orientation</span>
      </p>
      <button on:click={handleAcceptPrefs}>Apply Preferences</button>
    {:else if view === 'settings'}
      <img src={icon} alt="Surf icon" />
      <h1>Model Settings</h1>
      <div class="settings-option">
        <h3>Your Local AI Model</h3>
        <br />
        <form on:submit|preventDefault={handleSettingsSubmit}>
          <div class="details">
            <p class="info text-md">
              Select an AI model that will be used to process your data.
              <strong>You will not be able to change this later.</strong>
            </p>
            <p class="info text-sm">
              <strong><i>Large</i></strong> models are better but will use more storage and resources.
            </p>
          </div>

          <div class="settings-ai-models">
            <div>
              <input
                type="radio"
                id="english_small"
                value="english_small"
                checked
                bind:group={embeddingModel}
              />
              <label for="english_small"> <i>English</i></label>
            </div>
            <div>
              <input
                type="radio"
                id="english_large"
                value="english_large"
                bind:group={embeddingModel}
              />
              <label for="english_large">
                <i> English Large</i>
              </label>
            </div>
            <div>
              <input
                type="radio"
                id="multilingual_small"
                value="multilingual_small"
                bind:group={embeddingModel}
              />
              <label for="multilingual_small"><i>Multilingual</i></label>
            </div>
            <div>
              <input
                type="radio"
                id="multilingual_large"
                value="multilingual_large"
                bind:group={embeddingModel}
              />
              <label for="multilingual_large">
                <i> Multilingual Large</i>
              </label>
            </div>
          </div>
          <div class="Submit">
            <button type="submit">Save</button>
          </div>
        </form>
      </div>
    {:else if view === 'done'}
      <img src={icon} alt="Surf icon" />

      <h1>Thank you!</h1>

      <p class="text-lg">You're all set to start using Surf 🎉</p>

      <div class="box contact">
        <p>
          If you have any questions or feedback, please email us at <a href="mailto:team@deta.space"
            >team@deta.space</a
          >
          or join our <a href="https://horizon.space/discord" target="_blank">Discord server</a> to chat
          with the team and all our other amazing early adopters.
        </p>
      </div>

      <button on:click={handleStart}>Start Surf</button>
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
    margin-bottom: 0.75rem;
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

    .radio-container {
      display: flex;
      gap: 20px;
      padding: 1rem 0.5rem;
    }
    .radio-item {
      .media-container {
        position: relative;
        overflow: hidden;
        border-radius: 8px;
      }

      label {
        cursor: pointer;
      }
    }

    .radio-item input[type='radio'] {
      display: none;
    }
    .radio-item label {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 10px;
      gap: 1rem;
      border: 0.5px solid #ccc;
      border-radius: 12px;
      transition: all 0.3s ease;
    }

    .radio-item label:hover {
      background-color: #eff5ff;
    }
    .radio-item input[type='radio']:checked + label {
      border-color: #3a83ea;
      background-color: #e2eeff;
    }
    .radio-item span {
      color: #333;
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
