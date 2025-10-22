<script lang="ts">
    import type { Snippet } from 'svelte'
    import { DynamicIcon } from '@deta/icons'
    import { DropdownMenu } from 'bits-ui'
    
    import type { DropdownItem, DropdownItemAction } from './dropdown.types'

    let {
        triggerText = '',
        triggerIcon = '',
        items,
        disabled = false,
        side = 'bottom',
        align = 'start',
        subSide = 'right',
        subAlign = 'start',
        children,
        open = $bindable(false)
    }: {
        triggerText?: string,
        triggerIcon?: string,
        items: DropdownItem[]
        disabled?: boolean,
        side?: 'top' | 'right' | 'bottom' | 'left',
        align?: 'start' | 'center' | 'end',
        subSide?: 'top' | 'right' | 'bottom' | 'left',
        subAlign?: 'start' | 'center' | 'end',
        children?: Snippet
        open?: boolean
    } = $props()

    const handleItemClick = (item: DropdownItemAction) => {
        if (item.disabled) return;

        if (item.action) {
            item.action()
        }
    }
</script>

{#snippet DropdownItem(item: DropdownItemAction)}
  {#if item.type === 'separator'}
    <DropdownMenu.Separator class="tool-separator" />
  {:else if item.type === 'title'}
    {#if item.topSeparator}
      <DropdownMenu.Separator class="tool-separator" />
    {/if}
    <div class="tools-item-wrapper" data-disabled style="padding: 0.25rem 0.3rem; cursor: default;">
        <div class="tools-item" style="justify-content: left;">
            <span style="font-weight: 400; font-size: 0.85rem;">{item.label}</span>
        </div>
    </div>
    {#if item.bottomSeparator}
      <DropdownMenu.Separator class="tool-separator" />
    {/if}
	{:else if item.subItems && item.subItems.length > 0}
    <DropdownMenu.Sub>
      <DropdownMenu.SubTrigger class="tools-item-wrapper">
          <div class="tools-item">
              <div class="tool-info">
                  {#if item.icon}
                      <DynamicIcon name={item.icon} size="16px" />
                  {/if}
                  <span>{item.label}</span>
              </div>

              <DynamicIcon name="chevron.right" size="12px" />
          </div>
      </DropdownMenu.SubTrigger>
      <DropdownMenu.SubContent class="tools-dropdown" side={subSide} align={subAlign} sideOffset={5}>
        {#each item.subItems as subItem (subItem.id)}
          {@render DropdownItem(subItem)}
        {/each}
      </DropdownMenu.SubContent>
    </DropdownMenu.Sub>     
  {:else}
    {#if item.topSeparator}
      <DropdownMenu.Separator class="tool-separator" />
    {/if}

    <DropdownMenu.Item class="tools-item-wrapper" onclick={() => handleItemClick(item)} closeOnSelect={item.type !== 'checkbox'} disabled={item.disabled}>
      <div class="tools-item">
          <div class="tool-info">
              {#if item.icon}
                  <DynamicIcon name={item.icon} size="16px" />
              {/if}
              <span>{item.label}</span>
          </div>

          {#if item.disabled && item.disabledLabel}
              <span class="tool-disabled">{item.disabledLabel}</span>
          {:else if item.type === 'checkbox'}
              <!-- svelte-ignore a11y_consider_explicit_label -->
              <button
                  class="tool-toggle {item.checked ? 'active' : ''}"
                  disabled={item.disabled}
              >
                  <div class="toggle-track">
                  <div class="toggle-thumb"></div>
                  </div>
              </button>
          {:else if item.rightLabel || item.rightIcon}
              <div class="tool-info">
                  {#if item.rightLabel}
                      <span class="tool-info-small">{item.rightLabel}</span>
                  {/if}
                  {#if item.rightIcon}
                      <DynamicIcon name={item.rightIcon} size="16px" />
                  {/if}
              </div>
          {/if}
      </div>

      {#if item.description}
          <p class="tools-description">{item.description}</p>
      {/if}
    </DropdownMenu.Item>

    {#if item.bottomSeparator}
      <DropdownMenu.Separator class="tool-separator" />
    {/if}
  {/if}
{/snippet}

  <DropdownMenu.Root bind:open={open}>
    <DropdownMenu.Trigger {disabled}>
        {#if children}
            {@render children()}
        {:else}
            <div class="tools-trigger">
                {#if triggerIcon}
                    <DynamicIcon name={triggerIcon} size="14" />
                {/if}
                <span>{triggerText}</span>
            </div>
        {/if}
    </DropdownMenu.Trigger>
    <DropdownMenu.Content class="tools-dropdown" side={side} align={align} sideOffset={5} zI>
      {#each items as item, idx (item?.id || `${item.type}-${idx}`)}
        {@render DropdownItem(item)}
      {/each}
    </DropdownMenu.Content>
  </DropdownMenu.Root>

<style lang="scss">
  :global(.tools-trigger) {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.25rem 0.5rem;
    border-radius: 9px;
    background: transparent;
    color: light-dark(#808794, var(--on-surface-muted-dark, #94a3b8));
    font-size: 13px;
    cursor: pointer;
    border: none;
    outline: none;
    opacity: 0.75;
    transition: background-color 150ms ease-out, opacity 150ms ease-out;

    &:hover:not(:disabled) {
      background: light-dark(#f3f5ff, var(--accent-background-dark, #1e2639));
      color: light-dark(#6d82ff, var(--accent-dark, #8192ff));
      opacity: 1;
    }

    &:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }
  }

  :global(.tools-dropdown) {
    min-width: 220px;
    background: light-dark(#fff, var(--surface-elevated-dark, #1b2435));
    border-radius: 12px;
    border: 1px solid
      light-dark(#e4e7ec, var(--border-subtle-dark, rgba(71, 85, 105, 0.4)));
    padding: 0.3rem;
    box-shadow: 0 2px 10px
      light-dark(var(--shadow-soft, rgba(0, 0, 0, 0.1)), var(--shadow-soft-dark, rgba(15, 23, 42, 0.45)));
    max-width: 300px;
    outline: none;
    z-index: 1000;

    &:focus, &:active {
      outline: none;
    }
  }

  :global(.tools-item-wrapper) {
    display: flex;
    flex-direction: column;
    gap: 0.1rem;
    padding: 0.25rem 0.3rem;
    border-radius: 6px;
    cursor: default;
    outline: none;
    color: light-dark(var(--on-surface, #374151), var(--on-surface-dark, #cbd5f5));

    &:focus {
      outline: none;
    }

    &:active {
      outline: none;
    }

    &:focus-within {
      outline: none;
    }

    &:hover {
      background: light-dark(#f3f5ff, var(--accent-background-dark, #1e2639));
    }
  }

  :global(.tools-item) {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;

    &:focus {
      outline: none;
    }

    &:active {
      outline: none;
    }

    &:focus-within {
      outline: none;
    }
  }

  :global(.tools-item-wrapper[data-disabled]) {
    opacity: 0.6;

    &:hover {
      background: transparent;
    }
  }

  :global(.tool-separator) {
    margin: 0.25rem 0;
    border-top: 1px solid
      light-dark(#e4e7ec, var(--border-subtle-dark, rgba(71, 85, 105, 0.4)));
  }

  .tool-info {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    font-size: 14px;
    overflow: hidden;
    color: light-dark(var(--on-surface, #374151), var(--on-surface-dark, #cbd5f5));

    span {
      white-space: nowrap;
      text-overflow: ellipsis;
      overflow: hidden;
      color: inherit;
    }
  }

  .tool-info-small {
    font-size: 0.75rem;
    font-weight: 400;
    color: light-dark(#6b7280, var(--text-subtle-dark, #94a3b8));
  }

  .tools-description {
    font-size: 13px;
    color: light-dark(#6b7280, var(--text-subtle-dark, #94a3b8));
    margin-top: 0.15rem;
    margin-bottom: 0.2rem;
    line-height: 1.2;
  }

  .tool-disabled {
    font-size: 14px;
    color: light-dark(#9ca3af, var(--text-subtle-dark, #94a3b8));
  }

  .tool-toggle {
    background: none;
    border: none;
    padding: 0;
    cursor: default;
    outline: none;

    &:focus, &:active {
      outline: none;
    }
    
    &:disabled {
      opacity: 0.4;
    }
  }

  .toggle-track {
    width: 32px;
    height: 18px;
    background: light-dark(#e4e7ec, var(--border-subtle-dark, rgba(71, 85, 105, 0.4)));
    border-radius: 12px;
    padding: 2px;
    transition: background-color 0.2s;

    .toggle-thumb {
      width: 14px;
      height: 14px;
      background: light-dark(#fff, var(--on-app-background-dark, #e5edff));
      border-radius: 50%;
      transition: transform 0.2s;
    }
  }

  .tool-toggle.active {
    .toggle-track {
      background: light-dark(#6d82ff, var(--accent-dark, #8192ff));

      .toggle-thumb {
        transform: translateX(14px);
      }
    }
  }
</style>
