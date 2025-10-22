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

  let oldOrientation: Orientation = orientation
  $: if (oldOrientation !== orientation) {
    oldOrientation = orientation
    dispatch('update', orientation)
  }
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
    </label>
    <span>Horizontal Tabs</span>
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
    </label>
    <span>Vertical Tabs</span>
  </div>
</div>

<style lang="scss">
  span {
    font-family: 'Inter', Arial, sans-serif;
    font-size: 1.25rem;
    line-height: 1.6;
    color: var(--color-text);
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    margin: 0;
    padding: 0;
    letter-spacing: 0.01em;
    color: #fff;
    text-align: center;
    display: block;
    margin-top: 0.75rem;
  }

  .radio-container {
    display: flex;
    gap: 4rem;
    padding: 1rem 0.5rem;
  }

  .radio-item {
    label {
    }
  }

  .radio-item input[type='radio'] {
    display: none;
  }

  .radio-item label {
    background: rgba(255, 255, 255, 0.6);
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 1px;
    gap: 1rem;
    outline: 0;
    border-radius: 12px;
    transition: all 0.06s ease;
  }

  .radio-item label:hover {
    background-color: #eff5ff;
  }
  .radio-item input[type='radio']:checked + label {
    outline: 4px solid rgba(59, 130, 246, 0.8);
    color: #fff;
  }
  .radio-item input[type='radio']:checked + label span {
    color: #fff;
    font-weight: 600;
  }
  .radio-item span {
    color: #333;
  }
  video {
    width: 240px;
    height: 100%;
    border-radius: 11px;
  }
</style>
