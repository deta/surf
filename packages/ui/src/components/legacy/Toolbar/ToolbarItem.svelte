<script lang="ts">
  import { afterUpdate } from 'svelte'
  import { writable } from 'svelte/store'
  import { generateRootDomain } from '@deta/utils'

  import { Icon } from '@deta/icons'

  export let active: boolean
  export let name: string
  export let type: string
  export let inputValue: string
  export let index: number
  export let url: string
  export let group: string
  export let searchQuery: string = ''

  const isOverflowing = writable(false)

  let element: HTMLElement

  function checkOverflow(node: HTMLElement) {
    if (node.parentElement) {
      isOverflowing.set(node.parentElement?.scrollWidth > node.clientWidth)
    }
  }

  afterUpdate(() => {
    const titleElements = element?.querySelectorAll('.title-wrapper .title')
    titleElements?.forEach((element) => checkOverflow(element as HTMLElement))
  })
</script>

<div class="toolbar-item" data-index={index} class:active bind:this={element}>
  {#if type == 'return'}
    <div class="item-return" class:disabled={!url}>
      <div class="icon-wrapper">
        <Icon name="arrowbackup" color={active ? '#ffffff' : '#e173a8'} />
      </div>
      {name}
    </div>
  {/if}

  {#if group == 'Search'}
    <div class="item-search">
      <div class="title-wrapper">
        <div class="title" class:scrolling={$isOverflowing} use:checkOverflow>
          {searchQuery || inputValue}
        </div>
      </div>
      <div class="right">
        <span class="service">{name}</span>
        <div class="icon-wrapper">
          <Icon name="search" color={active ? '#FFFFFF' : '#e173a8'} />
        </div>
      </div>
    </div>
  {:else if group == 'Chat'}
    <div class="item-search">
      <div class="title-wrapper">
        <div class="title" class:scrolling={$isOverflowing} use:checkOverflow>
          {searchQuery || inputValue}
        </div>
      </div>
      <div class="right">
        <span class="service">{name}</span>
        <div class="icon-wrapper">
          <Icon name="sparkles" color={active ? '#FFFFFF' : '#e173a8'} />
        </div>
      </div>
    </div>
  {:else if group == 'History'}
    <div class="item-history">
      <div class="title-wrapper">
        <div class="title" class:scrolling={$isOverflowing} use:checkOverflow>
          {name}
        </div>
      </div>
      <div class="right">
        <div class="url-string">
          {generateRootDomain(url)}
        </div>
        <div class="icon-wrapper">
          <Icon name="arrow" color={active ? '#FFFFFF' : '#000000'} />
        </div>
      </div>
    </div>
  {:else if group == 'Direct'}
    <div class="item-search">
      <div class="title-wrapper">
        <div class="title" class:scrolling={$isOverflowing} use:checkOverflow>
          {name}
        </div>
      </div>
      <div class="right">
        <div class="service">Open Directly</div>
        <div class="icon-wrapper">
          <Icon name="arrow" color={active ? '#FFFFFF' : '#e173a8'} />
        </div>
      </div>
    </div>
  {/if}
</div>

<style lang="scss">
  .toolbar-item {
    margin: 0;
    padding: 0.65rem 0.5rem;
    font-size: 14px;
    border-radius: 4px;
    &:hover {
      background: #fdd8ea;
    }

    .item-return {
      display: flex;
      align-items: center;
      justify-content: center;
      color: #e173a8;
      .icon-wrapper {
        display: flex;
        align-items: center;
        justify-content: center;
      }
    }
    &.active {
      color: #ffffff;
      background: #f73b95;

      .icon-wrapper {
        opacity: 1;
      }

      .item-return {
        display: flex;
        color: #ffffff;
      }

      .item-return,
      .item-history {
        * {
          color: #ffffff;
          opacity: 1;
        }
      }
      .item-search {
        .right {
          color: #ffffff;
        }
      }

      .item-history .url-string {
        opacity: 1;
      }

      .item-history > .right > .icon-wrapper {
        opacity: 1;
      }

      .item-history {
        @keyframes scroll-text {
          0% {
            transform: translateX(0);
          }
          100% {
            transform: translateX(-100%);
          }
        }

        display: flex;
      }

      .title-wrapper {
        .title {
          &.scrolling {
            overflow: visible;
            white-space: nowrap;
            animation: scroll-text 10s linear infinite;
            animation-delay: 800ms;
          }
        }
      }
    }

    .title-wrapper {
      flex-grow: 1;
      flex-shrink: 1;
      flex-basis: 100%; // Adjust this value based on your design needs
      overflow: hidden; // Hide overflow
      -webkit-mask-image: linear-gradient(to right, #000 95%, transparent 100%);
      .title {
        display: flex;
        white-space: nowrap;
        overflow: visible;
        padding: 0 1rem 0 0;
      }
    }
  }

  .item-search,
  .item-history {
    display: flex !important;
    align-items: center;
    justify-content: space-between;
  }

  .item-return,
  .item-history {
    padding: 0.125rem 0;
  }

  .item-search {
    .right {
      display: flex;
      gap: 4px;
      justify-content: center;
      align-items: center;
      color: #e173a8;
      .icon-wrapper {
        display: flex;
        align-items: center;
        justify-content: center;
      }
    }
  }

  .item-history {
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    width: 100%; // Ensure the container fills its parent

    .right {
      flex-grow: 0; // Do not grow beyond content size
      flex-shrink: 0; // Optional: change to 1 if you want it to be able to shrink
      flex-basis: auto; // Basis size based on content size
      display: flex;
      align-items: center;
      justify-content: flex-end;

      .icon-wrapper {
        opacity: 0.15;
      }

      display: flex;
      align-items: center;
      justify-content: flex-end; // Adjust based on your design preference
      .url-string {
        display: inline-block;
        opacity: 0.6;
        padding: 0 0.5rem 0 0;
      }
    }
  }

  .item-return {
    display: flex;
    gap: 4px;
    align-items: center;
    &.disabled {
      opacity: 0.4;
      pointer-events: none;
    }
  }

  .item-search,
  .item-history {
    .icon-wrapper {
      display: flex;
      align-items: center;
      justify-content: center;
    }
  }

  .service {
    display: flex;
    align-items: center;
    justify-content: end;
    width: 8rem;
    min-width: 8rem;
    white-space: nowrap;
  }
</style>
