<script lang="ts">
  import { fade, slide, fly } from 'svelte/transition'
  import type { Fn } from '@deta/types'
  import type { Notification } from './types'
  import Icon from './Icon.svelte'
  import { bounceOut, elasticOut, expoOut, quadOut } from 'svelte/easing'

  let {
    notification,
    onRemove,
    onHover,
    onLeave,
    onClick
  }: {
    notification: Notification
    onRemove?: Fn
    onHover?: Fn
    onLeave?: Fn
    onClick?: Fn
  } = $props()

  let { text, icon, type, showDismiss, actionText, onClick: onClickHandler } = notification
</script>

<div
  class="notification {type}"
  class:clickable={onClickHandler && !actionText}
  role="status"
  aria-live="polite"
  in:fade
  out:slide={{ easing: quadOut, duration: 400 }}
  on:mouseover={onHover}
  on:focus={onHover}
  on:mouseleave={onLeave}
  on:click={() => !actionText && onClick}
>
  {#if icon}
    <div class="icon" out:fade={{ duration: 200 }}>
      <Icon {icon} />
    </div>
  {/if}
  <div class="notification-content" out:fade={{ duration: 200 }}>
    <slot>{text}</slot>
  </div>
  {#if showDismiss}
    <button
      class="close"
      on:click|stopPropagation={onRemove}
      aria-label="delete notification"
      out:fade={{ duration: 200 }}
    >
      &times;
    </button>
  {:else if actionText && onClickHandler}
    <button
      class="action"
      on:click|stopPropagation={onClick}
      aria-label={actionText}
      out:fade={{ duration: 200 }}
    >
      {actionText}
    </button>
  {/if}
</div>

<style lang="scss">
  .notification {
    width: fit-content;
    color: var(--text);
    background: var(--background-dark);
    border: 4px solid var(--border-color);
    border-radius: var(--border-radius);
    overflow: hidden;
    font-size: 0.9rem;
    margin-bottom: 0.25rem;
    display: flex;
    align-items: center;
  }

  .clickable {
    &:hover {
      filter: brightness(98%);
    }
  }

  .success .icon {
    color: var(--green) !important;
  }

  .error .icon {
    color: var(--red) !important;
  }

  .notification-content {
    flex-grow: 1;
    padding: 0.5rem;
    font-size: 0.9rem;
  }

  .icon {
    padding: 0.5rem 0;
    padding-left: 0.5rem;
  }

  button {
    appearance: none;
    background: none;
    border: 0;
    outline: 0;
    padding: 0.5rem 0.75rem;
    color: var(--text);
    font-family: inherit;

    border-left: 1px solid var(--text-light);
  }

  .action {
    margin-left: 1rem;
    font-size: 0.9rem;
  }

  .close {
    margin-left: 1rem;
    font-size: 1rem;
  }
</style>
