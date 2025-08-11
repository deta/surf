<script lang="ts">
  import { get, writable } from 'svelte/store'
  import { useDesktopManager, type DesktopService } from '../../service/desktop'
  import { useTabsManager } from '../../service/tabs'
  import { OasisSpace, useOasis } from '../../service/oasis'
  import { quadOut } from 'svelte/easing'
  import { fly } from 'svelte/transition'
  import { ChangeContextEventTrigger, OpenHomescreenEventTrigger } from '@deta/types'

  export let desktopId: string // NOTE: This is the same as the space id for now to get the corresponding desktop
  export let willReveal = false

  const tabsManager = useTabsManager()
  const desktopManager = useDesktopManager()
  const oasis = useOasis()
  const spaces = oasis.spaces
  const desktopVisible = desktopManager.activeDesktopVisible
  const activeScopeId = tabsManager.activeScopeId

  let targetDesktop = writable<DesktopService | null>(null)
  let isLoading = true
  desktopManager.useDesktop(desktopId).then((desktop) => {
    $targetDesktop = desktop
    isLoading = false
  })

  const space = $spaces.find((space) => space.id === desktopId)

  const getSpaceName = (space: OasisSpace | undefined) => {
    if (!space) return 'Desktop'
    const spaceData = get(space.data)

    if (space.id === 'all') return 'All my Stuff Desktop'

    if (spaceData.builtIn) return spaceData.folderName + ' Desktop'

    return spaceData.folderName + ' Desktop' || 'Sheesh'
  }
  $: activeSpaceName = getSpaceName(space)

  const showNewTabOverlay = tabsManager.showNewTabOverlay

  let innerWidth: number
  let innerHeight: number
  let previewWidth: number

  $: items = $targetDesktop?.items

  $: SCALING_FACTOR = previewWidth / innerWidth
</script>

<svelte:window bind:innerWidth bind:innerHeight />

{#key $showNewTabOverlay}
  {#if !willReveal || !$desktopVisible}
    <div class={`desktop-preview-container ${willReveal ? 'desktop-preview-hitarea' : ''}`}>
      {#if !willReveal}
        <div class="context-pill">
          {activeSpaceName}
        </div>
      {/if}
      <div
        class={`desktop-preview ${willReveal ? 'anchor' : ''}`}
        style={`background-image: var(--background-image) !important; aspect-ratio: ${innerWidth} / ${innerHeight};`}
        bind:clientWidth={previewWidth}
        in:fly={{ y: 12, delay: 5, easing: quadOut }}
        on:click={async () => {
          if ($activeScopeId === desktopId) {
            desktopManager.setVisible(true, { trigger: OpenHomescreenEventTrigger.CommandMenu })
            showNewTabOverlay.set(0)
          } else {
            await tabsManager.changeScope(desktopId, ChangeContextEventTrigger.SpaceInOasis)
            desktopManager.setVisible(true, { trigger: OpenHomescreenEventTrigger.CommandMenu })
            showNewTabOverlay.set(0)
          }
        }}
        aria-hidden="true"
      >
        <div class="show-desktop-label">
          <div class="create-desktop-label">
            <span>Desktop</span>
          </div>
        </div>

        {#if isLoading}
          <div class="loading"></div>
        {:else}
          <div style="isolation: isolate;">
            {#if $items && $targetDesktop}
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
        {/if}
      </div>
    </div>
  {/if}
{/key}

<style lang="scss">
  @use '@horizon/core/src/lib/styles/motion' as motion;

  .desktop-preview-container {
    width: fit-content;
    height: fit-content;
    background: transparent;
  }

  .desktop-preview-hitarea {
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
    outline: 3px solid var(--contrast-color);
    border-radius: 18px;

    &:hover .show-desktop-label {
      background: rgba(255, 255, 255, 0.2);
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
      opacity: 1;
    }

    .desktop-preview-hitarea & {
      transform: rotate(-0.5deg) translateX(-60%) translateY(0) scale(0.85);
      transition: transform motion.$precise-motion;

      &:hover {
        transform: translate3d(15%, -5px, 0.5rem) scale(1.0025) rotate(0.33deg);
      }
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
    padding: 2px 5px;
    border-radius: 16px;
    font-size: 11px;
    white-space: pre;
    font-weight: 500;
    opacity: 0;
    transition: opacity motion.$precise-motion;
    z-index: 2;
    cursor: default;
  }

  .create-desktop-label {
    display: flex;
    align-items: center;
    gap: 2px;
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
