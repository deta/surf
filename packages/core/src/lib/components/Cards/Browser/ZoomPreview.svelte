<script lang="ts">
  import { writable, derived } from 'svelte/store'

  export let zoomLevel: Writable<number>
  export let showZoomPreview: Writable<boolean>

  const formattedZoomLevel = derived(zoomLevel, ($zoomLevel) =>
    Math.max(0, Math.round(100 * $zoomLevel)).toString()
  )

  let digits: Array<{ current: string; previous: string; rolling: boolean; direction: string }> = []
  let lastValue = ''
  let animationTrigger = writable(0)

  $: updateDigits($formattedZoomLevel)

  function updateDigits(newZoomLevel: string) {
    if (newZoomLevel === lastValue) return

    const newDigits = newZoomLevel.padStart(3, '0').split('')
    const oldDigits = lastValue.padStart(3, '0').split('')

    const isIncreasing = parseInt(newZoomLevel) > parseInt(lastValue)

    digits = newDigits.map((digit, i) => {
      const prevDigit = oldDigits[i] || digit
      return {
        current: digit,
        previous: prevDigit,
        rolling: prevDigit !== digit,
        direction: isIncreasing ? 'up' : 'down'
      }
    })

    lastValue = newZoomLevel
    animationTrigger.update((n) => n + 1)
  }
</script>

{#if $showZoomPreview}
  <main class="zoom-preview">
    <div class="counter">
      {#each digits as { current, previous, rolling, direction }, i (i + '-' + $animationTrigger)}
        {#if i === 0 && current === '0' && digits.length > 1}{:else}
          <div class="digit-container" class:rolling>
            <div class="digit-wheel">
              {#if rolling}
                <div class="digit previous {direction}">{previous}</div>
                <div class="digit current rolling {direction}">{current}</div>
              {:else}
                <div class="digit">{current}</div>
              {/if}
            </div>
          </div>
        {/if}
      {/each}
      <span class="percent">%</span>
    </div>
  </main>
{/if}

<style>
  .zoom-preview {
    position: absolute;
    bottom: 1.5rem;
    left: 1.5rem;
    background-color: rgba(255, 255, 255, 0.9);
    padding: 0.5rem 1rem;
    border-radius: 0.25rem;
    box-shadow:
      0px 0px 32px -1px rgba(0, 0, 0, 0.05),
      0px 14px 4px 0px #000,
      0px 9px 3px 0px rgba(0, 0, 0, 0.01),
      0px 5px 3px 0px rgba(0, 0, 0, 0.03),
      0px 2px 2px 0px rgba(0, 0, 0, 0.06),
      0px 1px 1px 0px rgba(0, 0, 0, 0.07);

    box-shadow:
      0px 0px 32px -1px color(display-p3 0 0 0 / 0.05),
      0px 14px 4px 0px color(display-p3 0 0 0 / 0),
      0px 9px 3px 0px color(display-p3 0 0 0 / 0.01),
      0px 5px 3px 0px color(display-p3 0 0 0 / 0.03),
      0px 2px 2px 0px color(display-p3 0 0 0 / 0.06),
      0px 1px 1px 0px color(display-p3 0 0 0 / 0.07);
    font-size: 1.5em;
    border-radius: 12px;
  }
  .counter {
    display: flex;
    align-items: center;
    gap: 0.05em;
    perspective: 2000px;
  }
  .digit-container {
    position: relative;
    width: 1ch;
    height: 1em;
    overflow: hidden;
  }
  .digit-wheel {
    position: relative;
    width: 100%;
    height: 100%;
    transform-style: preserve-3d;
  }
  .digit {
    position: absolute;
    width: 100%;
    height: 100%;
    display: flex;
    justify-content: center;
    align-items: center;
    backface-visibility: hidden;
  }
  .percent {
    font-size: 1rem;
    margin-left: 0.4rem;
    opacity: 0.4;
  }

  .digit.current.rolling.up {
    animation: rollInUp 250ms cubic-bezier(0, 1.47, 0.52, 1) forwards;
  }
  .digit.previous.up {
    animation: rollOutUp 250ms cubic-bezier(0, 1.47, 0.52, 1) forwards;
  }
  .digit.current.rolling.down {
    animation: rollInDown 250ms cubic-bezier(0, 1.47, 0.52, 1) forwards;
  }
  .digit.previous.down {
    animation: rollOutDown 250ms cubic-bezier(0, 1.47, 0.52, 1) forwards;
  }
  @keyframes rollInUp {
    from {
      transform: rotateX(45deg) translateY(150%) translateZ(2em);
      opacity: 0;
    }
    to {
      transform: rotateX(0deg) translateY(0) translateZ(0);
      opacity: 1;
    }
  }
  @keyframes rollOutUp {
    from {
      transform: rotateX(0deg) translateY(0) translateZ(0);
      opacity: 1;
    }
    to {
      transform: rotateX(-45deg) translateY(-150%) translateZ(2em);
      opacity: 0;
    }
  }
  @keyframes rollInDown {
    from {
      transform: rotateX(-45deg) translateY(-150%) translateZ(2em);
      opacity: 0;
    }
    to {
      transform: rotateX(0deg) translateY(0) translateZ(0);
      opacity: 1;
    }
  }
  @keyframes rollOutDown {
    from {
      transform: rotateX(0deg) translateY(0) translateZ(0);
      opacity: 1;
    }
    to {
      transform: rotateX(45deg) translateY(150%) translateZ(2em);
      opacity: 0;
    }
  }
</style>
