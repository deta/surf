<script lang="ts">
  import { createEventDispatcher, tick } from 'svelte'

  import type { Horizon } from '../../service/horizon'
  import { generateRandomHue } from '../../utils/color'

  export let idx: number
  export let horizon: Horizon
  export let active: boolean = false
  export let hot: boolean = false

  const dispatch = createEventDispatcher<{ click: string }>()

  const data = horizon.data

  let showPreview = false
  let timeout: ReturnType<typeof setTimeout>

  $: shouldShowPreview = !active && data.previewImage

  const handleClick = async (e: MouseEvent) => {
    e.preventDefault()
    hidePreview()
    dispatch('click', horizon.id)
  }

    const handleMouseEnter = () => {
        if (!shouldShowPreview) return

        timeout = setTimeout(() => {
            if (hot) {
                const elem = document.querySelector(`[data-hot-horizon="${horizon.id}"]`) as HTMLElement
                elem.classList.add('preview-horizon')
            } else {
                showPreview = true
            }
        }, 400)
    }

    const hidePreview = () => {
        if (hot) {
            const elem = document.querySelector(`[data-hot-horizon="${horizon.id}"]`) as HTMLElement
            elem.classList.remove('preview-horizon')
        } else {
            showPreview = false
        }

        clearTimeout(timeout)
    }
</script>

<!-- svelte-ignore a11y-click-events-have-key-events -->
<!-- svelte-ignore a11y-no-static-element-interactions -->
<div
  on:mouseenter={handleMouseEnter}
  on:mouseleave={() => hidePreview()}
  class="wrapper"
  style="--item-color-hue: {generateRandomHue(idx + horizon.id)};"
>
  <div on:click={handleClick} class:active class="item">
    {idx}
    {hot ? '🔥' : '🧊'}
  </div>

  {#if showPreview}
    <div class="preview">
      <img src={$data.previewImage} alt="preview" />
    </div>
  {/if}
</div>

<style lang="scss">
  .wrapper {
    position: relative;
  }

  .item {
    width: 2rem;
    height: 2rem;
    border-radius: 8px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.8rem;
    opacity: 0.5;
    border: 2px solid transparent;
    box-sizing: border-box;
    background: hsl(var(--item-color-hue), 100%, 85%);
    color: hsl(var(--item-color-hue), 100%, 30%);

    &:hover {
      filter: brightness(0.95);
    }

    &.active {
      opacity: 1;
      border-color: hsl(var(--item-color-hue), 100%, 80%);
    }
  }

  .preview {
    position: absolute;
    bottom: calc(100% - 3rem);
    z-index: 100000;
    transform: translateY(100%);
    background: hsl(var(--item-color-hue), 100%, 85%);
    border-radius: 15px;
    box-shadow: 0 0 8px rgba(0, 0, 0, 0.2);
    padding: 0.2rem;
    display: flex;
    align-items: center;
    justify-content: center;

    img {
      width: 420px;
      max-width: 80vw;
      border-radius: calc(15px - 0.2rem);
      overflow: hidden;
      margin: 0;
      padding: 0;
    }
  }
</style>
