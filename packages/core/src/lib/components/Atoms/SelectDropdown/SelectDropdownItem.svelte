<script lang="ts">
  import { DynamicIcon } from '@horizon/icons'
  import type { OasisSpace } from '@horizon/core/src/lib/service/oasis'
  import SpaceIcon from '../SpaceIcon.svelte'
  import type { SelectItem } from '.'
  import { tooltip } from '@horizon/utils'

  export let item: SelectItem

  $: space = item.data as OasisSpace | undefined
  $: spaceData = space?.data
</script>

<div class="item">
  <div class="icon">
    {#if item.icon}
      <DynamicIcon name={item.icon} />
    {:else if space}
      <SpaceIcon folder={space} interactive={false} />
    {/if}
  </div>

  <div class="name">
    {#if item.label}
      {item.label}
    {:else if $spaceData}
      {$spaceData.folderName}
    {:else}
      {item.id}
    {/if}
  </div>

  {#if item.description || item.descriptionIcon}
    <div class="description">
      {#if item.descriptionIcon}
        <div
          class="icon"
          use:tooltip={{
            text: item.description ?? '',
            disabled: !item.description,
            position: 'left'
          }}
        >
          <DynamicIcon name={item.descriptionIcon} size="16px" />
        </div>
      {/if}

      {#if item.description && !item.descriptionIcon}
        <div class="description-text">{item.description}</div>
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
    font-size: 1rem;
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
