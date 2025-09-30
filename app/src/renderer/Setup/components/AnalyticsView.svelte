<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte'
  import Button from './Button.svelte'
  import Box from './Box.svelte'
  import LeftPanel from './LeftPanel.svelte'
  import RightPanel from './RightPanel.svelte'
  import { Icon } from '@deta/icons'
  import { fade, fly } from 'svelte/transition'

  const dispatch = createEventDispatcher()

  let showContent = false
  let showButton = false
  let anonymized = true

  const ANALYTICS_URL = 'https://deta.notion.site/analytics'

  const handleSubmit = async () => {
    if (!anonymized) {
      try {
        // @ts-ignore
        const result = await window.api.deanonymizeUser()
      } catch (error) {
        console.error('Error during deanonymization:', error)
      }
    }

    dispatch('viewChange', 'done')
  }

  onMount(() => {
    showContent = true
    setTimeout(() => {
      showButton = true
    }, 600)
  })
</script>

<LeftPanel>
  <div class="wrapper">
    <div in:fly={{ x: 35, duration: 500, delay: 150 }}>
      <span class="eyebrow">SURF ALPHA</span>
    </div>
    {#if showContent}
      <h1 in:fly={{ x: 35, duration: 500, delay: 250 }}>Help us improve Surf</h1>

      <p in:fly={{ x: 35, duration: 500, delay: 300 }}>
        While Surf is in alpha we collect some anonymized telemetry on how you use Surf, to improve
        the product.
      </p>

      <p in:fly={{ x: 35, duration: 500, delay: 350 }}>
        You can optionally link this data to your email, so we can contact you to ask about your
        experience to improve Surf.
      </p>

      <p>
        <a
          in:fly={{ x: 35, duration: 500, delay: 400 }}
          href={ANALYTICS_URL}
          target="_blank"
          class="learn-more"
          rel="noopener noreferrer">Learn more</a
        >
      </p>
    {/if}
    <div class="actions bottom">
      {#if showButton}
        <!-- svelte-ignore a11y-no-static-element-interactions a11y-click-events-have-key-events -->
        <div class="data-check" on:click={() => (anonymized = !anonymized)}>
          <div class="data-check-icon">
            {#if !anonymized}
              <Icon name="check" color="#1d8aff" />
            {/if}
          </div>

          <div class="data-label">
            You can link telemetry data to my email and contact me for feedback.
          </div>
        </div>

        <div in:fade={{ duration: 300 }}>
          <Button on:click={handleSubmit}>I Understand</Button>
        </div>
      {/if}
    </div>
  </div>
</LeftPanel>

<RightPanel>
  <div class="info-box-wrapper">
    <div class="info-box">
      <div class="info-box-header">
        <Icon name="chart-bar" size="24" color="#1d8aff" />
        <h2>What we track</h2>
      </div>

      <div class="list">
        <div class="list-item">
          <Icon name="check" size="20" />
          <span>What features you access</span>
        </div>

        <div class="list-item">
          <Icon name="check" size="20" />
          <span>How often you use the features</span>
        </div>

        <!-- <div class="list-item">
          <Icon name="check" size="20" />
          <span>The number of AI tokens you use</span>
        </div> -->
      </div>
    </div>

    <div class="info-box">
      <div class="info-box-header">
        <Icon name="chart-bar.off" size="24" color="#ff4d4d" />
        <h2>What we <strong>don't</strong> track</h2>
      </div>

      <div class="list">
        <div class="list-item">
          <Icon name="close" size="20" />
          <span>Which web pages you visit or save</span>
        </div>

        <div class="list-item">
          <Icon name="close" size="20" />
          <span>Content of the data you store</span>
        </div>

        <div class="list-item">
          <Icon name="close" size="20" />
          <span>Content of your AI chats</span>
        </div>
      </div>
    </div>
  </div>
</RightPanel>

<Box></Box>

<style lang="scss">
  .persona-grid {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    gap: 1.5rem;
    width: 100%;
    height: 100vh;
    padding-bottom: 5.5rem;
  }

  .info-box-wrapper {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 1.5rem;
    width: 100%;
    height: 100%;
  }

  .info-box {
    width: 100%;
    max-width: 500px;
    padding: 1.5rem;
    border-radius: 15px;
    border: 0.194px solid rgba(0, 0, 0, 0.13);
    border: 0.194px solid color(display-p3 0 0 0 / 0.13);
    box-shadow:
      0px 20px 25px -5px rgba(0, 0, 0, 0.1),
      0px 10px 10px -5px rgba(0, 0, 0, 0.04);
    transition: box-shadow 1s ease-out;
    background: #ffffff;
  }

  .info-box-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 1rem;
  }

  .grid-container {
    display: grid;
    grid-template-columns: repeat(2, minmax(150px, 1fr));
    gap: 1.5rem;
    width: 100%;
  }

  .persona-button {
    display: flex;
    gap: 0;
    padding: 14px 20px;
    justify-content: space-between;
    align-items: center;
    align-self: stretch;
    font-family: 'Inter', sans-serif;
    font-weight: 500;
    border-radius: 0.825rem;
    border: 0.5px solid rgba(0, 0, 0, 0.13);
    border: 0.5px solid color(display-p3 0 0 0 / 0.13);
    background: #fdfdfd;
    background: color(display-p3 0.9902 0.9902 0.9902);
    box-shadow:
      0px 0px 1px 0px rgba(0, 0, 0, 0.09),
      0px 1px 1px 0px rgba(0, 0, 0, 0.07),
      0px 2px 4px 0px rgba(0, 0, 0, 0.02);
    box-shadow:
      0px 0px 1px 0px color(display-p3 0 0 0 / 0.09),
      0px 1px 1px 0px color(display-p3 0 0 0 / 0.07),
      0px 2px 4px 0px color(display-p3 0 0 0 / 0.02);
    transition: all 0.2s ease-in-out;

    &:hover:not(:disabled) {
      background: #ffffff;
      outline: 4px solid rgba(255, 255, 255, 0.4);
    }

    &:disabled {
      opacity: 0.4;
    }

    &.selected {
      background: #e6f0ff;
      background: color(display-p3 0.902 0.9412 1);
      outline: 4px solid rgba(59, 130, 246, 0.4);
    }

    .label {
      font-size: 1.25rem;
      color: #5c5c5c;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
      text-rendering: optimizeLegibility;
      white-space: nowrap;
      text-align: left;
      flex-grow: 1;
    }

    .icon {
      display: flex;
      align-items: center;
      justify-content: center;
      opacity: 0.6;
      margin-left: auto;
    }

    &.selected .icon {
      opacity: 0.9;
    }
  }

  .selected-count {
    position: absolute;
    top: 5rem;
    left: 50%;
    transform: translateX(-50%);
    color: #fff;
  }

  .eyebrow {
    font-family: 'Inter', sans-serif;
    display: block;
    margin-bottom: 0.25rem;
    color: var(--color-brand);
    color: color(display-p3 0.3569 0.6078 0.9059);
    font-family: 'Inter', sans-serif;
    font-size: 1rem;
    font-style: normal;
    font-weight: 600;
    line-height: 150%;
    margin-top: 2rem;
    letter-spacing: 1.12px;
  }

  h1 {
    font-size: 2.5rem;
    font-weight: 400;
    color: #333;
    margin-bottom: 1rem;
    text-wrap: balance;
  }

  h2 {
    font-size: 1.4rem;
    font-weight: 500;
    color: #333;
    margin-bottom: 0;
  }

  p {
    font-family: 'Inter', sans-serif;
    font-size: 1.25rem;
    line-height: 1.5;
    color: #666;
    margin-bottom: 1rem;
    text-wrap: pretty;
    &.caption {
      font-size: 1rem;
      font-weight: 400;
      letter-spacing: 0.225px;
      color: #888;
    }
  }

  .skip-button {
    border: 0;
    background: none;
    font-family: 'Inter', sans-serif;
    font-weight: 500;
    padding: 1rem;
    font-size: 1rem;
    color: #888;
    transition: color 0.2s ease-in-out;

    &:hover {
      color: #666;
    }
  }

  .wrapper {
    width: 100%;
    height: 100%;
    position: relative;
  }

  .bottom {
    position: absolute;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    bottom: 2rem;
    width: 100%;

    button {
      width: 100% !important;
    }
  }

  .list {
    list-style: none;
    padding: 0;
    margin: 0;
  }

  .list-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.5rem;
  }

  .telemetry-options {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    margin-top: 1.5rem;
    margin-bottom: 1.5rem;

    // border: 1px dashed #d1d5db; /* Tailwind gray-300 */
    // border-radius: 12px;
    // padding: 0.25rem 0.5rem;

    :global(label) {
      font-family: 'Inter', sans-serif;
      font-size: 1.25rem;
      line-height: 1.5;
      color: #454545;
    }
  }

  .data-check {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    border: 1px dashed #d1d5db; /* Tailwind gray-300 */
    border-radius: 12px;
    padding: 0.25rem 0.5rem;
    margin-top: 1.5rem;
    margin-bottom: 1.5rem;
  }

  .data-check-icon {
    flex-shrink: 0;
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 5px;
    border: 1px solid #d1d5db; /* Tailwind gray-300 */

    &.checked {
      background-color: #1d8aff; /* Tailwind blue-500 */
      border-color: #1d8aff; /* Tailwind blue-500 */
      color: white;
    }
  }

  .data-label {
    font-family: 'Inter', sans-serif;
    font-size: 1.05rem;
    line-height: 1.5;
    color: #666;
    cursor: default;
  }
</style>
