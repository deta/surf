<script lang="ts">
  import { Tooltip } from 'bits-ui'
  import { flyAndScale, useLogScope } from '@horizon/utils'
  import icon from '../../../../public/assets/icon_512x512.webp'
  import { onDestroy, onMount } from 'svelte'
  import { signature } from '../../utils/perfect-freehand'
  import { Icon } from '@horizon/icons'
  import { writable } from 'svelte/store'
  import { useToasts } from '@horizon/core/src/lib/service/toast'

  let layers: {
    path: string
    width: number
    height: number
    color: string
  }[] = []
  let width: number
  let height: number
  let preview: string
  let selectedColor: string = '#000000'
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
  const predefinedColors = [
    '#000000',
    '#FF0000',
    '#00FF00',
    '#0000FF',
    '#FFA500',
    '#800080',
    '#008080',
    '#FFD700',
    '#FF69B4',
    '#4B0082',
    '#32CD32',
    '#FF4500'
  ]

  let colorScroller: HTMLElement

  const root_url = 'https://deta.space/api/v0/deta-os-auth'
  const toasts = useToasts()
  const log = useLogScope('TabInvite')

  let inviteId = writable<string>('')
  let remainingQuota = writable<number>(0)
  let acceptedQuota = writable<number>(0)
  let totalQuota = writable<number>(0)
  let inviteLink = writable<string>('')
  let api_key = writable<string>('')

  let showOverlayMessage = writable<boolean>(false)

  const isValidBase64Image = (base64: string): boolean => {
    const regex = /^[A-Za-z0-9+/]+={0,2}$/
    return regex.test(base64)
  }

  function sanitizeSVG(svgElement: SVGElement): SVGElement {
    const scripts = svgElement.querySelectorAll('script')
    scripts.forEach((script) => script.remove())

    return svgElement
  }

  const getApiKey = async () => {
    const userConfig = await window.api.getUserConfig()
    return userConfig?.api_key
  }

  const fetchInviteSchema = async (apiKey: string) => {
    try {
      if (!apiKey) {
        log.error('API Key is not available in userConfig')
        showOverlayMessage.set(true)
        return
      }

      const response = await fetch(`${root_url}/invites/link`, {
        headers: {
          Authorization: `Bearer ${apiKey}`
        }
      })
      if (!response.ok) {
        log.error('Failed to fetch invite schema:', await response.text())
        if (response.status === 404) {
          showOverlayMessage.set(true)
        }
        return
      }

      const data = await response.json()
      inviteId.set(data.id)
      remainingQuota.set(data.remaining_quota)
      acceptedQuota.set(data.accepted)
      totalQuota.set(data.remaining_quota + data.accepted)
      inviteLink.set(data.link)
      log.debug('Invite ID:', $inviteId)
      log.debug('Remaining quota:', $remainingQuota)
      log.debug('Invite link:', $inviteLink)
    } catch (error) {
      log.error('Error fetching invite schema:', error)
      showOverlayMessage.set(true)
    }
  }

  onMount(async () => {
    const scroller = document.getElementById('colorScroller')
    if (scroller) {
      colorScroller = scroller
      updateFadeEffects()
      scroller.addEventListener('scroll', updateFadeEffects)
    }
    const apiKey = await getApiKey()
    $api_key = apiKey || ''
    await fetchInviteSchema($api_key)
    loadFromLocalStorage()
  })

  onDestroy(() => {
    colorScroller?.removeEventListener('scroll', updateFadeEffects)
  })

  function updateFadeEffects() {
    if (!colorScroller) return

    const fadeLeft = document.querySelector('.fade-left')
    const fadeRight = document.querySelector('.fade-right')

    if (fadeLeft && fadeRight) {
      // Show/hide left fade based on scroll position
      fadeLeft.classList.toggle('opacity-0', colorScroller.scrollLeft <= 0)

      // Show/hide right fade based on scroll position
      const isAtEnd =
        colorScroller.scrollLeft + colorScroller.clientWidth >= colorScroller.scrollWidth - 1
      fadeRight.classList.toggle('opacity-0', isAtEnd)
    }
  }

  const ondraw = (path: string) => {
    preview = path
  }
  const oncomplete = (path: string) => {
    preview = ''
    const newLayer = { path, width, height, color: selectedColor }
    layers = [...layers, newLayer]
    undoStack.push(newLayer)
    redoStack = []
    saveToLocalStorage()
  }

  const undo = () => {
    if (undoStack.length > 0) {
      const undoLayer = undoStack.pop()
      if (undoLayer) {
        redoStack.push(undoLayer)
        layers = layers.filter((layer) => layer !== undoLayer)
        saveToLocalStorage()
      }
    }
  }

  const redo = () => {
    if (redoStack.length > 0) {
      const redoLayer = redoStack.pop()
      if (redoLayer) {
        undoStack.push(redoLayer)
        layers = [...layers, redoLayer]
        saveToLocalStorage()
      }
    }
  }

  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.metaKey && event.key === 'z') {
      if (event.shiftKey) {
        redo()
      } else {
        undo()
      }
    }
  }

  const clearDrawing = () => {
    layers = []
    undoStack = []
    redoStack = []
    saveToLocalStorage()
  }

  const saveToLocalStorage = async () => {
    const svgElement = document.querySelector('#doodle')
    if (!svgElement) return

    const newSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    newSvg.setAttribute('width', width.toString())
    newSvg.setAttribute('height', height.toString())
    newSvg.setAttribute('viewBox', `0 0 ${width} ${height}`)

    layers.forEach((layer) => {
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path')
      path.setAttribute('d', layer.path)
      path.setAttribute('fill', layer.color)
      newSvg.appendChild(path)
    })

    const svgData = new XMLSerializer().serializeToString(newSvg)

    if (!svgData) {
      log.error('No SVG data to save')
      return
    }

    const sanitizedSvgData = new XMLSerializer().serializeToString(sanitizeSVG(newSvg))

    const base64Data = btoa(sanitizedSvgData)

    if (!isValidBase64Image(base64Data)) {
      log.error('Invalid base64 image')
      return
    }

    localStorage.setItem('savedDrawing', base64Data)

    if (!$inviteId) {
      log.error('No invite ID available')
      return
    }

    try {
      const response = await fetch(`${root_url}/invites/link/${$inviteId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${$api_key}`
        },
        body: JSON.stringify({
          doodle_svg: base64Data
        })
      })

      if (!response.ok) {
        log.error('Failed to save drawing to API:', await response.text())
      }
    } catch (error) {
      log.error('Error saving drawing to API:', error)
    }
  }

  const loadFromLocalStorage = () => {
    const savedData = localStorage.getItem('savedDrawing')
    if (!savedData) return

    try {
      const svgData = atob(savedData)
      const parser = new DOMParser()
      const svgDoc = parser.parseFromString(svgData, 'image/svg+xml')

      const paths = svgDoc.querySelectorAll('path')
      layers = Array.from(paths).map((path) => ({
        path: path.getAttribute('d') || '',
        width,
        height,
        color: path.getAttribute('fill') || 'black'
      }))
    } catch (error) {}
  }
  import sparklesGif from '../../../../public/assets/sparkles.gif?url'
