<script lang="ts">
  import type { Action } from './index'
  import Icon from './Icon.svelte'

  let {
    text,
    icon
  }: {
    text: string
    icon?: Action['icon'] | undefined
  } = $props()
</script>

<div class="breadcrumb">
  {#if icon}
    <div class="icon">
      <Icon {icon} />
    </div>
  {/if}
  <div>{text}</div>
</div>

<style lang="scss">
  .breadcrumb {
    width: fit-content;
    padding: 0.3rem 0.6rem;
    color: var(--text);
    background: var(--background-dark);
    border: var(--border-width) solid var(--border-color);
    border-radius: var(--border-radius);
    overflow: hidden;
    font-size: 0.9rem;
    display: flex;
    align-items: center;
  }

  .icon {
    margin-right: 0.4rem;
  }
</style>
