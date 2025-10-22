<script lang="ts">
  import { type Notebook } from '@deta/services/notebook'
  import { type Fn } from '@deta/types'
  import { clickOutside } from '@deta/utils'

  let {
    notebook,
    text,
    title,
    size,
    color,

    placeholder = '',
    editing = false,
    active,
    onclick,
    oncancel,
    onclose,
    onchange,
    ...restProps
  }: {
    notebook: Notebook
    title: string
    text: string
    size: string
    color?: [string, string]
    placeholder?: string
    icon?: string
    editing: boolean
    active?: boolean
    onclick?: Fn
    oncancel?: Fn
    onclose?: Fn
    onchange?: (value: String) => void
  } = $props()

  let editorEl: HTMLSpanElement = $state()
  const notebookData = notebook?.data

  $effect(() => {
    if (!editorEl) return

    editorEl.focus()
    const range = document.createRange()
    range.selectNodeContents(editorEl)
    const sel = window.getSelection()
    sel!.removeAllRanges()
    sel!.addRange(range)
  })

  function hashString(str) {
    let hash = 0,
      i,
      chr
    if (str.length === 0) return hash
    for (i = 0; i < str.length; i++) {
      chr = str.charCodeAt(i)
      hash = (hash << 5) - hash + chr
      hash |= 0
    }
    return Math.abs(hash)
  }

  // Seeded pseudo-random number generator
  function seededRandom(seed) {
    let x = Math.sin(seed) * 10000
    return x - Math.floor(x)
  }

  // Convert HSL to hex
  function hslToHex(h, s, l) {
    h = h % 360
    s /= 100
    l /= 100
    let c = (1 - Math.abs(2 * l - 1)) * s
    let x = c * (1 - Math.abs(((h / 60) % 2) - 1))
    let m = l - c / 2
    let r = 0,
      g = 0,
      b = 0
    if (h < 60) {
      r = c
      g = x
      b = 0
    } else if (h < 120) {
      r = x
      g = c
      b = 0
    } else if (h < 180) {
      r = 0
      g = c
      b = x
    } else if (h < 240) {
      r = 0
      g = x
      b = c
    } else if (h < 300) {
      r = x
      g = 0
      b = c
    } else {
      r = c
      g = 0
      b = x
    }
    r = Math.round((r + m) * 255)
    g = Math.round((g + m) * 255)
    b = Math.round((b + m) * 255)
    return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase()
  }

  // Main function
  function generateGradient(input, baseHue) {
    const seed = hashString(input)

    // Pick two hues near baseHue, spaced for harmony
    const hue1 = (baseHue + Math.floor(seededRandom(seed) * 24) - 12) % 360
    const hue2 = (baseHue + Math.floor(seededRandom(seed + 1) * 48) + 24) % 360

    // Pick pleasing saturation and lightness
    const sat1 = 70 + Math.floor(seededRandom(seed + 2) * 20) // 70–90%
    const sat2 = 70 + Math.floor(seededRandom(seed + 3) * 20)

    const light1 = 55 + Math.floor(seededRandom(seed + 4) * 15) // 55–70%
    const light2 = 45 + Math.floor(seededRandom(seed + 5) * 20) // 45–65%

    const color1 = hslToHex(hue1, sat1, light1)
    const color2 = hslToHex(hue2, sat2, light2)

    return [color1, color2]
  }

  const colors = $derived(
    color ?? generateGradient(notebookData?.folderName ?? notebookData?.name ?? text ?? title, 220)
  )

  const handleClose = () => {
    if (notebookData?.folderName) notebookData.folderName = editorEl?.textContent
    if (notebookData?.name) notebookData.name = editorEl?.textContent

    onchange?.(editorEl?.textContent)
    onclose?.()
  }
</script>

<div
  class:active
  class:editing
  class="cover"
  style="font-size: {size}em;"
  style:--color1={colors[0]}
  style:--color2={colors[1]}
  {onclick}
