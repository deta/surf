<script lang="ts">
  import { DynamicIcon } from '@deta/icons'

  export let space: any

  const items = [
    {
      label: 'Website',
      icon: 'favicon;;https://deta.surf'
    },
    {
      label: 'Image',
      icon: 'image;;https://upload.wikimedia.org/wikipedia/commons/thumb/b/bc/Arpanet_map_1973.jpg/440px-Arpanet_map_1973.jpg'
    },
    {
      label: 'Emoji',
      icon: 'emoji;;🚀'
    },
    {
      label: 'Colors',
      icon: 'colors;;#FF0000;;#00FF00'
    },
    {
      label: 'Icon',
      icon: 'icon;;check'
    },
    {
      label: 'Space',
      icon: space.getIconString()
    }
  ]
</script>

<div class="list">
  {#each items as item, i (item.label)}
    <div class="item">
      {#if item.icon}
        <DynamicIcon name={item.icon} size="16px" />
      {/if}

      <div>
        {item.label}
      </div>
    </div>
  {/each}
</div>

<style lang="scss">
  .list {
    display: flex;
    flex-wrap: wrap;
    gap: 1em;
  }

  .item {
    display: flex;
    gap: 0.75em;
    align-items: center;
  }
</style>
