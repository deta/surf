<script lang="ts">
  import { Icon } from '@horizon/icons'
  import type { OasisSpace } from '@horizon/core/src/lib/service/oasis'
  import SpaceIcon from '../SpaceIcon.svelte'
  import type { SelectItem } from '.'

  export let item: SelectItem

  $: space = item.data as OasisSpace | undefined
  $: spaceData = space?.data
</script>

<div class="item">
  <div class="icon">
    {#if space}
      <SpaceIcon folder={space} interactive={false} />
    {:else if item.icon}
      <Icon name={item.icon} />
    {/if}
  </div>

  <div class="name">
    {$spaceData ? $spaceData.folderName : item.label}
  </div>
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
    overflow: hidden;
    text-overflow: ellipsis;
    font-size: 1rem;
    font-weight: 400;
  }
</style>
