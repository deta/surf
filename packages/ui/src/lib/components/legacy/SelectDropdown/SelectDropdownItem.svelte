<script lang="ts">
  import { DynamicIcon, Icon } from '@deta/icons'
  import type { SelectItem } from '.'

  export let item: SelectItem

  $: space = typeof item?.data?.contents !== 'undefined' ? (item.data as any) : undefined

  const getAlternativeLabel = (item: SelectItem) => {
    if (!item.data?.type || item.data.type !== 'context-item') return undefined

    const contextItem = item.data

    if (contextItem.value === `context-item;;active-context`) {
      return 'Active Context'
    } else if (contextItem.value === `context-item;;active-tab`) {
      return 'Active Tab'
    } else {
      return undefined
    }
  }

  $: label = item.label
  $: labelValue = getAlternativeLabel(item) ?? label
</script>

<div class="item">
  <div class="icon">
    {#if space}
      <DynamicIcon name={space.getIconString()} size="sm" />
    {:else if item.iconUrl}
      <img src={item.iconUrl} alt="" class="w-4 h-4" />
    {:else if item.icon}
      <DynamicIcon name={item.icon} size="1rem" />
    {:else}
      <Icon name="file" width="1rem" height="1rem" />
    {/if}
  </div>
  <div class="name">
    {labelValue}
  </div>
  {#if item.description}
    <div class="description">
      <span class="description-text">{item.description}</span>
      {#if item.descriptionIcon}
        <Icon name={item.descriptionIcon} size="1rem" />
      {/if}
    </div>
  {/if}
</div>

<style lang="scss">
  .item {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    position: relative;
    pointer-events: none;
  }

  .icon {
    max-width: 1.25rem;
    max-height: 1.25rem;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .name {
    width: 100%;
    font-size: 0.95rem;
    font-weight: 400;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .description {
    margin-left: auto;
    display: flex;
    align-items: center;
    gap: 0.25rem;
    opacity: 0.75;

    &:hover {
      opacity: 1;
    }
  }

  .description-text {
    font-size: 0.75rem;
    font-weight: 400;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
</style>
