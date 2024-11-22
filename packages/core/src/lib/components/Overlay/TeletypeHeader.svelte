<script lang="ts">
  import { createEventDispatcher } from 'svelte'
  import { Icon } from '@horizon/icons'
  const dispatch = createEventDispatcher()
</script>

<div class="tty-header-wrapper">
  <div class="header-actions">
    <button class="header-btn" on:click={() => dispatch('create')}>
      <span>Create</span>
      <Icon name="plus.boxed" />
    </button>
    <button class="header-btn" on:click={() => dispatch('ask')}>
      <Icon name="face" />
      <span>Ask</span>
    </button>
  </div>
</div>

<style lang="scss">
  .header-actions {
    display: flex;
    justify-content: space-between;
    padding: 0.5rem 0.5rem 0.25rem 0.5rem;
    position: relative;
    border-bottom: 0.5px solid var(--border-color);
    &:after {
      content: '';
      position: absolute;
      display: block;
      width: 100%;
      height: 1px;
      bottom: -1.5px;
      left: 0;
      border-bottom: 1px solid white;
    }
    .header-btn {
      display: flex;
      padding: 0.5rem 0.75rem;
      justify-content: space-between;
      align-items: center;
      font-size: 1.125rem;
      gap: 0.25rem;
      border-radius: 11px;
      line-height: 1;
      color: var(--text);
      cursor: pointer;
      &:hover {
        color: var(--text-accent);
        filter: brightness(0.95);
        background: rgba(126, 168, 240, 0.15);
        background: color(display-p3 0.5294 0.6549 0.9176 / 0.15);
      }
    }
  }
</style>
