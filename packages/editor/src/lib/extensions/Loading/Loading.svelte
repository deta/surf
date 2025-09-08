<script lang="ts">
  import { Icon } from '@deta/icons'

  export let text: string = 'Thinking…'
</script>

<div class="loading">
  <Icon name="plane.loader" size="2.25rem" />
  <div class="loading-text-container">
    <span class="loading-text">{text}</span>
  </div>
</div>

<style lang="scss">
  .loading {
    width: fit-content;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    font-size: 1rem;
    opacity: 1;
  }

  .loading-text-container {
    position: relative;
  }

  // Animation configuration variables
  $total-duration: 40s; // Total animation cycle time
  $speed-multiplier: 20; // Speed of hump movement (higher = faster)
  $hump-spacing: 10%; // Initial spacing between humps
  $idle-delay: 20s; // Pause time between animation cycles

  .loading-text {
    font-family: var(--default);
    font-weight: var(--medium);
    font-size: 0.9rem;
    background: linear-gradient(
        90deg,
        transparent 0%,
        transparent 40%,
        #aae5ff 45%,
        45%,
        transparent 50%,
        transparent 100%
      ),
      linear-gradient(
        90deg,
        transparent 0%,
        transparent 40%,
        white 45%,
        transparent 50%,
        transparent 100%
      ),
      linear-gradient(
        90deg,
        transparent 0%,
        transparent 40%,
        #aae5ff 45%,
        transparent 50%,
        transparent 100%
      ),
      linear-gradient(
        90deg,
        transparent 0%,
        transparent 40%,
        #aae5ff 45%,
        transparent 50%,
        transparent 100%
      ),
      linear-gradient(
        90deg,
        transparent 0%,
        transparent 40%,
        #aae5ff 45%,
        transparent 50%,
        transparent 100%
      ),
      linear-gradient(
        90deg,
        transparent 0%,
        transparent 40%,
        var(--accent) 45%,
        transparent 50%,
        transparent 100%
      ),
      #399bf1;
    background-size:
      200% 100%,
      200% 100%,
      200% 100%,
      200% 100%,
      200% 100%,
      200% 100%,
      100% 100%;
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    animation: multiSlide #{$total-duration + $idle-delay} infinite linear;
  }

  @keyframes multiSlide {
    // Calculate animation vs idle percentages
    $animation-percent: percentage($total-duration / ($total-duration + $idle-delay));
    $idle-percent: percentage($idle-delay / ($total-duration + $idle-delay));

    0% {
      background-position:
        #{300% + (0 * $hump-spacing)} 0,
        #{300% + (1 * $hump-spacing)} 0,
        #{300% + (2 * $hump-spacing)} 0,
        #{300% + (3 * $hump-spacing)} 0,
        #{300% + (4 * $hump-spacing)} 0,
        #{300% + (5 * $hump-spacing)} 0,
        0 0;
    }

    #{$animation-percent} {
      background-position:
        #{-300% * $speed-multiplier} 0,
        #{-300% * $speed-multiplier} 0,
        #{-300% * $speed-multiplier} 0,
        #{-300% * $speed-multiplier} 0,
        #{-300% * $speed-multiplier} 0,
        #{-300% * $speed-multiplier} 0,
        0 0;
    }

    100% {
      background-position:
        #{-300% * $speed-multiplier} 0,
        #{-300% * $speed-multiplier} 0,
        #{-300% * $speed-multiplier} 0,
        #{-300% * $speed-multiplier} 0,
        #{-300% * $speed-multiplier} 0,
        #{-300% * $speed-multiplier} 0,
        0 0;
    }
  }
</style>
