<script lang="ts">
  import { Icon } from '@deta/icons'
  import { Button } from '@deta/ui'
  import { type Snippet } from 'svelte'

  let {
    title,
    open = false,
    children,
    ...restProps
  }: { title: string; open: boolean; children: Snippet } = $props()
  let _open = $state(open)

  $effect(() => (_open = open))
</script>

<section {...restProps} class="pb {restProps['class'] ?? ''}" class:open={_open}>
  <header onclick={() => (_open = !_open)}>
    <span>
      <!--{#if !_open}<span class="typo-title-sm">+5</span>{/if}-->
      <div class="icon">
        <Icon name="chevron.down" size="1em" />
      </div>
    </span>
    <label>{title}</label>
  </header>

  <div class="content px" class:open={_open}>
    {@render children?.()}
  </div>
  <!--<Button size="md" onclick={() => (open = !open)}>{open ? 'Hide' : 'Show'} All</Button>
  -->
</section>

<style lang="scss">
  section {
    display: flex;
    flex-direction: column;
    flex-shrink: 1;
    flex-grow: 1;

    width: 100%;
    height: 100%;

    > header {
      display: flex;
      //justify-content: space-between;
      gap: 0.25ch;
      align-items: center;
      padding: 0.4rem 0.5rem;
      margin-bottom: 0.25rem;

      border-radius: 8px;

      &:hover {
        background: rgba(0, 0, 0, 0.05);
      }

      > label {
        color: var(--text-color);
        leading-trim: both;
        text-edge: cap;
        font-family: Inter;
        font-size: 0.75rem;
        font-style: normal;
        font-weight: 500;
        line-height: 0.9355rem; /* 124.736% */
        opacity: 0.5;
      }

      > span {
        display: flex;
        align-items: center;
        gap: 0.5ch;
        opacity: 0.5;

        > span {
          font-size: 0.85em;
          leading-trim: both;
          text-edge: cap;
        }
      }

      .icon {
        transition: rotate 100ms ease-out;
        rotate: 0deg;
      }
    }

    &:not(.open) {
      .content {
        max-height: var(--closed-height, 20rem);
        overflow: hidden;

        mask-image: linear-gradient(to bottom, #000 80%, #00000000 100%);
      }
      .icon {
        rotate: -90deg;
      }
    }

    .content {
      padding-block: 5px;
    }
  }

  .hstack {
    display: flex;
    align-items: center;
  }
  .px {
    padding-inline: 16px;
  }
  .py {
    padding-block: 12px;
  }
  .pt {
    padding-top: 12px;
  }
  .pb {
    padding-bottom: 32px;
  }
</style>
