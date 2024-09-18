<script lang="ts">
  import { Icon } from '@horizon/icons'
  import { closeContextMenu, type CtxItem } from './ContextMenu.svelte'

  export let items: CtxItem[]
  export let subMenuRef: string | undefined = undefined
</script>

<ul
  class:sub-menu={subMenuRef !== undefined}
  class:sub-items={subMenuRef !== undefined}
  style={subMenuRef !== undefined
    ? `position:fixed; position-anchor: --sub-${subMenuRef}; inset-block-start: anchor(start); inset-inline-start: anchor(self-end); margin: 0px; margin-left:-3px;`
    : ''}
>
  {#each items as item, i}
    {#if item.type === 'separator'}
      <hr />
    {:else if item.type === 'action'}
      <button
        on:click={() => {
          if (item.action) item.action()
        }}
        class:danger={item.kind === 'danger'}
        disabled={item.disabled}
      >
        {#if item.icon}
          <Icon name={item.icon} size="1.2em" />
        {/if}
        <span style="flex: 1; width:100%;">{item.text}</span>
      </button>
    {:else if item.type === 'sub-menu'}
      <li class="sub-item" style="anchor-name: --sub-{i};">
        {#if item.icon}
          <Icon name={item.icon} size="1.2em" />
        {/if}
        <span style="flex: 1; width:100%;">{item.text} </span>
        <Icon name="chevron.right" size="1.2em" style="align-self: flex-end;" />
      </li>
      <svelte:self items={item.items} subMenuRef={`${i}`} />
    {/if}
  {/each}
</ul>

<style lang="scss">
  /* NOTE: We only support a single sub-menu right now with this crude css */
  ul.sub-menu {
    height: fit-content;
    background: #fff;
    padding: 0.25rem;
    border-radius: 9px;
    border: 0.5px solid rgba(0, 0, 0, 0.25);
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.12);
    user-select: none;
    display: none;
  }
  ul.sub-menu:hover {
    display: flex;
  }
  :global(ul:has(li.sub-item:hover) .sub-menu) {
    display: flex;
  }
  :global(ul:has(.sub-menu:hover) .sub-item) {
    background: rgba(0, 0, 0, 0.065);
  }

  ul {
    width: auto;
    display: flex;
    flex-direction: column;

    > button,
    > li {
      display: flex;
      align-items: center;
      gap: 0.35em;
      padding: 0.4em 0.55em;
      padding-bottom: 0.385rem;
      border-radius: 6px;
      font-weight: 500;
      line-height: 1;
      letter-spacing: 0.0125rem;
      font-size: 0.99em;
      text-align: left;

      color: #210e1f;
      font-family: system-ui;
      -webkit-font-smoothing: antialiased;
      cursor: pointer;

      --highlight-color: #2497e9;

      &:hover,
      &:focus {
        background: var(--highlight-color);
        color: #fff;
        outline: none;
      }

      &:disabled {
        opacity: 45%;

        &:hover {
          cursor: not-allowed;
          background: inherit;
          color: inherit;
        }
      }

      & * {
        pointer-events: none;
      }

      &.danger {
        --highlight-color: #ff4d4f;
      }

      svg {
        color: currentColor;
      }
    }

    hr {
      margin-inline: 1.2ch;
      margin-block: 0.25rem;
      border-top: 0.07rem solid rgba(0, 0, 0, 0.15);
    }
  }
</style>
