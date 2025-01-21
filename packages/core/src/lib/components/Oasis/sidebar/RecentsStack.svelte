<script lang="ts">
  import { DragculaDragEvent, HTMLDragItem, HTMLDragZone } from '@horizon/dragcula'
  import { createEventDispatcher, onDestroy, onMount, tick } from 'svelte'
  import { useOasis } from '../../../service/oasis'
  import { ResourceManager, type ResourceObject } from '../../../service/resources'
  import {
    CreateTabEventTrigger,
    OpenResourceEventFrom,
    ResourceTagsBuiltInKeys,
    ResourceTypes
  } from '@horizon/types'
  import { writable } from 'svelte/store'
  import { isMac, useDebounce } from '@horizon/utils'
  import { useTabsManager } from '../../../service/tabs'
  import { Icon } from '@horizon/icons'
  import { DragTypeNames } from '../../../types'
  import ResourcePreview from '../../Resources/ResourcePreview.svelte'

  export let wasMouseInside = writable(false)
  const dispatch = createEventDispatcher<{
    'open-stuff': void
    Drop: DragculaDragEvent
    'open-resource-in-mini-browser': string
    'update-container-height': string | null
  }>()
  const getRand = () => Math.floor(Math.random() * 100) + 1 - 50
  const getRandX = (i: number, rand: number) => (i % 2 === 0 ? 1 : -1) * rand * 0.14
  const getRandY = (i: number, rand: number) => (i % 2 === 0 ? 1 : -1) * rand * -0.11
  const getRandRot = (i: number, rand: number) => (i % 2 === 0 ? 1 : -1) * rand * 0.26

  const oasis = useOasis()
  const stackKey = oasis.stackKey
  const pendingStackActions = oasis.pendingStackActions
  const resourceManager = oasis.resourceManager
  const tabsManager = useTabsManager()

  const stackCardWidth = 60
  const items = writable<{ resource: ResourceObject; originTabId?: string }[]>([])

  let dragover = false
  let resizeObserver: ResizeObserver | null = null
  let stackEl: HTMLElement
  let availableStackWidth: number = 0
  let sidebarWidth = 0
  let gridColumns = 4
  let containerExpandedHeight: null | number = null
  let randX = getRand()
  let randY = getRand()

  let randsX: number[] = []
  let randsY: number[] = []

  function recalcSizes() {
    const sidebarEl = document.querySelector('#left-sidebar')
    if (!sidebarEl) return
    sidebarWidth = sidebarEl.clientWidth
    availableStackWidth = sidebarEl.clientWidth + 10
    gridColumns = Math.floor(availableStackWidth / stackCardWidth)
    const rowCount = Math.ceil(10 / gridColumns)
    containerExpandedHeight = 50 + rowCount * 60
  }

  let resourceUnsubs = []
  const fetchItems = useDebounce(async () => {
    resourceUnsubs.forEach((sub) => sub())
    const resources = await resourceManager.listResourcesByTags(
      [
        ResourceManager.SearchTagDeleted(false),
        ResourceManager.SearchTagResourceType(ResourceTypes.HISTORY_ENTRY, 'ne'),
        ResourceManager.SearchTagNotExists(ResourceTagsBuiltInKeys.HIDE_IN_EVERYTHING),
        ResourceManager.SearchTagNotExists(ResourceTagsBuiltInKeys.SILENT)
      ],
      { includeAnnotations: false }
    )

    let results = resources
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .map((resource) => {
        return {
          fromOrigin: pendingStackActions.find((e) => e.resourceId === resource.id),
          resource: {
            id: resource.id,
            resource: resource,
            annotations: resource.annotations,
            engine: 'local'
          }
        }
      })
      .slice(0, 10)

    let diff = false
    for (let i = 0; i < results.length; i++) {
      if ($items[i]?.resource.id !== results[i].resource.id) {
        diff = true
        break
      }
    }
    if (results.length <= 0) dispatch('update-container-height', 'auto')
    if (!diff && $items.length !== 0) {
      if (results.length > 0) dispatch('update-container-height', '110px')
      return
    }

    for (const e of results) {
      resourceUnsubs.push(
        e.resource.resource.state?.subscribe((state) => {
          if (state === 'idle') {
            items.update((items) => {
              const index = items.findIndex((item) => item.resource.id === e.resource.id)
              if (index !== -1) {
                items[index].resource = e.resource
              }
              return items
            })
          }
        })
      )
    }
    items.set(results)
    randX = getRand()
    randY = getRand()
    randsX = Array.from({ length: $items.length }, () => getRand())
    randsY = Array.from({ length: $items.length }, () => getRand())
    if (results.length > 0) dispatch('update-container-height', '110px')
  }, 500)

  function originTransition(node: HTMLElement, props: { resourceId: string }) {
    node.classList.add('origin')
    tick().then(() => {
      setTimeout(() => {
        node.classList.remove('origin')
      }, 0)
    })
    return {
      destroy() {},
      update() {}
    }
  }

  onDestroy(
    stackKey.subscribe(() => {
      fetchItems()
    })
  )
  onDestroy(() => {
    const sidebarEl = document.querySelector('#left-sidebar')
    if (!sidebarEl) return
    resizeObserver?.unobserve(sidebarEl)
  })

  onMount(async () => {
    recalcSizes()
    resizeObserver = new ResizeObserver((entries) => {
      recalcSizes()
    })
    resizeObserver.observe(document.querySelector('#left-sidebar') as HTMLElement)

    fetchItems()
  })

  resourceManager.on('created', () => oasis.reloadStack())
  resourceManager.on('deleted', () => oasis.reloadStack())
  resourceManager.on('updated', () => oasis.reloadStack())
  resourceManager.on('recovered', () => oasis.reloadStack())

  function getRelativeOriginOffset(origin: { x: number; y: number }) {
    const stackBounds = stackEl.getBoundingClientRect()
    return {
      x: origin.x - stackBounds.left,
      y: origin.y - stackBounds.top
    }
  }
