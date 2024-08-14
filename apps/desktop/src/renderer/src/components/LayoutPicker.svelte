<script lang="ts">
  import prefsVerticalVideo from '../assets/vertical.tabs.mp4'
  import prefsHorizontalVideo from '../assets/horizontal.tabs.mp4'
  import { createEventDispatcher } from 'svelte'

  type Orientation = 'vertical' | 'horizontal'

  export let orientation: Orientation = 'horizontal'

  let videoRefs = {
    vertical: null,
    horizontal: null
  }

  const dispatch = createEventDispatcher<{ update: Orientation }>()

  $: dispatch('update', orientation)
</script>

<div class="radio-container">
  <div class="radio-item">
    <input
      type="radio"
      id="horizontal"
      name="radio-group"
      value="horizontal"
      checked
      bind:group={orientation}
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
  <div class="radio-item">
    <input
      type="radio"
      id="vertical"
      name="radio-group"
      value="vertical"
      bind:group={orientation}
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
</div>

<style lang="scss">
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

  span {
    display: inline-block;
  }

  .radio-wrapper {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding-left: 0.25rem;
  }

  .radio-container {
    display: flex;
    gap: 20px;
    padding: 1rem 0.5rem;
  }

  .radio-form {
    display: flex;
    padding-bottom: 2rem;
    gap: 1rem;
  }

  .radio-submit {
    margin-top: 2rem;
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
</style>
