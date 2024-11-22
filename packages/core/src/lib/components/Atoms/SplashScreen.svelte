<script lang="ts">
  import { onMount, onDestroy } from 'svelte'

  import frame1 from '../../../../public/assets/boot/charC_hairmotion1.png'
  import frame2 from '../../../../public/assets/boot/charC_hairmotion2.png'
  import frame3 from '../../../../public/assets/boot/charC_hairmotion3.png'
  import frame4 from '../../../../public/assets/boot/charC_hairmotion4.png'
  import { isDev } from '@horizon/utils'

  export let show = false

  let fadeOut = false

  let done = false
  onMount(() => {
    if (isDev) {
      done = true
      fadeOut = true
      return
    }

    setTimeout(() => {
      fadeOut = true

      setTimeout(() => {
        done = true
      }, 400)
    }, 1400)
  })

  let frame = 0
  let flipInterval: Timer
  onMount(() => {
    flipInterval = setInterval(() => {
      frame += 1
      if (frame > 3) frame = 0
      Array.from(document.querySelectorAll('.flipbook > img')).forEach((e, i) => {
        if (i === frame) e.style.opacity = '1'
        else e.style.opacity = '0'
      })
    }, 350)
  })
  onDestroy(() => {
    clearInterval(flipInterval)
  })
</script>

{#if !done || show}
  <div class="splash" class:fadeOut>
    <div class="flipbook">
      <img src={frame1} style="opacity: 0;" />
      <img src={frame2} style="opacity: 0;" />
      <img src={frame3} style="opacity: 0;" />
      <img src={frame4} style="opacity: 0;" />
    </div>
    <span class="surf text-gray-900 dark:text-gray-100" style="margin-top: 1rem; ">Surf</span>
    <span class="sub text-gray-900/60 dark:text-gray-100/60">by deta</span>
  </div>
{/if}

<style lang="scss">
  .splash {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    z-index: 10000000000;
    background: white;
    display: flex;
    justify-content: center;
    align-items: center;
    flex-direction: column;

    :global(.dark) & {
      background: #181818;
    }
  }
  .cls-1 {
    fill: none;
    stroke: #000;
    stroke-width: 0;
    stroke-miterlimit: 10;
    stroke-dasharray: 250;
    stroke-dashoffset: 0;
    animation: stroke-reveal 1.1s ease-out infinite;

    :global(.dark) & {
      stroke: #fff;
    }
  }
  .ttr {
    animation: title-reveal 1.1s ease-out infinite;
  }

  .flipbook {
    position: relative;
    width: 40ch;
    aspect-ratio: 1 / 1;
    height: 200px;

    > img {
      position: absolute;
      inset: 0;
      object-fit: cover;
      opacity: 1;
    }
  }
  .surf {
    font-family: Gambarino;
    font-size: 2em;
    letter-spacing: 0.32px;
  }
  .sub {
    margin-top: 4px;
    font-size: 0.9em;
  }
  @keyframes stroke-reveal {
    from {
      stroke-dashoffset: 450;
      stroke-width: 0;
      stroke-opacity: 0.4;
    }
    to {
      stroke-dashoffset: 0;
      stroke-width: 5px;
      stroke-opacity: 1;
    }
  }
  @keyframes title-reveal {
    0% {
      opacity: 0;
    }
    50% {
      opacity: 0;
    }
    100% {
      opacity: 1;
    }
  }

  @keyframes fadeOut {
    0% {
      opacity: 1;
    }
    100% {
      opacity: 0;
    }
  }

  .fadeOut {
    animation: fadeOut 575ms cubic-bezier(0.19, 1, 0.22, 1) forwards;
  }
</style>