</script>

<div
  id="stuff-stack"
  class="wrapper stack-wrapper no-drag"
  class:isMac={isMac()}
  class:wasMouseInside={$wasMouseInside}
  class:empty={$items.length <= 0}
  style:--sidebar-width={sidebarWidth + 'px'}
  style:--gridColumns={gridColumns}
  style:--cardWidth={stackCardWidth + 'px'}
  on:mouseenter={() => dispatch('update-container-height', `${containerExpandedHeight}px`)}
  on:mouseleave={() => dispatch('update-container-height', $items.length > 0 ? '110px' : 'auto')}
  on:mouseenter={() => wasMouseInside.set(true)}
  use:HTMLDragZone.action={{
    accepts: (drag) => {
      if (
        drag.isNative ||
        drag.item?.data.hasData(DragTypeNames.SURF_TAB) ||
        drag.item?.data.hasData(DragTypeNames.SURF_RESOURCE) ||
        drag.item?.data.hasData(DragTypeNames.ASYNC_SURF_RESOURCE)
      ) {
        return true
      }

      return false
    }
  }}
  on:Drop={(drag) => dispatch('Drop', drag)}
  on:DragEnter={(drag) => {
    dragover = true
  }}
  on:DragLeave={(drag) => {
    dragover = false
  }}