</script>

<svelte:window on:keydown={handleKeyDown} />

{#if $showOverlayMessage}
  <div class="w-full h-full bg-black/50 backdrop-blur-sm fixed top-0 left-0 z-50" />
  <div
    class="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-[60] flex flex-col items-center gap-2"
  >
    <h1 class="text-white text-center text-2xl font-bold">
      Want to give access to Surf to a friend?
    </h1>
    <p class="text-white text-center text-lg">Send a mail to hello@deta.surf</p>
  </div>
{/if}

<div
  class="flex h-full w-full bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 px-8 overflow-y-auto relative justify-center items-center"
  style:--sparkles={`url('${sparklesGif}')`}
>
  <div class="flex flex-col w-full gap-8 relative z-10 max-w-7xl mx-auto">
    <div class="flex flex-col gap-2">
      <h1
        class="font-gambarino text-3xl text-center animate-text-shimmer text-[#6C6C8D] dark:text-slate-200 select-none"
      >
        Give Surf to a friend
      </h1>
      <p class="text-lg text-center text-sky-900 dark:text-sky-100 text-balance select-none">
        Send them a personalized invite pass to Surf.
      </p>
    </div>

    <div class="block max-w-[350px] mx-auto rounded-xl bg-[#BDD8FB] p-4 shadow-xl" id="card">
      <div
        class="flex flex-col rounded-lg bg-white w-full shadow-lg touchnone overscroll-none relative overflow-hidden"
        style="z-index: 2147;"
        id="doodle"
      >
        <span
          class="absolute top-0 left-0 w-full select-none h-full z-50 p-2 font-bold text-[#6C6C8D]/50 pointer-events-none"
          >{$acceptedQuota} / {$totalQuota}</span
        >

        <svg
          width="306"
          height="446"
          viewBox="0 0 287 417"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          class="absolute"
          id="stripes"
        >
          <path
            d="M0 -4.44377L35.0096 -6.42731C59.3381 -7.8057 83.7445 -6.44038 107.767 -2.35716L143.237 3.67163L178.246 5.65518C202.575 7.03357 226.981 5.66825 251.004 1.58503L286.474 -4.44377V0.425475L251.004 6.45427C226.981 10.5375 202.575 11.9028 178.246 10.5244L143.237 8.54087L107.767 2.51208C83.7444 -1.57114 59.3381 -2.93646 35.0096 -1.55807L0 0.425475V-4.44377Z"
            fill="#FBF9F7"
            style="fill:#FBF9F7;fill:color(display-p3 0.9843 0.9765 0.9686);fill-opacity:1;"
          />
          <path
            d="M0 19.9024L35.0096 17.9189C59.3381 16.5405 83.7445 17.9058 107.767 21.989L143.237 28.0178L178.246 30.0014C202.575 31.3798 226.981 30.0144 251.004 25.9312L286.474 19.9024V24.7717L251.004 30.8005C226.981 34.8837 202.575 36.249 178.246 34.8706L143.237 32.8871L107.767 26.8583C83.7444 22.7751 59.3381 21.4097 35.0096 22.7881L0 24.7717V19.9024Z"
            fill="#FBF9F7"
            style="fill:#FBF9F7;fill:color(display-p3 0.9843 0.9765 0.9686);fill-opacity:1;"
          />
          <path
            d="M0 44.2486L35.0096 42.2651C59.3381 40.8867 83.7445 42.252 107.767 46.3352L143.237 52.364L178.246 54.3476C202.575 55.7259 226.981 54.3606 251.004 50.2774L286.474 44.2486V49.1179L251.004 55.1467C226.981 59.2299 202.575 60.5952 178.246 59.2168L143.237 57.2333L107.767 51.2045C83.7444 47.1212 59.3381 45.7559 35.0096 47.1343L0 49.1179V44.2486Z"
            fill="#FBF9F7"
            style="fill:#FBF9F7;fill:color(display-p3 0.9843 0.9765 0.9686);fill-opacity:1;"
          />
          <path
            d="M0 68.5948L35.0096 66.6113C59.3381 65.2329 83.7445 66.5982 107.767 70.6814L143.237 76.7102L178.246 78.6938C202.575 80.0721 226.981 78.7068 251.004 74.6236L286.474 68.5948V73.464L251.004 79.4928C226.981 83.5761 202.575 84.9414 178.246 83.563L143.237 81.5794L107.767 75.5507C83.7444 71.4674 59.3381 70.1021 35.0096 71.4805L0 73.464V68.5948Z"
            fill="#FBF9F7"
            style="fill:#FBF9F7;fill:color(display-p3 0.9843 0.9765 0.9686);fill-opacity:1;"
          />
          <path
            d="M0 92.941L35.0096 90.9575C59.3381 89.5791 83.7445 90.9444 107.767 95.0276L143.237 101.056L178.246 103.04C202.575 104.418 226.981 103.053 251.004 98.9698L286.474 92.941V97.8102L251.004 103.839C226.981 107.922 202.575 109.288 178.246 107.909L143.237 105.926L107.767 99.8968C83.7444 95.8136 59.3381 94.4483 35.0096 95.8267L0 97.8102V92.941Z"
            fill="#FBF9F7"
            style="fill:#FBF9F7;fill:color(display-p3 0.9843 0.9765 0.9686);fill-opacity:1;"
          />
          <path
            d="M0 117.287L35.0096 115.304C59.3381 113.925 83.7445 115.291 107.767 119.374L143.237 125.403L178.246 127.386C202.575 128.765 226.981 127.399 251.004 123.316L286.474 117.287V122.156L251.004 128.185C226.981 132.268 202.575 133.634 178.246 132.255L143.237 130.272L107.767 124.243C83.7444 120.16 59.3381 118.794 35.0096 120.173L0 122.156V117.287Z"
            fill="#FBF9F7"
            style="fill:#FBF9F7;fill:color(display-p3 0.9843 0.9765 0.9686);fill-opacity:1;"
          />
          <path
            d="M0 141.633L35.0096 139.65C59.3381 138.271 83.7445 139.637 107.767 143.72L143.237 149.749L178.246 151.732C202.575 153.111 226.981 151.745 251.004 147.662L286.474 141.633V146.503L251.004 152.531C226.981 156.615 202.575 157.98 178.246 156.602L143.237 154.618L107.767 148.589C83.7444 144.506 59.3381 143.141 35.0096 144.519L0 146.503V141.633Z"
            fill="#FBF9F7"
            style="fill:#FBF9F7;fill:color(display-p3 0.9843 0.9765 0.9686);fill-opacity:1;"
          />
          <path
            d="M0 165.98L35.0096 163.996C59.3381 162.618 83.7445 163.983 107.767 168.066L143.237 174.095L178.246 176.079C202.575 177.457 226.981 176.092 251.004 172.008L286.474 165.98V170.849L251.004 176.878C226.981 180.961 202.575 182.326 178.246 180.948L143.237 178.964L107.767 172.935C83.7444 168.852 59.3381 167.487 35.0096 168.865L0 170.849V165.98Z"
            fill="#FBF9F7"
            style="fill:#FBF9F7;fill:color(display-p3 0.9843 0.9765 0.9686);fill-opacity:1;"
          />
          <path
            d="M0 190.326L35.0096 188.342C59.3381 186.964 83.7445 188.329 107.767 192.412L143.237 198.441L178.246 200.425C202.575 201.803 226.981 200.438 251.004 196.355L286.474 190.326V195.195L251.004 201.224C226.981 205.307 202.575 206.672 178.246 205.294L143.237 203.31L107.767 197.282C83.7444 193.198 59.3381 191.833 35.0096 193.211L0 195.195V190.326Z"
            fill="#FBF9F7"
            style="fill:#FBF9F7;fill:color(display-p3 0.9843 0.9765 0.9686);fill-opacity:1;"
          />
          <path
            d="M0 214.672L35.0096 212.688C59.3381 211.31 83.7445 212.675 107.767 216.759L143.237 222.787L178.246 224.771C202.575 226.149 226.981 224.784 251.004 220.701L286.474 214.672V219.541L251.004 225.57C226.981 229.653 202.575 231.019 178.246 229.64L143.237 227.657L107.767 221.628C83.7444 217.545 59.3381 216.179 35.0096 217.558L0 219.541V214.672Z"
            fill="#FBF9F7"
            style="fill:#FBF9F7;fill:color(display-p3 0.9843 0.9765 0.9686);fill-opacity:1;"
          />
          <path
            d="M0 239.018L35.0096 237.035C59.3381 235.656 83.7445 237.022 107.767 241.105L143.237 247.134L178.246 249.117C202.575 250.495 226.981 249.13 251.004 245.047L286.474 239.018V243.887L251.004 249.916C226.981 253.999 202.575 255.365 178.246 253.986L143.237 252.003L107.767 245.974C83.7444 241.891 59.3381 240.525 35.0096 241.904L0 243.887V239.018Z"
            fill="#FBF9F7"
            style="fill:#FBF9F7;fill:color(display-p3 0.9843 0.9765 0.9686);fill-opacity:1;"
          />
          <path
            d="M0 263.365L35.0096 261.381C59.3381 260.003 83.7445 261.368 107.767 265.451L143.237 271.48L178.246 273.464C202.575 274.842 226.981 273.477 251.004 269.394L286.474 263.365V268.234L251.004 274.263C226.981 278.346 202.575 279.711 178.246 278.333L143.237 276.349L107.767 270.321C83.7444 266.237 59.3381 264.872 35.0096 266.251L0 268.234V263.365Z"
            fill="#FBF9F7"
            style="fill:#FBF9F7;fill:color(display-p3 0.9843 0.9765 0.9686);fill-opacity:1;"
          />
          <path
            d="M0 287.71L35.0096 285.726C59.3381 284.348 83.7445 285.713 107.767 289.797L143.237 295.825L178.246 297.809C202.575 299.187 226.981 297.822 251.004 293.739L286.474 287.71V292.579L251.004 298.608C226.981 302.691 202.575 304.057 178.246 302.678L143.237 300.695L107.767 294.666C83.7444 290.583 59.3381 289.217 35.0096 290.596L0 292.579V287.71Z"
            fill="#FBF9F7"
            style="fill:#FBF9F7;fill:color(display-p3 0.9843 0.9765 0.9686);fill-opacity:1;"
          />
          <path
            d="M0 312.056L35.0096 310.073C59.3381 308.694 83.7445 310.06 107.767 314.143L143.237 320.172L178.246 322.155C202.575 323.534 226.981 322.168 251.004 318.085L286.474 312.056V316.925L251.004 322.954C226.981 327.037 202.575 328.403 178.246 327.024L143.237 325.041L107.767 319.012C83.7444 314.929 59.3381 313.564 35.0096 314.942L0 316.925V312.056Z"
            fill="#FBF9F7"
            style="fill:#FBF9F7;fill:color(display-p3 0.9843 0.9765 0.9686);fill-opacity:1;"
          />
          <path
            d="M0 336.402L35.0096 334.419C59.3381 333.04 83.7445 334.406 107.767 338.489L143.237 344.518L178.246 346.501C202.575 347.88 226.981 346.514 251.004 342.431L286.474 336.402V341.272L251.004 347.3C226.981 351.384 202.575 352.749 178.246 351.371L143.237 349.387L107.767 343.358C83.7444 339.275 59.3381 337.91 35.0096 339.288L0 341.272V336.402Z"
            fill="#FBF9F7"
            style="fill:#FBF9F7;fill:color(display-p3 0.9843 0.9765 0.9686);fill-opacity:1;"
          />
          <path
            d="M0 360.749L35.0096 358.765C59.3381 357.387 83.7445 358.752 107.767 362.835L143.237 368.864L178.246 370.848C202.575 372.226 226.981 370.861 251.004 366.777L286.474 360.749V365.618L251.004 371.647C226.981 375.73 202.575 377.095 178.246 375.717L143.237 373.733L107.767 367.704C83.7444 363.621 59.3381 362.256 35.0096 363.634L0 365.618V360.749Z"
            fill="#FBF9F7"
            style="fill:#FBF9F7;fill:color(display-p3 0.9843 0.9765 0.9686);fill-opacity:1;"
          />
          <path
            d="M0 385.096L35.0096 383.112C59.3381 381.734 83.7445 383.099 107.767 387.182L143.237 393.211L178.246 395.195C202.575 396.573 226.981 395.208 251.004 391.125L286.474 385.096V389.965L251.004 395.994C226.981 400.077 202.575 401.442 178.246 400.064L143.237 398.08L107.767 392.052C83.7444 387.968 59.3381 386.603 35.0096 387.981L0 389.965V385.096Z"
            fill="#FBF9F7"
            style="fill:#FBF9F7;fill:color(display-p3 0.9843 0.9765 0.9686);fill-opacity:1;"
          />
          <path
            d="M0 409.442L35.0096 407.458C59.3381 406.08 83.7445 407.445 107.767 411.529L143.237 417.557L178.246 419.541C202.575 420.919 226.981 419.554 251.004 415.471L286.474 409.442V414.311L251.004 420.34C226.981 424.423 202.575 425.789 178.246 424.41L143.237 422.427L107.767 416.398C83.7444 412.315 59.3381 410.949 35.0096 412.328L0 414.311V409.442Z"
            fill="#FBF9F7"
            style="fill:#FBF9F7;fill:color(display-p3 0.9843 0.9765 0.9686);fill-opacity:1;"
          />
        </svg>

        <div
          class="w-full h-full z-40 absolute"
          use:signature={{ ondraw, oncomplete }}
          bind:clientWidth={width}
          bind:clientHeight={height}
          on:touchmove|preventDefault={() => false}
        >
          {#each layers as layer}
            <svg
              class="absolute w-full h-full pointer-events-none"
              viewBox="0 0 {layer.width} {layer.height}"
            >
              <path d={layer.path} fill={layer.color} />
            </svg>
          {/each}
          {#if preview}
            <svg class="absolute w-full h-full pointer-events-none" viewBox="0 0 {width} {height}">
              <path d={preview} fill={selectedColor} />
            </svg>
          {/if}
        </div>

        <div class=" p-8 h-96 z-10">
          <img
            src={icon}
            alt="Stuff Feature"
            class="w-24 h-auto object-cover rounded-xl -ml-4 -rotate-[4deg] select-none"
          />
          <p
            class="font-gambarino text-lg text-[#6C6C8D] max-w-[250px] cursor-text select-none"
            style="z-index: 400;"
          >
            Hey! I'm having fun with Surf, join the alpha with me.
          </p>
        </div>

        <!-- Line break -->
        <div class="flex w-full flex-row items-center justify-between gap-4" style="z-index: 50;">
          <div class="bg-[#BDD8FB] w-8 h-8 rounded-full -ml-4" />
          <div class="flex flex-row items-center gap-1.5 flex-1 justify-between">
            <div class="h-4 w-4 rounded-full bg-[#BDD8FB]" />
            <div class="h-4 w-4 rounded-full bg-[#BDD8FB]" />
            <div class="h-4 w-4 rounded-full bg-[#BDD8FB]" />
            <div class="h-4 w-4 rounded-full bg-[#BDD8FB]" />
            <div class="h-4 w-4 rounded-full bg-[#BDD8FB]" />
            <div class="h-4 w-4 rounded-full bg-[#BDD8FB]" />
            <div class="h-4 w-4 rounded-full bg-[#BDD8FB]" />
            <div class="h-4 w-4 rounded-full bg-[#BDD8FB]" />
            <div class="h-4 w-4 rounded-full bg-[#BDD8FB]" />
          </div>
          <div class="bg-[#BDD8FB] w-8 h-8 rounded-full -mr-4" />
        </div>

        <div class="h-24" />
      </div>
    </div>

    <div class="flex flex-row items-center justify-center gap-4">
      <button
        class="px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-full hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        on:click={() => {
          navigator.clipboard.writeText(`${$inviteLink}`)
          toasts.success('Invite link copied to clipboard')
        }}
        disabled={!$inviteLink}
      >
        Copy invite link
      </button>
    </div>
  </div>
</div>

<div
  class="fixed bottom-0 left-1/2 transform -translate-x-1/2 p-4 bg-white dark:bg-gray-900 shadow-lg rounded-tl-2xl rounded-tr-2xl border border-gray-200 dark:border-gray-700"
  style="box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.05), 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04); border-top-left-radius: 12px; border-top-right-radius: 12px;"
>
  <div class="flex flex-col items-center justify-center gap-4">
    <div class="flex items-center space-x-4">
      <Tooltip.Root openDelay={400} closeDelay={10}>
        <Tooltip.Trigger>
          <button
            on:click={undo}
            class="p-2 bg-gray-100 dark:bg-gray-600 text-gray-900 dark:text-gray-100 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          >
            <Icon name="arrow.left" size="20" />
          </button>
        </Tooltip.Trigger>
        <Tooltip.Content
          transition={flyAndScale}
          transitionConfig={{ y: 8, duration: 150 }}
          sideOffset={8}
        >
          <div class="bg-gray-100 dark:bg-gray-800">
            <Tooltip.Arrow
              class="rounded-[2px] border-l border-t border-gray-200 dark:border-gray-700"
            />
          </div>
          <div
            class="flex items-center justify-center rounded-input border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-xl p-3 text-sm font-medium shadow-md outline-none"
          >
            Undo
          </div>
        </Tooltip.Content>
      </Tooltip.Root>

      <Tooltip.Root openDelay={400} closeDelay={10}>
        <Tooltip.Trigger>
          <button
            on:click={redo}
            class="p-2 bg-gray-100 dark:bg-gray-600 text-gray-900 dark:text-gray-100 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          >
            <Icon name="arrow.right" size="20" />
          </button>
        </Tooltip.Trigger>
        <Tooltip.Content
          transition={flyAndScale}
          transitionConfig={{ y: 8, duration: 150 }}
          sideOffset={8}
        >
          <div class="bg-gray-100 dark:bg-gray-800">
            <Tooltip.Arrow
              class="rounded-[2px] border-l border-t border-gray-200 dark:border-gray-700"
            />
          </div>
          <div
            class="flex items-center justify-center rounded-input border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-xl p-3 text-sm font-medium shadow-md outline-none"
          >
            Redo
          </div>
        </Tooltip.Content>
      </Tooltip.Root>

      <Tooltip.Root openDelay={400} closeDelay={10}>
        <Tooltip.Trigger>
          <button
            on:click={clearDrawing}
            class="p-2 bg-gray-100 dark:bg-gray-600 text-gray-900 dark:text-gray-100 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          >
            <Icon name="trash" size="20" />
          </button>
        </Tooltip.Trigger>
        <Tooltip.Content
          transition={flyAndScale}
          transitionConfig={{ y: 8, duration: 150 }}
          sideOffset={8}
        >
          <div class="bg-gray-100 dark:bg-gray-800">
            <Tooltip.Arrow
              class="rounded-[2px] border-l border-t border-gray-200 dark:border-gray-700"
            />
          </div>
          <div
            class="flex items-center justify-center rounded-input border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-xl p-3 text-sm font-medium shadow-md outline-none"
          >
            Clear drawing
          </div>
        </Tooltip.Content>
      </Tooltip.Root>

      <div class="relative">
        <div
          class="flex items-center space-x-2 overflow-x-auto max-w-[220px] px-1 py-2 scrollbar-hide"
          id="colorScroller"
        >
          {#each predefinedColors as color}
            <Tooltip.Root openDelay={400} closeDelay={10}>
              <Tooltip.Trigger>
                <button
                  on:click={() => (selectedColor = color)}
                  class="w-8 h-8 rounded-full border-2 border-gray-300 dark:border-gray-700 flex-shrink-0 transition-transform hover:scale-110 outline-blue-500"
                  class:outline={selectedColor === color}
                  style="background-color: {color};"
                />
              </Tooltip.Trigger>
              <Tooltip.Content
                transition={flyAndScale}
                transitionConfig={{ y: 8, duration: 150 }}
                sideOffset={8}
              >
                <div class="bg-gray-100 dark:bg-gray-800">
                  <Tooltip.Arrow
                    class="rounded-[2px] border-l border-t border-gray-200 dark:border-gray-700"
                  />
                </div>
                <div
                  class="flex items-center justify-center rounded-input border border-gray-200 dark:border-gray-700 bg-gray-100 rounded-xl p-3 text-sm font-medium shadow-md outline-none"
                >
                  Select color
                </div>
              </Tooltip.Content>
            </Tooltip.Root>
          {/each}
        </div>
        <div
          class="absolute left-0 top-0 h-full w-16 bg-gradient-to-r from-white dark:from-gray-900 to-transparent pointer-events-none fade-left"
        />
        <div
          class="absolute right-0 top-0 h-full w-16 bg-gradient-to-l from-white dark:from-gray-900 to-transparent pointer-events-none fade-right"
        />
      </div>
    </div>
  </div>
</div>

<style lang="scss">
  @keyframes holoSparkle {
    0%,
    5% {
      opacity: 0.55;
    }
    20% {
      opacity: 1;
    }
    100% {
      opacity: 0.55;
    }
  }

  @keyframes holoGradient {
    0%,
    100% {
      opacity: 0.35;
      background-position: 90% 90%;
    }
    8% {
      opacity: 0.35;
    }
    10% {
      background-position: 90% 90%;
    }
    19% {
      background-position: 110% 110%;
      opacity: 0.6;
    }
    35% {
      background-position: 110% 110%;
    }
    55% {
      background-position: 90% 90%;
      opacity: 0.45;
    }
    75% {
      opacity: 0.35;
    }
  }

  @keyframes holoCard {
    0%,
    10% {
      transform: rotate3d(0, 0, 0, -20deg);
    }
    20% {
      transform: rotate3d(1, 1, 0.2, 30deg);
    }
    100% {
      transform: rotate3d(0, 0, 0, -20deg);
    }
  }
  @keyframes rotate-gradient {
    to {
      transform: rotate(360deg);
    }
  }
  @keyframes idle-card {
    0%,
    100% {
      transform: perspective(1100px) rotateX(1.7deg) rotateY(-1.5deg) rotateZ(0.5deg) translateY(0);
    }
    50% {
      transform: perspective(1100px) rotateX(-1.5deg) rotateY(1.7deg) rotateZ(-0.5deg)
        translateY(-1.5px);
    }
    /*
    0%,
    100% {
      transform: perspective(1100px) rotateX(2deg) rotateY(-2deg) rotateZ(0deg) translateY(0);
    }
    25% {
      transform: perspective(1100px) rotateX(-1.5deg) rotateY(1.5deg) rotateZ(0.5deg)
        translateY(-0.5px);
    }
    75% {
      transform: perspective(1100px) rotateX(1.5deg) rotateY(-1.5deg) rotateZ(-0.5deg)
        translateY(0.5px);
    }*/
  }

  #card {
    position: relative;
    overflow: clip;
    @apply rounded-lg;
    outline: 1px solid rgba(255, 255, 255, 0.2);

    transform-style: preserve-3d;
    animation: idle-card 4s ease-in-out infinite forwards;
    &:hover {
      //animation: idle-card 4s ease-in-out infinite forwards;
      animation-play-state: paused;
    }
    transform: perspective(1100px);
    transition: transform 200ms ease-out;

    &::before,
    &::after {
      content: '';
      position: absolute;
      left: 0;
      right: 0;
      bottom: 0;
      top: 0;
      background-image: linear-gradient(
        115deg,
        transparent 0%,
        rgb(0, 231, 255) 30%,
        rgb(255, 0, 231) 70%,
        transparent 100%
      );
      background-position: 0% 0%;
      background-repeat: no-repeat;
      background-size: 300% 300%;
      mix-blend-mode: color-dodge;
      opacity: 0.2;
      z-index: 1;
      animation: holoGradient 15s ease infinite;
    }
    &::after {
      background-image: var(
        --sparkles
      ); //url('https://s3-us-west-2.amazonaws.com/s.cdpn.io/13471/sparkles.gif');
      background-position: center;
      background-size: 180%;
      mix-blend-mode: color-dodge;
      opacity: 1;
      z-index: 2;
      animation: holoSparkle 15s ease infinite;
    }

    &::before {
      opacity: 1;
      animation: none;
      transition: none;
      background-image: linear-gradient(
        65deg,
        rgb(92 78 255 / 76%) 0%,
        #65fff24f 25%,
        rgb(102 204 255 / 57%) 45%,
        rgb(174 218 255) 55%,
        transparent 70%,
        transparent 100%
      );
      mix-blend-mode: luminosity;
      scale: 2;
      animation: rotate-gradient linear 4s infinite;
    }
  }
  #doodle {
    transition: transform 0.6s;
  }
  :global(.font-gambarino) {
    font-family: 'Gambarino-Display', sans-serif;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    text-rendering: optimizeLegibility;
    font-smooth: always;
    font-feature-settings:
      'kern' 1,
      'liga' 1,
      'calt' 1;
  }

  // Add this to hide scrollbar but keep functionality
  .scrollbar-hide {
    -ms-overflow-style: none;
    &::-webkit-scrollbar {
      display: none;
    }
  }

  .fade-left,
  .fade-right {
    transition: opacity 0.2s ease-in-out;
  }
</style>
