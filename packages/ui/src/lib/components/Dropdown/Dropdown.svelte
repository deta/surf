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
        children
    }: {
        triggerText?: string,
        triggerIcon?: string,
        items: DropdownItem[]
        disabled?: boolean,
        side?: 'top' | 'right' | 'bottom' | 'left',
        align?: 'start' | 'center' | 'end',
        children?: Snippet
    } = $props()

    const handleItemClick = (item: DropdownItemAction) => {
        if (item.disabled) return;

        if (item.action) {
            item.action()
        }
    }
</script>

{#snippet DropdownItem(item: DropdownItemAction)}
	{#if item.subItems && item.subItems.length > 0}
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
            <DropdownMenu.SubContent class="tools-dropdown" side={side} align={align} sideOffset={5}>
              {#each item.subItems as subItem (subItem.id)}
                {@render DropdownItem(subItem)}
              {/each}
            </DropdownMenu.SubContent>
          </DropdownMenu.Sub>     
        {:else}
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
                {/if}
            </div>

            {#if item.description}
                <p class="tools-description">{item.description}</p>
            {/if}
          </DropdownMenu.Item>
        {/if}
{/snippet}

  <DropdownMenu.Root>
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
    <DropdownMenu.Content class="tools-dropdown" side={side} align={align} sideOffset={5}>
      {#each items as item, idx (item?.id || `${item.type}-${idx}`)}
        {#if item.type === 'separator'}
          <DropdownMenu.Separator class="tool-separator" />
        {:else}
          {@render DropdownItem(item)}
        {/if}
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
    color: #808794;
    font-size: 13px;
    cursor: pointer;
    border: none;
    outline: none;
    opacity: 0.75;
    transition: background-color 150ms ease-out, opacity 150ms ease-out;

    &:hover:not(:disabled) {
      background: #f3f5ff;
      color: #6d82ff;
      opacity: 1;
    }

    &:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }
  }

  :global(.tools-dropdown) {
    min-width: 220px;
    background: white;
    border-radius: 12px;
    border: 1px solid #e4e7ec;
    padding: 0.3rem;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
    max-width: 300px;
    outline: none;

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
      background: #f3f5ff;
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
    border-top: 1px solid #e4e7ec;
  }

  .tool-info {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    font-size: 14px;
  }

  .tools-description {
    font-size: 13px;
    color: #6b7280;
    margin-top: 0.15rem;
    line-height: 1.2;
  }

  .tool-disabled {
    font-size: 14px;
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
    background: #e4e7ec;
    border-radius: 12px;
    padding: 2px;
    transition: background-color 0.2s;

    .toggle-thumb {
      width: 14px;
      height: 14px;
      background: white;
      border-radius: 50%;
      transition: transform 0.2s;
    }
  }

  .tool-toggle.active {
    .toggle-track {
      background: #6d82ff;

      .toggle-thumb {
        transform: translateX(14px);
      }
    }
  }
</style>