>
  {#if !editing}
    <span class="text">
      {`${notebookData?.folderName ?? notebookData?.name ?? title}`}
    </span>
  {:else}
    <span
      bind:this={editorEl}
      bind:textContent={text}
      contenteditable="true"
      class="text"
      spellcheck="false"
      role="none"
      {placeholder}
      onkeydown={(e) => {
        if (e.key === 'Escape') {
          e.preventDefault()
          oncancel?.()
        } else if (e.key === 'Enter') {
          e.preventDefault()
          handleClose()
        }
      }}
      {@attach clickOutside(() => handleClose())}
    ></span>
  {/if}
  <svg
    width="1em"
    height="1em"
    viewBox="0 0 230 235"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <g class="cover-svg" filter="url(#filter0_ddd_1759_9350)">
      <path
        d="M8 11.4C8 9.15979 8 8.03968 8.43597 7.18404C8.81947 6.43139 9.43139 5.81947 10.184 5.43597C11.0397 5 12.1598 5 14.4 5H125.8C132.521 5 135.881 5 138.448 6.30792C140.706 7.4584 142.542 9.29417 143.692 11.5521C145 14.1191 145 17.4794 145 24.2V204.8C145 211.521 145 214.881 143.692 217.448C142.542 219.706 140.706 221.542 138.448 222.692C135.881 224 132.521 224 125.8 224H14.4C12.1598 224 11.0397 224 10.184 223.564C9.43139 223.181 8.81947 222.569 8.43597 221.816C8 220.96 8 219.84 8 217.6V11.4Z"
        style="fill:white;fill-opacity:1;"
      />
      <path
        d="M8 11.4C8 9.15979 8 8.03968 8.43597 7.18404C8.81947 6.43139 9.43139 5.81947 10.184 5.43597C11.0397 5 12.1598 5 14.4 5H125.8C132.521 5 135.881 5 138.448 6.30792C140.706 7.4584 142.542 9.29417 143.692 11.5521C145 14.1191 145 17.4794 145 24.2V204.8C145 211.521 145 214.881 143.692 217.448C142.542 219.706 140.706 221.542 138.448 222.692C135.881 224 132.521 224 125.8 224H14.4C12.1598 224 11.0397 224 10.184 223.564C9.43139 223.181 8.81947 222.569 8.43597 221.816C8 220.96 8 219.84 8 217.6V11.4Z"
        fill="red"
        style="fill:var(--color1);fill-opacity:1;"
      />
      <path
        d="M8 11.4C8 9.15979 8 8.03968 8.43597 7.18404C8.81947 6.43139 9.43139 5.81947 10.184 5.43597C11.0397 5 12.1598 5 14.4 5H125.8C132.521 5 135.881 5 138.448 6.30792C140.706 7.4584 142.542 9.29417 143.692 11.5521C145 14.1191 145 17.4794 145 24.2V204.8C145 211.521 145 214.881 143.692 217.448C142.542 219.706 140.706 221.542 138.448 222.692C135.881 224 132.521 224 125.8 224H14.4C12.1598 224 11.0397 224 10.184 223.564C9.43139 223.181 8.81947 222.569 8.43597 221.816C8 220.96 8 219.84 8 217.6V11.4Z"
        fill="url(#paint0_linear_1759_9350)"
        style=""
      />
      <path
        d="M8 11.4C8 9.15979 8 8.03968 8.43597 7.18404C8.81947 6.43139 9.43139 5.81947 10.184 5.43597C11.0397 5 12.1598 5 14.4 5H125.8C132.521 5 135.881 5 138.448 6.30792C140.706 7.4584 142.542 9.29417 143.692 11.5521C145 14.1191 145 17.4794 145 24.2V204.8C145 211.521 145 214.881 143.692 217.448C142.542 219.706 140.706 221.542 138.448 222.692C135.881 224 132.521 224 125.8 224H14.4C12.1598 224 11.0397 224 10.184 223.564C9.43139 223.181 8.81947 222.569 8.43597 221.816C8 220.96 8 219.84 8 217.6V11.4Z"
        fill="url(#paint1_linear_1759_9350)"
        fill-opacity="0.2"
        style=""
      />
    </g>
    <defs>
      <filter
        id="filter0_ddd_1759_9350"
        x="0.533333"
        y="0.333333"
        width="151.933"
        height="233.933"
        filterUnits="userSpaceOnUse"
        color-interpolation-filters="sRGB"
      >
        <feFlood flood-opacity="0" result="BackgroundImageFix" />
        <feColorMatrix
          in="SourceAlpha"
          type="matrix"
          values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
          result="hardAlpha"
        />
        <feOffset dy="2.8" />
        <feGaussianBlur stdDeviation="3.73333" />
        <feComposite in2="hardAlpha" operator="out" />
        <feColorMatrix type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.1 0" />
        <feBlend mode="normal" in2="BackgroundImageFix" result="effect1_dropShadow_1759_9350" />
        <feColorMatrix
          in="SourceAlpha"
          type="matrix"
          values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
          result="hardAlpha"
        />
        <feOffset dy="0.933333" />
        <feGaussianBlur stdDeviation="1.4" />
        <feComposite in2="hardAlpha" operator="out" />
        <feColorMatrix type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.1 0" />
        <feBlend
          mode="normal"
          in2="effect1_dropShadow_1759_9350"
          result="effect2_dropShadow_1759_9350"
        />
        <feColorMatrix
          in="SourceAlpha"
          type="matrix"
          values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
          result="hardAlpha"
        />
        <feOffset />
        <feGaussianBlur stdDeviation="0.233333" />
        <feComposite in2="hardAlpha" operator="out" />
        <feColorMatrix type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.18 0" />
        <feBlend
          mode="normal"
          in2="effect2_dropShadow_1759_9350"
          result="effect3_dropShadow_1759_9350"
        />
        <feBlend
          mode="normal"
          in="SourceGraphic"
          in2="effect3_dropShadow_1759_9350"
          result="shape"
        />
      </filter>
      <linearGradient
        id="paint0_linear_1759_9350"
        x1="76.5"
        y1="175.5"
        x2="76.5"
        y2="224"
        gradientUnits="userSpaceOnUse"
      >
        <stop stop-color="black" stop-opacity="0" style="stop-opacity:0;" />
        <stop offset="1" stop-color="black" style="stop-opacity:0.12;" />
      </linearGradient>
      <linearGradient
        id="paint1_linear_1759_9350"
        x1="8"
        y1="115"
        x2="63"
        y2="115"
        gradientUnits="userSpaceOnUse"
      >
        <stop stop-color="white" stop-opacity="0" style="stop-opacity:0;" />
        <stop
          offset="0.293817"
          stop-color="white"
          stop-opacity="0.835026"
          style="stop-color:white;stop-opacity:0.835026;"
        />
        <stop
          offset="0.313721"
          stop-color="white"
          stop-opacity="0"
          style="stop-color:none;stop-opacity:0;"
        />
      </linearGradient>
    </defs>
  </svg>
</div>

<style lang="scss">
  .cover {
    position: relative;
    content-visibility: auto;

    transition:
      transform 123ms ease-out,
      box-shadow 123ms ease-out;

    .text {
      position: absolute;
      top: 1.75em;
      left: 2em;
      right: 1em;
      color: #fff;
      font-size: 0.08em;
      color: var(--color-white);
      font-family: 'Inter';
      letter-spacing: 0.01em;

      hyphens: auto;
      overflow-wrap: break-word;
      word-break: normal;
      overflow: hidden;
      display: -webkit-box;
      -webkit-line-clamp: 3;
      -webkit-box-orient: vertical;

      &:focus {
        outline: none;
        &::selection {
          background: black;
          color: white;
        }
      }
    }
    :global(> .cover-svg) {
      box-shadow: rgba(99, 99, 99, 0.15) 0px 2px 8px 0px;
      transition: box-shadow 123ms ease-out;
    }

    &:hover {
      transition-delay: 0;
      transform: scale(1.025) rotate3d(1, 2, 4, 1.5deg);
      // NOTE: We shouldnt animate this succer, use ::pseudo element and just animate its opacity instead
      :global(> .cover-svg) {
        box-shadow: rgba(99, 99, 99, 0.2) 0px 4px 12px 0px;
      }
    }
  }
</style>
