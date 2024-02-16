<script lang="ts">
  import Icon from '@horizon/core/src/lib/components/Icons/Icon.svelte'

  export let active: boolean
  export let name: string
  export let type: string
  export let inputValue: string
  export let adblockerState: boolean
</script>

<div class="toolbar-item" class:active>
  {#if type == 'adblock'}
    <div class="item-adblock">
      <span class="input-value">{name}</span>
      {#if adblockerState}
        <Icon name="adblockon" />
      {:else}
        <Icon name="adblockoff" />
      {/if}
    </div>
  {:else if type == 'search'}
    <div class="item-search">
      <span class="input-value">{inputValue}</span>
      <span class="service">{name}</span>
    </div>
  {:else}
    {name}
  {/if}
</div>

<style lang="scss">
  .toolbar-item {
    margin: 0;
    padding: 0.75rem 0.5rem;
    font-size: 14px;
    border-radius: 4px;
    &.active {
      color: #ffffff;
      background: #f73b95;

      .item-adblock {
        color: initial;
        path {
          stroke: red !important;
          fill: red !important;
        }
      }
    }
  }

  .item-search {
    display: flex;
    justify-content: space-between;
  }
  .input-value  {
    padding-right: 1rem;
    margin-right: 1rem;
  }

  .item-adblock {
    display: flex;
    justify-content: space-between;
  }

  .service {
    display: flex;
    align-items: center;
    justify-content: end;
    width: 8rem;
    min-width: 8rem;
  }
</style>
