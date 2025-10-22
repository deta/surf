<script lang="ts">
  import { writable, derived, type Readable } from 'svelte/store'

  export let value: Readable<number>
  export let pad: number = 1

  const formattedZoomLevel = derived(value, ($value) => $value.toString())

  let digits: Array<{ current: string; previous: string; rolling: boolean; direction: string }> = []
  let lastValue = ''
  let animationTrigger = writable(0)

  $: updateDigits($formattedZoomLevel)

  function updateDigits(newZoomLevel: string) {
    if (newZoomLevel === lastValue) return

    const newDigits = newZoomLevel.padStart(pad + 2, '0').split('')
    const oldDigits = lastValue.padStart(pad + 2, '0').split('')

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

<span class="counter">
  {#each digits as { current, previous, rolling, direction }, i (i + '-' + $animationTrigger)}
    {#if !(i === 0 && current === '0' && digits.length > 1)}
      <div class="digit-container" class:rolling>
        <div class="digit-wheel">
          {#if rolling}
            <div class="digit previous {direction}">{previous}</div>
            <div class="digit current rolling {direction}">{current}</div>
          {:else}
            <div class="digit">{current}</div>
          {/if}

          <div class="digit hidden-digit">{current}</div>
        </div>
      </div>
    {/if}
  {/each}
</span>

<style>
  .counter {
    display: inline-flex;
    align-items: center;
    gap: 0.05em;
    perspective: 2000px;
  }
  .digit-container {
    position: relative;
    width: 1ch;
    height: min-content;
    overflow: hidden;
    font-size: inherit;
    line-height: inherit;
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
    font-size: inherit;
    line-height: inherit;
    font-variant-numeric: tabular-nums;
  }

  .digit.hidden-digit {
    position: relative;
    opacity: 0;
    pointer-events: none;
    user-select: none;
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
      filter: blur(32px);
      opacity: 0;
    }
    to {
      transform: rotateX(0deg) translateY(0) translateZ(0);
      filter: blur(0);
      opacity: 1;
    }
  }
  @keyframes rollOutUp {
    from {
      transform: rotateX(0deg) translateY(0) translateZ(0);
      filter: blur(0);
      opacity: 1;
    }
    to {
      transform: rotateX(-45deg) translateY(-150%) translateZ(2em);
      filter: blur(32px);
      opacity: 0;
    }
  }
  @keyframes rollInDown {
    from {
      transform: rotateX(-45deg) translateY(-150%) translateZ(2em);
      filter: blur(32px);
      opacity: 0;
    }
    to {
      transform: rotateX(0deg) translateY(0) translateZ(0);
      filter: blur(0);
      opacity: 1;
    }
  }
  @keyframes rollOutDown {
    from {
      transform: rotateX(0deg) translateY(0) translateZ(0);
      filter: blur(0);
      opacity: 1;
    }
    to {
      transform: rotateX(45deg) translateY(150%) translateZ(2em);
      filter: blur(32px);
      opacity: 0;
    }
  }
</style>
