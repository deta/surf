<script lang="ts">
  import type { Readable } from 'svelte/store'
  import { get } from 'svelte/store'
  import { derived } from 'svelte/store'
  import { DesktopService, useDesktopManager } from '../../service/desktop'
  import { useTabsManager } from '../../service/tabs'
  import { useOasis } from '../../service/oasis'
  import { quadOut } from 'svelte/easing'
  import { fly } from 'svelte/transition'
  import HomescreenItem from '../Oasis/homescreen/HomescreenItem.svelte'
  import { OpenHomescreenEventTrigger } from '@horizon/types'
  import { Icon } from '@horizon/icons'

  export let backgroundImage: Readable<{ path: string; customColors: unknown[] }>

  const tabsManager = useTabsManager()
  const desktopManager = useDesktopManager()
  const oasis = useOasis()
  const activeDesktop = desktopManager.activeDesktop
  const desktopVisible = desktopManager.activeDesktopVisible

  const activeSpace = derived([oasis.spaces, activeDesktop], ([$spaces, $activeDesktop]) => {
    if (!$activeDesktop) return null
    return $spaces.find((space) => space.id === $activeDesktop.id)
  })

  const activeSpaceName = derived(activeSpace, ($space) => {
    if (!$space) return 'Desktop'
    const spaceData = get($space.data)

    if ($space.id === 'all') return 'All my Stuff Desktop'

    if (spaceData.builtIn) return spaceData.folderName + ' Desktop'

    return spaceData.folderName + ' Desktop' || 'Sheesh'
  })

  const showNewTabOverlay = tabsManager.showNewTabOverlay

  let innerWidth: number
  let innerHeight: number
  let previewWidth: number

  $: items = $activeDesktop?.items

  $: SCALING_FACTOR = previewWidth / innerWidth
</script>

<svelte:window bind:innerWidth bind:innerHeight />

{#key $showNewTabOverlay}
  {#if !$desktopVisible}
    <div class="desktop-preview-hitarea">
      <div class="context-pill">
        {$activeSpaceName}
      </div>
      <div
        class="desktop-preview anchor"
        style={`background-image: ${$backgroundImage?.path}; aspect-ratio: ${innerWidth} / ${innerHeight};`}
        bind:clientWidth={previewWidth}
        in:fly={{ y: 12, delay: 5, easing: quadOut }}
        on:click={() => {
          desktopManager.setVisible(true, { trigger: OpenHomescreenEventTrigger.CommandMenu })
          showNewTabOverlay.set(0)
        }}
        aria-hidden="true"
      >
        <div class="show-desktop-label">
          {#if $items?.length}
            Show Desktop
          {:else}
            <div class="create-desktop-label">
              <Icon name="add" size="16" />
              <span>Create Desktop</span>
            </div>
          {/if}
        </div>
        {#await new Promise((resolve) => {
          setTimeout(resolve, 200)
        })}
          <div class="loading"></div>
        {:then}
          <div style="isolation: isolate;">
            {#if $items && $activeDesktop}
              {#each $items as item}
                <div
                  class="item-wrapper"
                  style={`
                position: absolute;
                display: grid;
                grid-template-columns: 1fr;
                grid-template-rows: 1fr;
                left: ${(get(item).x * 50 + 32) * SCALING_FACTOR}px;
                top: ${(get(item).y * 50 + 32) * SCALING_FACTOR}px;
                width: ${get(item).width * 50}px;
                height: ${get(item).height * 50}px;
                transform-origin: top left;
                transform: scale(${SCALING_FACTOR});
                z-index: ${get(item).z};
              `}
                >
                  <!-- <HomescreenItem desktop={$activeDesktop} {item} interactive={false} /> -->
                </div>
              {/each}
            {/if}
          </div>
        {/await}
      </div>
    </div>
  {/if}
{/key}

<style lang="scss">
  .desktop-preview-hitarea {
    width: fit-content;
    height: fit-content;
    background: transparent;
    transform: translateX(-30px);
    view-transition-name: desktop-preview-hitarea;
    &:hover {
      .desktop-preview {
        outline: 4px solid white;
        transform: translate3d(15%, -5px, 0) scale(1.0025) rotate(0.33deg);
      }
      .show-desktop-label {
        opacity: 1;
      }
      .context-pill {
        opacity: 1;
        transform: translate3d(15%, -0.5rem, 0);
      }
    }
  }

  .desktop-preview {
    isolation: isolate;
    position: relative;
    overflow: hidden;
    height: 13ch;
    border-radius: 20px;
    transform: rotate(-0.5deg) translateX(-60%) translateY(0) scale(0.85);
    outline: 3px solid var(--contrast-color);
    border-radius: 18px;
    background-size: cover;
    transition: transform motion.$precise-motion;

    &:hover {
      transform: translate3d(15%, -5px, 0.5rem) scale(1.0025) rotate(0.33deg);
    }
  }

  .anchor {
    anchor-name: --preview;
  }

  .context-pill {
    position: absolute;
    bottom: anchor(--preview top);
    left: 0;
    right: 0;
    min-width: fit-content;
    text-align: center;
    position-anchor: --preview;
    padding: 4px 12px;
    background-color: rgba(255, 255, 255, 0.9);
    border-radius: 12px;
    font-size: 12px;
    font-weight: 600;
    color: #333;
    opacity: 0;
    transform: translate3d(-45%, -0.5rem, 0);
    transition: transform motion.$precise-motion;
    white-space: nowrap;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    margin-bottom: 8px;
    pointer-events: none;
  }

  .desktop-preview-hitarea:hover .context-pill {
    opacity: 1;
    transform: translate3d(15%, -0.5rem, 0);
  }

  .show-desktop-label {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: rgba(0, 0, 0, 0.7);
    color: white;
    padding: 4px 12px;
    border-radius: 20px;
    font-size: 11px;
    white-space: pre;
    font-weight: 500;
    opacity: 0;
    transition: opacity motion.$precise-motion;
    z-index: 2;
  }

  .create-desktop-label {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .loading {
    width: 100%;
    height: 100%;
    background: rgba(255, 255, 255, 0.25);
  }

  .items-wrapper {
    position: relative;
  }

  .item-wrapper {
    outline: 2px solid var(--contrast-color);
    border-radius: 12px;
    overflow: hidden;
    --background-dark: radial-gradient(
      143.56% 143.56% at 50% -43.39%,
      #eef4ff 0%,
      #ecf3ff 50%,
      #d2e2ff 100%
    );
    --background-dark-p3: radial-gradient(
      143.56% 143.56% at 50% -43.39%,
      color(display-p3 0.9373 0.9569 1) 0%,
      color(display-p3 0.9321 0.9531 1) 50%,
      color(display-p3 0.8349 0.8849 0.9974) 100%
    );

    background: var(--background-dark);
  }
</style>
