<script lang="ts">
  import { Notebook, type NotebookCoverColor } from '@deta/services/notebooks'
  import { clickOutside, generateID } from '@deta/utils'
  import { type Fn } from '@deta/types'
  import NotebookCoverSticker from './NotebookCoverSticker.svelte'
  import LeatherOverlay from './leather_overlay.jpg?url'
  import { signature } from '@deta/ui'

  let {
    readonly = true,
    tilt = true,
    notebook,
    scribble,

    title,
    placeholder = 'Untitled Notebook',
    color,
    textured = true,

    height = '19ch',
    fontSize = '1rem',
    canPin = true,

    onclick,
    onpin,
    onunpin,

    ...restProps
  }: {
    readonly?: boolean
    tilt?: boolean
    notebook?: Notebook
    scribble?: {
      path: string
      width: number
      height: number
      color: string
    }[]

    title?: string
    placeholder?: string
    color?: NotebookCoverColor
    textured?: boolean

    height?: string
    fontSize?: string
    canPin?: boolean

    onclick?: Fn
    onpin?: Fn
    onunpin?: Fn
  } = $props()

  const scribbleValue = $derived(scribble ?? notebook?.data?.customization?.coverScribble)

  const colorValue = $derived(
    notebook?.colorValue ??
      color ?? [
        ['color(display-p3 0.24 0.67 0.98 / 0.74)', '#7ECEFF'],
        ['color(display-p3 0.13 0.55 0.86 / 0.82)', '#00A5EB'],
        ['#fff', '#fff']
      ]
  )
  let editing = $state(false)

  let ref: HTMLElement
  let editorEl: HTMLSpanElement = $state()
  let stickersEl: HTMLElement
  let coverWidth = $state(0)
  let coverHeight = $state(0)

  let scribbleStrokePreview: string = $state()
  let layers: {
    path: string
    width: number
    height: number
    color: string
  }[] = $state(notebook?.data?.customization?.coverScribble ?? [])
  let undoStack: {
    path: string
    width: number
    height: number
    color: string
  }[] = []
  let redoStack: {
    path: string
    width: number
    height: number
    color: string
  }[] = []

  const ondraw = (path: string) => {
    scribbleStrokePreview = path
  }
  const oncomplete = (path: string) => {
    scribbleStrokePreview = ''
    const newLayer = {
      path,
      width: coverWidth,
      height: coverHeight,
      color: 'var(--scribble-color)'
    }
    layers.push(newLayer)
    undoStack.push(newLayer)
    redoStack = []

    notebook.updateData({
      customization: {
        ...notebook.data.customization,
        coverScribble: layers
      }
    })
  }

  $effect(() => (layers = notebook?.data?.customization?.coverScribble ?? []))

  $effect(() => {
    if (!readonly && editing) {
      if (!editorEl) return

      editorEl.focus()
      const range = document.createRange()
      range.selectNodeContents(editorEl)
      const sel = window.getSelection()
      sel!.removeAllRanges()
      sel!.addRange(range)
    }
  })

  let stickerPos = $state([0.5, 0.5])
  let isHovered = $state(false)

  const handleHeartClick = (e: MouseEvent) => {
    e.stopPropagation()
    if (notebook?.data?.pinned) {
      onunpin?.()
    } else {
      onpin?.()
    }
  }
</script>

<div
  bind:this={ref}
  class="notebookCover"
  style:--height={height}
  style:--font-size={fontSize}
  style:--color-start={colorValue[0][0]}
  style:--color-start-fallback={colorValue[0][1]}
  style:--color-end={colorValue[1][0]}
  style:--color-end-fallback={colorValue[1][1]}
  style:--color-text={colorValue[2][0]}
  style:--color-text-fallback={colorValue[2][1]}
  class:canClick={onclick !== undefined}
  onclick={(e) => {
    onclick?.(e)
  }}
  onauxclick={(e) => {
    if (e.button !== 1) return
    onclick?.(e)
  }}
  onmouseenter={() => (isHovered = true)}
  onmouseleave={() => (isHovered = false)}
  {...restProps}
