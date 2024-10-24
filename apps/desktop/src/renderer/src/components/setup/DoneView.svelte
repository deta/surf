<script lang="ts">
  import { createEventDispatcher } from 'svelte'
  import Button from './Button.svelte'
  import Box from './Box.svelte'

  const dispatch = createEventDispatcher()

  const DISCORD_URL = 'https://deta.surf/discord'

  const handleStart = () => {
    dispatch('start')
  }
</script>

<div class="container">
  <div class="wrapper">
    <h1 class="title">Thank you.</h1>

    <p class="description">You're all set to start using Surf 🎉</p>

    <p class="caption">
      <a href="mailto:team@deta.space">team@deta.space</a> •
      <a href={DISCORD_URL} target="_blank">Discord Server</a>
    </p>

    <div class="actions">
      <Button on:click={handleStart}>Go Surfing</Button>
    </div>
  </div>
</div>

<style lang="scss">
  .container {
    display: flex;
    justify-content: center;
    align-items: center;
    min-height: 100vh;
    width: 100%;
  }

  .wrapper {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    padding: 2rem;
    max-width: 60ch;
  }

  .title {
    font-family: 'Gambarino-Display', sans-serif;
    font-size: 2.5rem;
    margin-bottom: 2rem;
    color: #333;
    text-align: center;
  }

  .eyebrow {
    font-family: 'Inter', sans-serif;
    color: var(--color-brand);
    color: color(display-p3 0.3569 0.6078 0.9059);
    font-family: 'Inter', sans-serif;
    font-size: 2.5rem;
    font-style: normal;
    font-weight: 700;
    line-height: 150%;
    margin-bottom: 1rem;
  }

  .description {
    font-family: 'Inter', sans-serif;
    font-size: 1.25rem;
    line-height: 1.5;
    color: #666;
    margin-bottom: 1rem;
  }

  .caption {
    font-family: 'Inter', sans-serif;
    font-size: 1rem;
    font-weight: 400;
    letter-spacing: 0.225px;
    color: #888;
    text-align: center;
    margin-bottom: 2rem;
  }

  .actions {
    margin-top: 2rem;
  }
</style>
