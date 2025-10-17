<script lang="ts">
  import type { Toast } from './toast'
  import { Icon } from '@deta/icons'
  import { hover, tooltip } from '@deta/utils'
  import { createEventDispatcher } from 'svelte'
  import { scale } from 'svelte/transition'

  export let toast: Toast
  export let i: number
  export let outro = false

  const dispatch = createEventDispatcher<{ dismiss: void }>()

  function intro(node: HTMLElement, opts: { clazz: string }) {
    node.classList.add(opts.clazz)
    setTimeout(() => node.classList.remove(opts.clazz), 20)
  }
</script>

<article
  class="toast {toast.type}"
  role="alert"
  style:--i={i}
  class:outro
  use:hover={toast.isHovering}
  use:intro={{ clazz: 'starting' }}
>
  <div class="icon" transition:scale={{ duration: 150 }}>
    {#if toast.type === 'success'}
      <Icon name="check" size="22px" stroke-width="2.5" />
    {:else if toast.type === 'error'}
      <Icon name="close" size="22px" stroke-width="2.5" />
    {:else if toast.type === 'warning'}
      <Icon name="alert-triangle" size="22px" stroke-width="2.5" />
    {:else if toast.type === 'loading'}
      <Icon name="spinner" size="18px" />
    {:else}
      <Icon name="info" size="22px" stroke-width="2.5" />
    {/if}
  </div>

  <div class="text select-none" use:intro={{ clazz: 'starting' }}>
    <slot>
      {toast.message}
    </slot>
  </div>

  {#if toast.action}
    <button class="action" on:click={() => toast.handleClick()}>
      {toast.action.label}
    </button>
  {/if}

  {#if toast.dismissable}
    <button
      use:tooltip={{ text: toast.dismissText, position: 'right' }}
      class="close"
      on:click={() => dispatch('dismiss')}
    >
      <Icon name="close" size="15px" />
    </button>
  {/if}
</article>

<style lang="scss">
  @use '@deta/ui/styles/utils' as utils;

  .toast {
    @include utils.light-dark-custom(
      'background-fill-mix',
      rgba(255, 255, 255, 1),
      rgba(0, 0, 0, 1),
      rgba(255, 255, 255, 1),
      rgba(0, 0, 0, 1)
    );
    @include utils.light-dark-custom(
      'background-fill-mix-inverted',
      rgba(0, 0, 0, 1),
      rgba(255, 255, 255, 1),
      rgba(0, 0, 0, 1),
      rgba(255, 255, 255, 1)
    );
    @include utils.light-dark-custom(
      'fill',
      #fbf5ef,
      rgba(0, 0, 0, 1),
      color-mix(in srgb, var(--base-color), 55% var(--background-fill-mix))
    );

    display: flex;
    align-items: center;
    justify-items: center;
    gap: 0.5rem;
    border-radius: 13px;
    padding: 0.5rem 0.5rem;
    //padding-right: 1.25rem;
    box-shadow:
      0 0 0 1px rgba(50, 50, 93, 0.06),
      0 2px 5px 0 rgba(50, 50, 93, 0.04),
      0 1px 1.5px 0 rgba(0, 0, 0, 0.01);

    color: var(--contrast-color);
    background: var(--fill);
    border: 1px solid color-mix(in srgb, var(--fill), 25% var(--background-fill-mix-inverted));

    interpolate-size: allow-keywords;
    position: absolute;
    top: 0;
    width: max-content;
    opacity: 1;
    --scale: 1;
    --y: calc(1em + var(--i) * 50px);
    transform: translate3d(0px, var(--y), 0px) scale(var(--scale));

    transition: transform, width, opacity;
    transform-origin: top center;

    white-space: nowrap;

    &.starting {
      --scale: 0;
      --y: 0px;
      width: 0px;
      opacity: 0;
    }
    &.outro {
      --scale: 0.9;
      --y: calc(0.5em + var(--i) * 50px);
      width: 0px;
      opacity: 0;

      &.text {
        opacity: 0;
      }
    }

    &:hover .close {
      display: flex;
    }

    .text {
      interpolate-size: allow-keywords;

      width: max-content;
      opacity: 0.8;

      font-weight: 500;
      letter-spacing: 0.006px;

      transition:
        opacity 125ms cubic-bezier(0.4, 0, 0, 1),
        width 588.4ms
          linear(
            0 0%,
            0.006959 1%,
            0.026335 2%,
            0.056008 3%,
            0.094036 4%,
            0.138652 5%,
            0.188268 6%,
            0.241462 7.000000000000001%,
            0.296979 8%,
            0.353718 9%,
            0.410728 10%,
            0.467196 11%,
            0.522437 12%,
            0.575887 13%,
            0.627088 14.000000000000002%,
            0.675684 15%,
            0.721406 16%,
            0.764064 17%,
            0.803537 18%,
            0.839769 19%,
            0.872751 20%,
            0.902525 21%,
            0.929165 22%,
            0.95278 23%,
            0.973503 24%,
            0.991484 25%,
            1.006891 26%,
            1.0199 27%,
            1.030693 28.000000000000004%,
            1.039456 28.999999999999996%,
            1.046373 30%,
            1.051627 31%,
            1.055395 32%,
            1.057849 33%,
            1.059152 34%,
            1.059458 35%,
            1.058912 36%,
            1.05765 37%,
            1.055796 38%,
            1.053462 39%,
            1.050753 40%,
            1.047762 41%,
            1.044571 42%,
            1.041253 43%,
            1.037872 44%,
            1.034484 45%,
            1.031135 46%,
            1.027866 47%,
            1.024707 48%,
            1.021687 49%,
            1.018824 50%,
            1.016135 51%,
            1.013629 52%,
            1.011313 53%,
            1.009191 54%,
            1.007261 55.00000000000001%,
            1.005522 56.00000000000001%,
            1.003968 56.99999999999999%,
            1.002592 57.99999999999999%,
            1.001388 59%,
            1.000344 60%,
            0.999452 61%,
            0.998701 62%,
            0.99808 63%,
            0.997578 64%,
            0.997184 65%,
            0.996887 66%,
            0.996676 67%,
            0.996542 68%,
            0.996475 69%,
            0.996466 70%,
            0.996506 71%,
            0.996588 72%,
            0.996703 73%,
            0.996846 74%,
            0.99701 75%,
            0.99719 76%,
            0.997382 77%,
            0.99758 78%,
            0.997781 79%,
            0.997982 80%,
            0.998181 81%,
            0.998374 82%,
            0.998561 83%,
            0.998739 84%,
            0.998908 85%,
            0.999066 86%,
            0.999213 87%,
            0.999349 88%,
            0.999473 89%,
            0.999586 90%,
            0.999688 91%,
            0.999778 92%,
            0.999858 93%,
            0.999928 94%
          );
    }

    transition-duration: 588.4ms;
    transition-timing-function: linear(
      0 0%,
      0.006959 1%,
      0.026335 2%,
      0.056008 3%,
      0.094036 4%,
      0.138652 5%,
      0.188268 6%,
      0.241462 7.000000000000001%,
      0.296979 8%,
      0.353718 9%,
      0.410728 10%,
      0.467196 11%,
      0.522437 12%,
      0.575887 13%,
      0.627088 14.000000000000002%,
      0.675684 15%,
      0.721406 16%,
      0.764064 17%,
      0.803537 18%,
      0.839769 19%,
      0.872751 20%,
      0.902525 21%,
      0.929165 22%,
      0.95278 23%,
      0.973503 24%,
      0.991484 25%,
      1.006891 26%,
      1.0199 27%,
      1.030693 28.000000000000004%,
      1.039456 28.999999999999996%,
      1.046373 30%,
      1.051627 31%,
      1.055395 32%,
      1.057849 33%,
      1.059152 34%,
      1.059458 35%,
      1.058912 36%,
      1.05765 37%,
      1.055796 38%,
      1.053462 39%,
      1.050753 40%,
      1.047762 41%,
      1.044571 42%,
      1.041253 43%,
      1.037872 44%,
      1.034484 45%,
      1.031135 46%,
      1.027866 47%,
      1.024707 48%,
      1.021687 49%,
      1.018824 50%,
      1.016135 51%,
      1.013629 52%,
      1.011313 53%,
      1.009191 54%,
      1.007261 55.00000000000001%,
      1.005522 56.00000000000001%,
      1.003968 56.99999999999999%,
      1.002592 57.99999999999999%,
      1.001388 59%,
      1.000344 60%,
      0.999452 61%,
      0.998701 62%,
      0.99808 63%,
      0.997578 64%,
      0.997184 65%,
      0.996887 66%,
      0.996676 67%,
      0.996542 68%,
      0.996475 69%,
      0.996466 70%,
      0.996506 71%,
      0.996588 72%,
      0.996703 73%,
      0.996846 74%,
      0.99701 75%,
      0.99719 76%,
      0.997382 77%,
      0.99758 78%,
      0.997781 79%,
      0.997982 80%,
      0.998181 81%,
      0.998374 82%,
      0.998561 83%,
      0.998739 84%,
      0.998908 85%,
      0.999066 86%,
      0.999213 87%,
      0.999349 88%,
      0.999473 89%,
      0.999586 90%,
      0.999688 91%,
      0.999778 92%,
      0.999858 93%,
      0.999928 94%
    );
  }

  .action {
    opacity: 0.8;

    font-size: 0.95em;
    font-weight: 500;
    letter-spacing: 0.006px;

    padding: 0.1em 0.3em;
    border-radius: calc(13px - 0.5rem);

    background: color-mix(in srgb, var(--fill), 15% var(--background-fill-mix-inverted));
    transition: background 125ms ease-in-out;

    &:hover {
      background: color-mix(in srgb, var(--fill), 25% var(--background-fill-mix-inverted));
    }
  }

  .icon {
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .text {
    font-size: 1rem;
  }

  .error {
    .icon {
      color: light-dark(IndianRed, var(--danger-dark, #f87171));
    }
  }

  .success {
    .icon {
      color: light-dark(MediumSeaGreen, var(--success-dark, #4ade80));
    }
  }

  .warning {
    .icon {
      color: light-dark(DarkOrange, var(--warning-dark, #fbbf24));
    }
  }

  .info {
    .icon {
      color: light-dark(SkyBlue, var(--brand-info-dark, #8ea8ff));
    }
  }

  .close {
    position: absolute;
    top: -0.5rem;
    right: -0.5rem;
    display: none;
    align-items: center;
    justify-content: center;
    padding: 0.25rem;
    border-radius: 50%;
    color: var(--contrast-color);
    background: var(--fill);
    border: 1px solid color-mix(in srgb, var(--fill), 25% var(--background-fill-mix-inverted));
    box-shadow:
      0 0 0 1px rgba(50, 50, 93, 0.06),
      0 2px 5px 0 rgba(50, 50, 93, 0.04),
      0 1px 1.5px 0 rgba(0, 0, 0, 0.01);
  }
</style>
