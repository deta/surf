<script lang="ts">
  import { Icon } from '@horizon/icons'
  import { closeContextMenu, type CtxItem } from './ContextMenu.svelte'
  import { onMount, tick } from 'svelte'
  import ColorIcon from '../Atoms/ColorIcon.svelte'
  import { OasisSpace } from '@horizon/core/src/lib/service/oasis'
  import SpaceIcon from '../Atoms/SpaceIcon.svelte'

  export let items: CtxItem[]
  export let subMenuRef: string | undefined = undefined

  let anchor: 'left' | 'right' = 'right'
  let subMenuYOffset = 0

  onMount(async () => {
    if (subMenuRef !== undefined) {
      await tick()
      const subMenu = document.querySelector(
        `.sub-menu[data-sub-menu-ref="${subMenuRef}"]`
      ) as HTMLElement
      const box = subMenu?.getBoundingClientRect()

      subMenu.classList.add('hidden')

      if (box.left + box.width > window.innerWidth) {
        anchor = 'left'
      }
      if (box.top + box.height > window.innerHeight) {
        subMenuYOffset = window.innerHeight - (box.top + box.height)
      }
    }
  })
</script>

<ul
  class:sub-menu={subMenuRef !== undefined}
  data-sub-menu-ref={subMenuRef}
  class:sub-items={subMenuRef !== undefined}
  class:anchor-left={anchor === 'left'}
  style={subMenuRef !== undefined
    ? `position:fixed; --sub-id: --sub-${subMenuRef}; --y-offset: ${subMenuYOffset}px;`
    : ''}
>
  {#each items as item, i}
    {#if item !== undefined && item.hidden !== true}
      {#if item.type === 'separator'}
        <hr />
      {:else if item.type === 'action'}
        <button
          type="submit"
          on:click={() => {
            if (item.action) item.action()
          }}
          class:danger={item.kind === 'danger'}
          disabled={item.disabled}
        >
          {#if item.icon}
            {#if typeof item.icon === 'string'}
              <Icon name={item.icon} size="1.2em" />
            {:else if Array.isArray(item.icon)}
              <ColorIcon colors={item.icon} size="1.1em" />
            {:else if item.icon instanceof OasisSpace}
              <div class="space-icon">
                <SpaceIcon folder={item.icon} interactive={false} size="sm" />
              </div>
            {/if}
          {/if}
          <span class="truncate" style="flex: 1; width:100%; max-width: 20ch;">{item.text}</span>
        </button>
      {:else if item.type === 'sub-menu'}
        <li class="sub-item" style="anchor-name: --sub-{i};">
          {#if item.icon}
            {#if typeof item.icon === 'string'}
              <Icon name={item.icon} size="1.2em" />
            {:else if Array.isArray(item.icon)}
              <ColorIcon colors={item.icon} size="1.1em" />
            {:else if item.icon instanceof OasisSpace}
              <div class="space-icon">
                <SpaceIcon folder={item.icon} interactive={false} size="sm" />
              </div>
            {/if}
          {/if}
          <span style="flex: 1; width:100%;">{item.text} </span>
          <Icon name="chevron.right" size="1.2em" style="align-self: flex-end;" />
        </li>
        <svelte:self items={item.items} subMenuRef={`${i}`} />
      {/if}
    {/if}
  {/each}
</ul>

<style lang="scss">
  // Safe are experiment
  /*@keyframes clip {
    from {
      visibility: visible;
    }
    99% {
    }
    100% {
      visibility: hidden;
    }
  }*/

  /* NOTE: We only support a single sub-menu right now with this crude css */
  ul.sub-menu {
    height: fit-content;
    max-height: 24.5ch;
    overflow-y: auto;
    background: var(--ctx-background);
    padding: 0.25rem;
    border-radius: 9px;
    border: 0.5px solid var(--ctx-border);
    box-shadow: 0 2px 10px var(--ctx-shadow-color);
    user-select: none;
    position-anchor: var(--sub-id);

    margin: 0px;

    /* Safe area experiment 
    &::before {
      content: '';
      position: fixed;
      position-anchor: var(--sub-id);
      top: anchor(start);
      left: anchor(start);
      right: anchor(end);
      height: 100%;
      background: rgba(0, 0, 0, 0.25);
      clip-path: polygon(0 0, 100% 100%, 100% 0);

      //animation: clip 0.1s forwards;
    }
    */
    :global(&.hidden) {
      display: none;
    }

    &:not(.anchor-left) {
      top: anchor(top);
      transform: translateY(var(--y-offset));
      left: anchor(right);
      margin-left: -3px;
    }

    &.anchor-left {
      top: anchor(top);
      transform: translateY(var(--y-offset));
      right: anchor(left);
      left: unset;
      margin-right: -3px;
    }
  }
  ul.sub-menu:hover {
    display: flex;
  }
  :global(ul:has(li.sub-item:hover) .sub-menu) {
    display: flex;
  }
  :global(ul:has(.sub-menu:hover) .sub-item) {
    background: var(--ctx-item-submenu-open);
  }

  ul {
    width: auto;
    flex-direction: column;
    &:not(.sub-menu) {
      display: flex;
    }

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

      color: var(--ctx-item-text);
      font-family: system-ui;
      -webkit-font-smoothing: antialiased;
      cursor: pointer;

      &:hover {
        background: var(--ctx-item-hover);
        color: var(--ctx-item-text-hover);
        outline: none;
      }
      &:focus {
        // FIX: This should share with :hover, buut
        // html autofocus the first element, so it looks weird and doesnt go away
        // when using the mouse
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
        --ctx-item-hover: var(--ctx-item-danger-hover);
      }

      :global(svg) {
        color: currentColor;
      }
    }

    hr {
      margin-inline: 1.2ch;
      margin-block: 0.25rem;
      border-top: 0.07rem solid rgba(0, 0, 0, 0.15);
    }
  }

  .space-icon {
    width: 1.1em;
    height: 1.1em;
    display: flex;
    align-items: center;
    justify-content: center;
  }
</style>