>
  <div
    class="stack no-drag"
    class:dragover
    bind:this={stackEl}
    style="--card-width: {stackCardWidth}px;"
  >
    <!--{#if $items.length <= 0}
      <div class="card empty"></div>
      <div class="card empty"></div>
    {/if}-->
    {#each $items as item, i (item.resource.id)}
      {@const resource = item.resource.resource}
      {#if resource !== undefined}
        <div
          class="card stack-card relative no-drag"
          data-id={resource.id}
          use:originTransition={{ resourceId: resource.id }}
          style:--origin-x={item.fromOrigin
            ? getRelativeOriginOffset(item.fromOrigin.origin).x + 'px'
            : undefined}
          style:--origin-y={item.fromOrigin
            ? getRelativeOriginOffset(item.fromOrigin.origin).y + 'px'
            : undefined}
          style:--o={1 - i * 0.33}
          style:--r={i % 2 === 0
            ? -5 + (Math.random() - 0.5) + 'deg'
            : 5 + (Math.random() - 0.5) + 'deg'}
          style={`--item: ${i};
--grid-x: ${i % gridColumns};
--grid-y: ${Math.floor(i / gridColumns)};
--even: ${1 * (i % 2 === 0 ? 1 : -1)};
--randX: ${randX};
--randY: ${randY};

--offset-x: ${i % 2 === 0 ? i * 2 : -i * 2}px;
--offset-y: ${i * -1}px;
--rotation: var(--r);

--horizontal-grid-x: ${i % 2};
--horizontal-grid-y: ${Math.floor(i / 2)};
`}
          draggable={true}
          use:HTMLDragItem.action={{}}
          on:DragStart={(drag) => {
            drag.item?.data.setData(DragTypeNames.SURF_RESOURCE, resource)
            drag.dataTransfer?.setData('application/vnd.space.dragcula.resourceId', resource.id)
            drag.item?.data.setData(DragTypeNames.SURF_RESOURCE_ID, resource.id)
            drag.continue()
          }}
        >
          <ResourcePreview
            {resource}
            mode="media"
            viewMode="responsive"
            origin="stack"
            frameless={true}
            interactive
            draggable={false}
            hideProcessing
            on:open
            on:open-and-chat
            on:remove
          />
        </div>
      {/if}
    {/each}
  </div>
  <button
    class="transform active:scale-95 appearance-none disabled:opacity-40 disabled:cursor-not-allowed border-0 margin-0 group flex items-center justify-center p-2 transition-colors duration-200 rounded-xl flex active:outline-none focus:outline-none"
    on:click={() => dispatch('open-stuff')}
  >
    <Icon name="arrow.up.right" size="18px" />
    <span>Open My Stuff</span>
  </button>
  <!--<span class="title verticalOnly">Your Stuff</span>-->
</div>

<style lang="scss">
  .icon {
    width: 100%;
    height: 100%;
    display: flex;
    justify-content: center;
    align-items: center;
  }

  /* NOTE: Overrides to make ResourcePreviews work at small card scale. */
  :global(.stack-card) {
    font-size: 0.5em;
    /*:global(div.image) {
      //position: unset !important;
      border-radius: 0px !important;
    }
    :global(div.details) {
      padding: 0.5em !important;
    }

    :global(.resource-preview) {
      height: 100% !important;
      :global(.preview) {
        height: 100%;
        border: 0 !important;

        :global(.file-card .icon > svg) {
          --width: 2em !important;
          --height: 2em !important;
        }
        :global(> .inner) {
          height: 100%;
          :global(.media img),
          :global(.media > .wrapper) {
            height: 100% !important;
            object-fit: cover;
          }
        }
      }
    }*/
  }

  :global(.stack-card[data-drag-preview]) {
    background: #fff !important;
    border: 1.5px solid #fff;
    border-radius: 6px;
    overflow: hidden;
  }

  :global(.sidebar-meta .wrapper.stack-wrapper) {
    width: 100%;
    height: 100%;
    position: relative;

    button {
      transition:
        opacity 230ms,
        background 230ms,
        border 230ms;

      color: var(--contrast-color) !important;

      &:hover {
        background: light-dark(#cae3f5f0, #717e887a);
        :global(.custom) & {
          color: var(--contrast-color) !important;
          background: color-mix(in hsl, var(--base-color), hsla(0, 80%, 0%, 0.2)) !important;
        }
      }
    }

    .stack {
      position: relative;

      transition:
        transform 230ms,
        opacity 230ms;
      --scale: 1;
      transform-origin: center center;
      transform: scale(var(--scale));

      &.dragover {
        --scale: 0.97;
      }
      // transition-timing-function: cubic-bezier(0.52, 0.58, 0.11, 0.84);
      will-change: transform, opacity, scale;
      transition-duration: 341.2ms;
      transition-timing-function: linear(
        0 0%,
        0.0091 1%,
        0.034229 2%,
        0.072323 3%,
        0.120592 4%,
        0.17652 5%,
        0.237869 6%,
        0.302667 7.000000000000001%,
        0.369208 8%,
        0.436029 9%,
        0.501904 10%,
        0.565824 11%,
        0.626977 12%,
        0.684735 13%,
        0.738631 14.000000000000002%,
        0.788344 15%,
        0.833678 16%,
        0.874547 17%,
        0.910958 18%,
        0.942995 19%,
        0.970808 20%,
        0.994593 21%,
        1.014589 22%,
        1.031061 23%,
        1.044294 24%,
        1.054582 25%,
        1.062225 26%,
        1.06752 27%,
        1.070757 28.000000000000004%,
        1.072214 28.999999999999996%,
        1.072157 30%,
        1.070834 31%,
        1.068475 32%,
        1.065291 33%,
        1.061473 34%,
        1.057192 35%,
        1.052599 36%,
        1.047827 37%,
        1.042989 38%,
        1.038181 39%,
        1.033484 40%,
        1.028962 41%,
        1.024667 42%,
        1.020637 43%,
        1.016901 44%,
        1.013477 45%,
        1.010373 46%,
        1.007593 47%,
        1.005133 48%,
        1.002984 49%,
        1.001133 50%,
        0.999565 51%,
        0.99826 52%,
        0.9972 53%,
        0.996362 54%,
        0.995725 55.00000000000001%,
        0.995268 56.00000000000001%,
        0.994969 56.99999999999999%,
        0.994807 57.99999999999999%,
        0.994764 59%,
        0.994821 60%,
        0.99496 61%,
        0.995165 62%,
        0.995422 63%,
        0.995718 64%,
        0.996042 65%,
        0.996382 66%,
        0.996731 67%,
        0.997081 68%,
        0.997425 69%,
        0.997758 70%,
        0.998077 71%,
        0.998378 72%,
        0.998658 73%,
        0.998916 74%,
        0.999151 75%,
        0.999363 76%,
        0.999551 77%,
        0.999717 78%,
        0.99986 79%,
        0.999983 80%
      );

      > .card {
        width: var(--card-width);
        aspect-ratio: 1 / 1.2;
        aspect-ratio: 1.19 / 1;
        overflow: hidden;
        position: absolute;

        z-index: calc(1 - var(--item));

        border-radius: 6px;
        box-shadow: 1px 2px 8px rgba(0, 0, 0, 0.13);

        :global(img) {
          border-radius: 0;
        }

        .favicon {
          max-width: 20px;
        }
        .animation-favicon {
          object-fit: cover;
          object-position: center;
          width: 100%;
          height: 100%;
          position: absolute;
          inset: 0;
          z-index: 5;

          opacity: 0;
          animation: faviconFadeOut 1500ms forwards;
        }

        &.empty {
          background: rgba(255, 255, 255, 0.7);
          border-color: rgba(180, 180, 180, 0.1);
        }

        @apply bg-[#fefefe] border-[1.5px] border-white dark:bg-gray-900 dark:border-gray-700;
      }
    }

    &:hover,
    &.empty,
    :global(body:has(#app-contents.verticalTabs #homescreen.empty)) & {
      button {
        opacity: 1 !important;
      }
      .stack > .card {
        opacity: 1 !important;
      }
    }
  }

  @keyframes faviconFadeOut {
    0% {
      opacity: 1 !important;
    }

    100% {
      opacity: 0 !important;
    }
  }

  :global(.card.origin) {
    transform: translate3d(var(--origin-x), var(--origin-y), 0px) rotate(var(--rotation)) !important;
  }

  :global(.verticalTabs .sidebar-meta) .wrapper.stack-wrapper {
    min-height: 110px;
    display: flex;
    justify-content: flex-start;
    align-items: flex-end;
    padding-left: 0.5rem;
    padding-bottom: 0.5rem;

    &::before {
      position: absolute;
      top: -1rem;
      left: 0;
      bottom: 0;
      width: calc(calc(var(--gridColumns) * calc(var(--cardWidth) + 20px)));
      -webkit-app-region: no-drag;
    }

    &:hover::before,
    &:has([data-context-menu-anchor])::before,
    :global(body:has(#app-contents.verticalTabs #homescreen.empty)) &::before {
      content: '';
    }

    button {
      position: relative;
      height: 32px;
      opacity: 0;
      gap: 1ch;

      anchor-name: --stack-anchor;
      span {
        font-weight: 500;
        letter-spacing: 0.09px;
        margin-right: 2px;
      }
    }

    .stack {
      position: absolute;
      position-anchor: --stack-anchor;
      top: calc(anchor(start) - 30px);
      left: calc(anchor(start) + 15px);

      > .card {
        transform: translate3d(
            var(--origin-x, var(--offset-x)),
            var(--origin-y, var(--offset-y)),
            0px
          )
          rotate(var(--rotation));
        transform: translate3d(var(--offset-x), var(--offset-y), 0px) rotate(var(--rotation));

        transition-delay: calc(var(--item) * 4ms);
      }
    }

    .title {
      color: #fff;
      position: absolute;
      bottom: 0;
      left: 0;
      display: block;
      font-family: 'Bayshore';
      font-size: 2rem;
      mix-blend-mode: plus-lighter;
      user-select: none;
      transform: translate(6px, 3px) rotate(6deg);

      transition:
        transform 230ms,
        font-size 230ms;
      transition-timing-function: cubic-bezier(0.52, 0.58, 0.11, 0.84);
    }
    &.empty {
      min-height: auto;
      .title {
        font-size: 1.8rem;
        transform: translate(-50px, 50px) rotate(45deg) scale(1);
      }
    }

    &:hover,
    &:has([data-context-menu-anchor]),
    :global(body:has(#app-contents.verticalTabs #homescreen.empty)) & {
      .stack {
        > .card {
          opacity: calc(1 - ((var(--item) - 1 + 1) / (8 - 1) * (1 - 0.4)));

          transform: translate(
              calc(var(--grid-x) * 70px - 12px),
              calc(var(--grid-y) * -60px - 30px)
            )
            scale(1) rotate(0) scale(var(--scale));
        }
      }

      .title {
        font-size: 1.8rem;
        transform: translate(-50px, 50px) rotate(45deg) scale(1);

        mix-blend-mode: normal;
      }
    }
  }

  :global(.horizontalTabs .sidebar-meta.mouseInside),
  :global(.horizontalTabs .sidebar-meta .stack-wrapper:has([data-context-menu-anchor])) {
    :global(.stack-wrapper.wasMouseInside),
    &:has([data-context-menu-anchor]) {
      button {
        opacity: 1 !important;
      }
      .stack > .card {
        opacity: 1 !important;
      }

      &::before {
        content: '';
        position: absolute;
        top: 40px !important;
        right: -0.5rem;
        width: 200px !important;
        height: 100vh;
        --color: #cce1f977;
        background: linear-gradient(
          90deg,
          color-mix(in srgb, var(--color), transparent 100%) 0%,
          color-mix(in srgb, var(--color), transparent 65%) 80%
        );
        mask-image: linear-gradient(
          to bottom,
          color-mix(in srgb, var(--color), transparent 0%) 0%,
          color-mix(in srgb, var(--color), transparent 0%) 15%,
          color-mix(in srgb, var(--color), transparent 5%) 20%,
          color-mix(in srgb, var(--color), transparent 15%) 25%,
          color-mix(in srgb, var(--color), transparent 25%) 30%,
          color-mix(in srgb, var(--color), transparent 40%) 35%,
          color-mix(in srgb, var(--color), transparent 55%) 40%,
          color-mix(in srgb, var(--color), transparent 70%) 45%,
          color-mix(in srgb, var(--color), transparent 85%) 50%,
          color-mix(in srgb, var(--color), transparent 100%) 55%
        );
        -webkit-mask-image: linear-gradient(
          to bottom,
          color-mix(in srgb, var(--color), transparent 0%) 0%,
          color-mix(in srgb, var(--color), transparent 0%) 15%,
          color-mix(in srgb, var(--color), transparent 5%) 20%,
          color-mix(in srgb, var(--color), transparent 15%) 25%,
          color-mix(in srgb, var(--color), transparent 25%) 30%,
          color-mix(in srgb, var(--color), transparent 40%) 35%,
          color-mix(in srgb, var(--color), transparent 55%) 40%,
          color-mix(in srgb, var(--color), transparent 70%) 45%,
          color-mix(in srgb, var(--color), transparent 85%) 50%,
          color-mix(in srgb, var(--color), transparent 100%) 55%
        );
        -webkit-app-region: no-drag;

        :global(.custom) & {
          --color: var(--base-color) !important;
        }
      }
      &:not(.isMac)::before {
        width: 300px !important;
        position: relative;
        transform: translateX(25%);
        background: radial-gradient(circle at 50% 0%, #cce1f9bb 0%, transparent 70%);
        mask-image: linear-gradient(90deg, #0000 0%, #000 50%, #0000 100%);
      }

      button {
        width: 113.82px;
        padding-right: 1.5ch;
        span {
          width: unset;
        }
      }

      .stack {
        &.dragover {
          --scale: 0.93;
        }
        transform: translateY(40px);
        > .card {
          top: unset !important;
          left: unset !important;
          bottom: unset !important;
          right: unset !important;

          opacity: calc(1 - ((var(--item) - 1 + 1) / (6 - 1) * (1 - 0.4)));
          transform: translateY(40px) translate(-8px, calc(0.25rem + var(--item) * 65px - 35px))
            scale(1.2) rotate(0) scale(var(--scale)) !important;
          transform: translate(
              calc(var(--horizontal-grid-x) * -90px - 15px),
              calc(var(--horizontal-grid-y) * 80px + 15px)
            )
            scale(1.4) rotate(0) scale(var(--scale)) !important;
        }
      }
    }
  }
  // HELL: yes. this is exactly what you think.. dont ask.. I need to re-write the stack finally..
  // the styling is not easily extendable for our new use-cases.
  :global(#app-contents.horizontalTabs:has(#homescreen.empty) .stack-wrapper) {
    button {
      opacity: 1 !important;
    }
    .stack > .card {
      opacity: 1 !important;
    }

    &::before {
      content: '';
      position: absolute;
      top: 40px !important;
      right: -0.5rem;
      width: 200px !important;
      height: 100vh;
      --color: #cce1f977;
      background: linear-gradient(
        90deg,
        color-mix(in srgb, var(--color), transparent 100%) 0%,
        color-mix(in srgb, var(--color), transparent 65%) 80%
      );
      mask-image: linear-gradient(
        to bottom,
        color-mix(in srgb, var(--color), transparent 0%) 0%,
        color-mix(in srgb, var(--color), transparent 0%) 15%,
        color-mix(in srgb, var(--color), transparent 5%) 20%,
        color-mix(in srgb, var(--color), transparent 15%) 25%,
        color-mix(in srgb, var(--color), transparent 25%) 30%,
        color-mix(in srgb, var(--color), transparent 40%) 35%,
        color-mix(in srgb, var(--color), transparent 55%) 40%,
        color-mix(in srgb, var(--color), transparent 70%) 45%,
        color-mix(in srgb, var(--color), transparent 85%) 50%,
        color-mix(in srgb, var(--color), transparent 100%) 55%
      );
      -webkit-mask-image: linear-gradient(
        to bottom,
        color-mix(in srgb, var(--color), transparent 0%) 0%,
        color-mix(in srgb, var(--color), transparent 0%) 15%,
        color-mix(in srgb, var(--color), transparent 5%) 20%,
        color-mix(in srgb, var(--color), transparent 15%) 25%,
        color-mix(in srgb, var(--color), transparent 25%) 30%,
        color-mix(in srgb, var(--color), transparent 40%) 35%,
        color-mix(in srgb, var(--color), transparent 55%) 40%,
        color-mix(in srgb, var(--color), transparent 70%) 45%,
        color-mix(in srgb, var(--color), transparent 85%) 50%,
        color-mix(in srgb, var(--color), transparent 100%) 55%
      );
      -webkit-app-region: no-drag;

      :global(.custom) & {
        --color: var(--base-color) !important;
      }
    }
    &:not(.isMac)::before {
      width: 300px !important;
      position: relative;
      transform: translateX(25%);
      background: radial-gradient(circle at 50% 0%, #cce1f9bb 0%, transparent 70%);
      mask-image: linear-gradient(90deg, #0000 0%, #000 50%, #0000 100%);
    }

    button {
      width: 113.82px;
      padding-right: 1.5ch;
      span {
        width: unset;
      }
    }

    .stack {
      &.dragover {
        --scale: 0.93;
      }
      transform: translateY(40px);
      > .card {
        top: unset !important;
        left: unset !important;
        bottom: unset !important;
        right: unset !important;

        opacity: calc(1 - ((var(--item) - 1 + 1) / (6 - 1) * (1 - 0.4)));
        transform: translateY(40px) translate(-8px, calc(0.25rem + var(--item) * 65px - 35px))
          scale(1.2) rotate(0) scale(var(--scale)) !important;
        transform: translate(
            calc(var(--horizontal-grid-x) * -90px - 15px),
            calc(var(--horizontal-grid-y) * 80px + 15px)
          )
          scale(1.4) rotate(0) scale(var(--scale)) !important;
      }
    }
  }

  :global(.horizontalTabs) .wrapper.stack-wrapper {
    min-width: 60px;
    display: flex;
    justify-content: flex-end;
    align-items: center;
    padding: 0.25rem;

    button {
      position: relative;
      width: 32px;
      height: 32px;
      opacity: 0;
      gap: 1ch;

      transition: width 230ms;

      anchor-name: --stack-anchor;
      span {
        width: 0;
        font-weight: 500;
        letter-spacing: 0.09px;
        margin-right: 2px;
        white-space: nowrap;
      }
    }

    .stack {
      position: absolute;
      position-anchor: --stack-anchor;
      top: anchor(start);
      left: calc(anchor(end) - 58px);
      transform: translate3d(0px, -3px, 0px) scale(var(--scale));

      > .card {
        top: unset !important;
        left: unset !important;
        bottom: unset !important;
        right: unset !important;

        transform: translate(0, -5px) translate(var(--offset-x), var(--offset-y))
          rotate(var(--rotation)) scale(0.7);
        transition-delay: calc(var(--item) * 9.25ms);
      }
    }

    &:hover,
    &:has([data-context-menu-anchor]) {
      &::before {
        content: '';
        position: absolute;
        top: 0;
        right: -0.5rem;
        width: 75px;
        height: 100vh;
      }

      button {
        width: 113.82px;
        padding-right: 1.5ch;
        span {
          width: unset;
        }
      }

      .stack {
        transform: translateY(40px);
        > .card {
          top: unset !important;
          left: unset !important;
          bottom: unset !important;
          right: unset !important;

          opacity: calc(1 - ((var(--item) - 1 + 1) / (6 - 1) * (1 - 0.4)));
          transform: translateY(40px) translate(0, calc(0.25rem + var(--item) * 55px - 45px))
            scale(1.2) rotate(0) scale(var(--scale)) !important;
        }
      }
    }
  }

  /** =========================== **/

  .stack {
    --max-items: 6;
    --min-opacity: 0.2;
    width: 100%;

    isolation: isolate;

    --base-opacity: 0.8;
    &:hover {
      --base-opacity: 1;
    }

    > .card {
      opacity: calc(1 - calc(var(--item) * 0.08));
      opacity: var(--o);

      --angle: calc(var(--item) * 22deg);
      --radius: 60px;
      --scale: 1;

      transform-origin: center;

      transition:
        transform 230ms,
        opacity 230ms,
        left 230ms,
        bottom 230ms;
      will-change: transform, opacity;

      transition-duration: 341.2ms;
      transition-timing-function: linear(
        0 0%,
        0.0091 1%,
        0.034229 2%,
        0.072323 3%,
        0.120592 4%,
        0.17652 5%,
        0.237869 6%,
        0.302667 7.000000000000001%,
        0.369208 8%,
        0.436029 9%,
        0.501904 10%,
        0.565824 11%,
        0.626977 12%,
        0.684735 13%,
        0.738631 14.000000000000002%,
        0.788344 15%,
        0.833678 16%,
        0.874547 17%,
        0.910958 18%,
        0.942995 19%,
        0.970808 20%,
        0.994593 21%,
        1.014589 22%,
        1.031061 23%,
        1.044294 24%,
        1.054582 25%,
        1.062225 26%,
        1.06752 27%,
        1.070757 28.000000000000004%,
        1.072214 28.999999999999996%,
        1.072157 30%,
        1.070834 31%,
        1.068475 32%,
        1.065291 33%,
        1.061473 34%,
        1.057192 35%,
        1.052599 36%,
        1.047827 37%,
        1.042989 38%,
        1.038181 39%,
        1.033484 40%,
        1.028962 41%,
        1.024667 42%,
        1.020637 43%,
        1.016901 44%,
        1.013477 45%,
        1.010373 46%,
        1.007593 47%,
        1.005133 48%,
        1.002984 49%,
        1.001133 50%,
        0.999565 51%,
        0.99826 52%,
        0.9972 53%,
        0.996362 54%,
        0.995725 55.00000000000001%,
        0.995268 56.00000000000001%,
        0.994969 56.99999999999999%,
        0.994807 57.99999999999999%,
        0.994764 59%,
        0.994821 60%,
        0.99496 61%,
        0.995165 62%,
        0.995422 63%,
        0.995718 64%,
        0.996042 65%,
        0.996382 66%,
        0.996731 67%,
        0.997081 68%,
        0.997425 69%,
        0.997758 70%,
        0.998077 71%,
        0.998378 72%,
        0.998658 73%,
        0.998916 74%,
        0.999151 75%,
        0.999363 76%,
        0.999551 77%,
        0.999717 78%,
        0.99986 79%,
        0.999983 80%
      );

      &:hover,
      &:has([data-context-menu-anchor]) {
        --scale: 0.975;
        opacity: 1 !important;
      }
    }
  }

  @keyframes bounce-down {
    0% {
      transform: translateY(0px);
    }

    16% {
      transform: translateY(19.27px);
    }

    28% {
      transform: translateY(-5.12px);
    }

    44% {
      transform: translateY(4.63px);
    }

    59% {
      transform: translateY(-1.786px);
    }

    73% {
      transform: translateY(0.58px);
    }

    88% {
      transform: translateY(-0.1px);
    }

    100% {
      transform: translateY(0px);
    }
  }

  @keyframes bounce-right {
    0% {
      transform: translateX(0px);
    }

    16% {
      transform: translateX(19.27px);
    }

    28% {
      transform: translateX(-5.12px);
    }

    44% {
      transform: translateX(4.63px);
    }

    59% {
      transform: translateX(-1.786px);
    }

    73% {
      transform: translateX(0.58px);
    }

    88% {
      transform: translateX(-0.1px);
    }

    100% {
      transform: translateX(0px);
    }
  }

  :global(.verticalTabs .stack--transition_bounce) {
    transform: translateY(0px);
    animation: bounce-down 800ms linear forwards;
  }

  :global(.horizontalTabs .stack--transition_bounce) {
    transform: translateX(0px);
    animation: bounce-right 800ms linear forwards;
  }

  :global(.horizontalTabs .verticalOnly) {
    display: none !important;
  }
</style>