>
  <div
    class="cover"
    class:textured
    bind:clientWidth={coverWidth}
    bind:clientHeight={coverHeight}
    style:--leather-overlay={`url('${LeatherOverlay}')`}
  >
    {#if readonly || !editing}
      <span
        role="none"
        class="text"
        class:editable={!readonly && onclick === undefined}
        onclick={(e) => {
          //if (e.detail >= 2) editing = true
          editing = true
        }}
      >
        {`${notebook?.nameValue ?? title}`}
      </span>
    {:else}
      <span
        bind:this={editorEl}
        contenteditable="true"
        class="text"
        spellcheck="false"
        role="none"
        {placeholder}
        onkeydown={(e) => {
          if (e.key === 'Escape') {
            e.preventDefault()
            //oncancel?.()
            if (notebook) {
              notebook.updateData({ name: (e.target as HTMLSpanElement).textContent })
            }
          } else if (e.key === 'Enter') {
            e.preventDefault()
            if (notebook) {
              notebook.updateData({ name: (e.target as HTMLSpanElement).textContent })
            }
            //handleClose()
          }
        }}
        {@attach clickOutside(() => {
          if (notebook && editorEl) {
            notebook.updateData({ name: (editorEl as HTMLSpanElement).textContent })
          }
        })}>{notebook?.nameValue ?? title}</span
      >
    {/if}
    <div class="left-band"></div>
    <div class="stickers" bind:this={stickersEl}>
      <!--<span class="sub-text">foobar</span>-->
      {#if canPin && (onpin || onunpin) && (isHovered || notebook?.data?.pinned)}
        <div
          class="heart-sticker"
          class:pinned={notebook?.data?.pinned}
          style:color={notebook?.data?.pinned
            ? 'var(--color-text-fallback)'
            : 'var(--color-text-fallback)'}
          onclick={handleHeartClick}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="100%"
            height="100%"
            viewBox="0 0 24 24"
            stroke="color-mix(in oklch, var(--color-text-fallback), transparent 20%)"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path stroke="none" d="M0 0h24v24H0z" fill="none" />
            <path
              d="M19.5 12.572l-7.5 7.428l-7.5 -7.428a5 5 0 1 1 7.5 -6.566a5 5 0 1 1 7.5 6.572"
              fill={notebook?.data?.pinned ? 'white' : 'transparent'}
            />
          </svg>
        </div>
      {/if}
    </div>

    {#if readonly && scribbleValue}
      <div class="scribble-container absolute w-full h-full">
        <div class="scribble absolute w-full h-full" style:--scribble-color={colorValue[2][0]}>
          {#each scribbleValue as layer}
            <svg
              class="absolute w-full h-full pointer-events-none"
              viewBox="0 0 {layer.width} {layer.height}"
            >
              <path d={layer.path} fill={layer.color} />
            </svg>
          {/each}
        </div>
      </div>
    {:else if !readonly}
      <div
        class="scribble-container absolute w-full h-full"
        use:signature={{ ondraw, oncomplete }}
        ontouchmove={() => false}
      >
        {#if scribbleValue}
          <div class="scribble absolute w-full h-full" style:--scribble-color={colorValue[2][0]}>
            {#each scribbleValue as layer}
              <svg
                class="absolute w-full h-full pointer-events-none"
                viewBox="0 0 {layer.width} {layer.height}"
              >
                <path d={layer.path} fill={layer.color} />
              </svg>
            {/each}
            {#if scribbleStrokePreview}
              <svg
                class="absolute w-full h-full pointer-events-none"
                viewBox="0 0 {coverWidth} {coverHeight}"
              >
                <path d={scribbleStrokePreview} fill="var(--scribble-color)" />
              </svg>
            {/if}
          </div>
        {/if}
      </div>
    {/if}
  </div>
</div>

<style lang="scss">
  .notebookCover {
    isolation: isolate;
    position: relative;
    height: 25ch;
    width: auto;
    width: var(--width);
    height: var(--height);
    aspect-ratio: 7 / 11;
    aspect-ratio: 7.5 / 11;
    &::selection {
      background: var(--color-text);
      color: var(--color-start-fallback);
      @supports (color: color(display-p3 1 0.4 0.2)) {
        color: var(--color-start);
      }
    }

    --rounded-base: var(--round-base, 12px);
    --rounded-diff: var(--round-diff, -8px);
    --rounded-left: calc(var(--rounded-base) + var(--rounded-diff));

    border-top-left-radius: var(--rounded-left);
    border-bottom-left-radius: var(--rounded-left);
    border-top-right-radius: var(--rounded-base);
    border-bottom-right-radius: var(--rounded-base);
    overflow: hidden;
    transition:
      transform 123ms ease-out,
      box-shadow 123ms ease-out;

    &.canClick {
      &:hover,
      &:global([data-context-menu-anchor]) {
        transform: scale(1.01) rotate3d(1, 2, 4, 0.5deg);
        box-shadow: rgba(99, 99, 99, 0.2) 0px 4px 12px 0px;
      }

      &:active {
        transform: scale(0.99) rotate3d(1, 2, 4, 0.2deg);
      }
    }

    > .cover {
      background: linear-gradient(to bottom, rgba(0, 0, 0, 0), rgba(0, 0, 0, 0.12)),
        linear-gradient(to bottom, var(--color-start-fallback), var(--color-end-fallback));
      @supports (color: color(display-p3 1 0.4 0.2)) {
        background: linear-gradient(to bottom, rgba(0, 0, 0, 0), rgba(0, 0, 0, 0.12)),
          linear-gradient(to bottom, var(--color-start), var(--color-end));
      }

      height: 100%;
      width: 100%;

      box-shadow:
        0 0 0.2px 0 rgba(0, 0, 0, 0.18) inset,
        0 0.987px 3px 0 rgba(0, 0, 0, 0.1) inset,
        0 3px 7px 0 rgba(0, 0, 0, 0.1) inset,
        0 -2px 2px 0 rgba(0, 0, 0, 0.1) inset,
        0 1px 3px 0 rgba(255, 255, 255, 0.99) inset,
        0 2px 4px 0 rgba(255, 255, 255, 0.25) inset;

      border-top-left-radius: var(--rounded-left);
      border-bottom-left-radius: var(--rounded-left);
      border-top-right-radius: var(--rounded-base);
      border-bottom-right-radius: var(--rounded-base);
      overflow: hidden;

      .text {
        position: absolute;
        z-index: 5;
        top: 10%;
        left: 18%;
        right: 0.5ch;

        font-size: var(--font-size);
        font-family: 'Inter';
        font-weight: 500;
        letter-spacing: 0.01em;
        line-height: 120%;
        text-wrap: pretty;

        hyphens: auto;
        overflow-wrap: break-word;
        word-break: normal;
        overflow: hidden;
        display: -webkit-box;
        line-clamp: 4;
        -webkit-box-orient: vertical;

        color: var(--color-text-fallback);
        @supports (color: color(display-p3 1 0.4 0.2)) {
          color: var(--color-text);
        }
        padding-right: 2ch;

        &.editable {
          cursor: text;
        }

        &:empty::before {
          content: attr(placeholder);
          color: color-mix(in oklch, var(--color-text), transparent 70%);
          pointer-events: none;
          user-select: none;
        }

        &:focus {
          outline: none;
        }
      }

      .sub-text {
        position: absolute;
        z-index: 5;
        bottom: 6%;
        left: 18%;
        right: 0.5ch;

        font-size: calc(var(--font-size) / 1.8);
        font-family: 'Inter';
        font-weight: 500;
        letter-spacing: 0.01em;
        line-height: 120%;
        text-wrap: pretty;

        hyphens: auto;
        overflow-wrap: break-word;
        word-break: normal;
        overflow: hidden;
        display: -webkit-box;
        line-clamp: 4;
        -webkit-box-orient: vertical;

        color: var(--color-text);
        padding-right: 2ch;
      }

      .scribble-container {
        z-index: 3;
        pointer-events: all;
      }
      .stickers {
        position: absolute;
        inset: 0;
        z-index: 9;
        pointer-events: none;
      }

      .heart-sticker {
        position: absolute;
        top: 3%;
        right: 8%;
        width: 12%;
        height: 12%;
        pointer-events: auto;
        cursor: pointer;
        transform: rotate(10deg);
        transition: all 0.15s ease-out;
        opacity: 0.9;

        &:hover {
          transform: rotate(10deg) scale(1.1);
          opacity: 1;
        }

        &:active {
          transform: rotate(10deg) scale(0.95);
        }

        &.pinned {
          opacity: 1;
        }
      }

      > .left-band {
        position: absolute;
        z-index: 3;
        top: 0;
        left: 0;
        bottom: 0;
        width: 10%;
        background: linear-gradient(
          to right,
          rgba(0, 0, 0, 0) 0%,
          rgba(255, 255, 255, 0.22) 98%,
          rgba(0, 0, 0, 0) 100%
        );
      }

      &.textured::before {
        pointer-events: none;
        content-visibility: auto;
        mix-blend-mode: multiply;
        position: absolute;
        z-index: 10;
        inset: 0;
        content: '';
        background: var(--leather-overlay);
        background-size: 85%;
        opacity: 0.15;
      }
    }
  }
</style>
