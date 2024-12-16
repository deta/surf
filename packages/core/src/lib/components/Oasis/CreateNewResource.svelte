<script lang="ts">
  import { createEventDispatcher } from 'svelte'
  import { fly } from 'svelte/transition'
  import { Icon } from '@horizon/icons'
  import Create from './Create.svelte'
  import { SERVICES } from '@horizon/web-parser'
  import type { ResourceManager } from '../../service/resources'

  const dispatch = createEventDispatcher<{ 'open-and-create-resource': string }>()

  let showBrowserHomescreen: boolean = true

  function handleClick(url: string | undefined) {
    url = url || 'invalid url'
    dispatch('open-and-create-resource', url)
  }
</script>

{#if showBrowserHomescreen}
  <div class="browser-homescreen">
    <div class="homescreen-content">
      <div class="section">
        <h2 class="subheadline">Create</h2>
        <div class="vertical-list">
          {#each SERVICES.filter((e) => e.showBrowserAction === true) as item, i (i)}
            <div
              class="create-trigger"
              on:click|preventDefault={() => handleClick(item.browserActionUrl)}
              aria-hidden="true"
            >
              <Create service={item.id} index={i} />
            </div>
          {/each}
        </div>
      </div>
    </div>
  </div>
{/if}

<style lang="scss">
  .browser-homescreen {
    width: 40rem;
    max-width: 40rem;
    max-height: 30rem;
    height: auto;
    border: 0.5px solid rgba(255, 255, 255, 0.4);
    background: rgba(255, 255, 255, 0.98);
    backdrop-filter: blur(12px);
    border-radius: 12px;
    overflow-y: scroll;
    box-shadow:
      0px 0px 0px 1px rgba(0, 0, 0, 0.2),
      0px 16.479px 41.197px 0px rgba(0, 0, 0, 0.46);

    .homescreen-content {
      display: flex;
      flex-direction: column;
      gap: 2rem;
      margin: 0 auto;
      width: 100%;
      max-width: 50rem;
      padding: 2rem 2rem 4rem 2rem;

      h2.subheadline {
        font-size: 1.25rem;
        font-weight: 500;
        opacity: 0.75;
        padding: 0 0 0.75rem 0;
      }

      .vertical-list {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(10rem, 1fr));
        gap: 1rem;
      }

      .create-trigger {
        display: flex;
        align-items: center;
        padding: 1rem;
        border-radius: 8px;
        transition: background 0.2s ease-in-out;

        &:hover {
          background: #f0f0f0;
        }
      }
    }
  }
</style>
