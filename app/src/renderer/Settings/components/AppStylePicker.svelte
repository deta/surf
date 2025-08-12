<script lang="ts">
  import light from '../../assets/light.webp'
  import dark from '../../assets/dark.webp'
  import { createEventDispatcher } from 'svelte'

  type AppStyle = 'light' | 'dark'

  export let style: AppStyle = 'light'

  let videoRefs = {
    vertical: null,
    horizontal: null
  }

  const dispatch = createEventDispatcher<{ update: AppStyle }>()

  let oldStyle: AppStyle = style
  $: if (oldStyle !== style) {
    oldStyle = style
    dispatch('update', style)
  }
</script>

<div class="radio-container">
  <div class="radio-item">
    <input
      type="radio"
      id="light"
      name="radio-group-app_style"
      value="light"
      checked
      bind:group={style}
    />
    <label for="light">
      <img src={light} alt="light" class="w-full h-48 object-cover" />
    </label>
    <span>Light</span>
  </div>
  <div class="radio-item">
    <input type="radio" id="dark" name="radio-group-app_style" value="dark" bind:group={style} />
    <label for="dark">
      <img src={dark} alt="dark" />
    </label>
    <span>Dark</span>
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

  img {
    width: 240px;
    height: 100%;
    border-radius: 11px;

    user-select: none;
  }
</style>
