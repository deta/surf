<script lang="ts">
  import { createEventDispatcher } from 'svelte'
  import Button from './Button.svelte'
  import Box from './Box.svelte'
  import { fly, blur } from 'svelte/transition'
  import { quintOut } from 'svelte/easing'

  const dispatch = createEventDispatcher()

  const ANALYTICS_URL = 'https://deta.surf/analytics'
  const SECURITY_URL = 'https://deta.surf/security'
  const PRIVACY_URL = 'https://deta.surf/privacy'

  const handleAcceptAIFeatures = () => {
    // dispatch('viewChange', 'app_preferences')
    dispatch('viewChange', 'persona')
  }
</script>

<div class="wrapper">
  <div class="content" in:fly={{ y: 200, duration: 1000, easing: quintOut }}>
    <div in:blur={{ amount: 5, duration: 1000 }}>
      <h1 class="title">Early Access Program</h1>

      <div class="details">
        <p class="info text-md">While Surf is in early access, we want to make two things clear:</p>
      </div>

      <div class="tracking">
        <Box>
          <div class="icon-heading">
            <h2>Analytics</h2>
          </div>
          <p>
            Surf collects some <b>anonymous</b> analytics which include interactions with certain app
            features. We do not track the URLs you visit nor the contents of the data you store.
          </p>
          <a href={ANALYTICS_URL} target="_blank" class="learn-more" rel="noopener noreferrer"
            >Learn more</a
          >
        </Box>
        <Box>
          <div class="icon-heading">
            <h2>Security</h2>
          </div>
          <p>
            While we've taken great care in developing Surf, like any new software, there may be
            minor areas for improvement.
          </p>
          <p>All your data is stored locally on your device.</p>
          <a href={SECURITY_URL} target="_blank" class="learn-more" rel="noopener noreferrer"
            >Learn more</a
          >
        </Box>
      </div>

      <Box>
        <div
          class="icon-heading"
          style="display: flex; flex-direction: column; align-items: center;"
        >
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
          >
            <path stroke="none" d="M0 0h24v24H0z" fill="none" />
            <path
              d="M16 18a2 2 0 0 1 2 2a2 2 0 0 1 2 -2a2 2 0 0 1 -2 -2a2 2 0 0 1 -2 2zm0 -12a2 2 0 0 1 2 2a2 2 0 0 1 2 -2a2 2 0 0 1 -2 -2a2 2 0 0 1 -2 2zm-7 12a6 6 0 0 1 6 -6a6 6 0 0 1 -6 -6a6 6 0 0 1 -6 6a6 6 0 0 1 6 6z"
            />
          </svg>
          <h2>AI Features</h2>
        </div>

        <div class="details text-md">
          <p>Surf offers AI features, which sends certain data to our servers and / or OpenAI:</p>
          <ul style="text-align:left;">
            <li>If you <b>save an image</b>, our servers tag them, to make them searchable.</li>
            <li>
              If you <b>chat</b> with a website or a Context, content from the website or Context is
              sent to OpenAI through Deta's servers.
            </li>
            <li>
              Contexts can collect content from websites for you. If you add subscriptions, some of
              this content is sent to OpenAI through Deta's servers (to create summaries).
            </li>
          </ul>
          <p>
            Read our <a href={PRIVACY_URL} target="_blank">Privacy Policy</a> for more info.
          </p>
        </div>
      </Box>
      <div class="actions">
        <Button on:click={handleAcceptAIFeatures}>I understand</Button>
      </div>
    </div>
  </div>
</div>

<style lang="scss">
  .wrapper {
    display: flex;
    justify-content: center;
    width: 100%;
    padding: 4rem;
    background-color: #f8f9fa;
  }

  .content {
    max-width: 600px;
    padding: 2rem;
    border-radius: 1rem;
    border: 0.194px solid rgba(0, 0, 0, 0.13);
    border: 0.194px solid color(display-p3 0 0 0 / 0.13);
    box-shadow:
      0px 20px 25px -5px rgba(0, 0, 0, 0.1),
      0px 10px 10px -5px rgba(0, 0, 0, 0.04);
    transition: box-shadow 1s ease-out;
  }

  .content:hover {
    box-shadow:
      0px 2.633px 0.745px 0px #001c38,
      0px 1.689px 0.646px 0px rgba(0, 28, 56, 0.01),
      0px 0.944px 0.547px 0px rgba(0, 28, 56, 0.05),
      0px 0.397px 0.397px 0px rgba(0, 28, 56, 0.09),
      0px 0.099px 0.248px 0px rgba(0, 28, 56, 0.1);
  }

  .title {
    font-family: 'Gambarino-Display', sans-serif;
    font-size: 2.5rem;
    margin-bottom: 2rem;
    color: #333;
    text-align: center;
  }

  .subtitle {
    font-family: 'Gambarino-Display', sans-serif;
    font-size: 2rem;
    margin-top: 2rem;
    margin-bottom: 1rem;
    color: #333;
  }

  .tracking {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
    margin-bottom: 2rem;
  }

  .icon-heading {
    display: flex;
    align-items: center;
    margin-bottom: 1rem;

    svg {
      margin-right: 0.5rem;
    }

    h2 {
      margin: 0;
      font-size: 1.25rem;
    }
  }

  .details {
    max-width: 35ch;
    margin: 0 auto;
    margin-bottom: 1rem;

    ul {
      padding-left: 1.5rem;
    }
  }

  .actions {
    display: flex;
    justify-content: center;
    margin-top: 2rem;
  }

  .learn-more {
    color: #007bff;
    text-decoration: none;
    text-align: left;
    font-weight: 500;
  }
</style>
