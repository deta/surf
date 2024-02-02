<script lang="ts">
  import { posToAbsolute } from '@horizon/tela'
  import type { Horizon } from '../../service/horizon'
  import { useLogScope } from '../../utils/log'
  // import { parseClipboardItems, shouldIgnorePaste } from '../../service/clipboard'
  import { checkIfUrl } from '../../utils/url'
  import { DEFAULT_CARD_SIZE } from '../../constants/card'
  import { get } from 'svelte/store'

  export let horizon: Horizon

  const log = useLogScope('MediaImporter')

  $: board = horizon.board
  $: state = board?.state
  $: viewOffset = $state?.viewOffset
  $: zoom = $state?.zoom

  let mouseX = 0
  let mouseY = 0

  // const handleMouseMove = (e: MouseEvent) => {
  //   mouseX = e.clientX
  //   mouseY = e.clientY
  // }

  const getNewCardPosition = () => {
    const viewportPos = posToAbsolute(
      mouseX,
      mouseY,
      $viewOffset?.x ?? 0,
      $viewOffset?.y ?? 0,
      {
        x: 0,
        y: 0,
        w: window.innerWidth,
        h: window.innerHeight
      },
      $zoom ?? 1
    )

    return viewportPos
  }

  const handleImage = async (blob: Blob, pos: { x: number; y: number }) => {
    const card = await horizon.addCardFile(blob, {
      x: pos.x,
      y: pos.y,
      width: DEFAULT_CARD_SIZE.width,
      height: DEFAULT_CARD_SIZE.height
    })
    log.debug('created card', get(card))
  }

  const handleURL = async (url: URL, pos: { x: number; y: number }) => {
    const card = await horizon.addCardLink(url.href, {
      x: pos.x,
      y: pos.y,
      width: DEFAULT_CARD_SIZE.width,
      height: DEFAULT_CARD_SIZE.height
    })
    log.debug('created card', get(card))
  }

  const handleText = async (text: string, pos: { x: number; y: number }) => {
    const card = await horizon.addCardText(text, {
      x: pos.x,
      y: pos.y,
      width: DEFAULT_CARD_SIZE.width,
      height: DEFAULT_CARD_SIZE.height
    })
    log.debug('created card', get(card))
  }

  // const handlePaste = async (e: ClipboardEvent) => {
  //   log.debug('paste', e)

  //   const target = e.target as HTMLElement
  //   if (shouldIgnorePaste(target)) {
  //     log.debug('ignoring paste')
  //     return
  //   }

  //   e.preventDefault()

  //   const clipboardItems = await navigator.clipboard.read()
  //   log.debug('clipboardItems', clipboardItems)

  //   const blobs = await parseClipboardItems(clipboardItems)
  //   log.debug(
  //     'parsed items',
  //     blobs.map((blob) => blob.type)
  //   )

  //   blobs.forEach(async (blob) => {
  //     const type = blob.type

  //     if (type.startsWith('image')) {
  //       handleImage(blob)
  //     } else if (type.startsWith('text')) {
  //       const text = await blob.text()
  //       log.debug('text', text)

  //       const url = parseStringIntoUrl(text)
  //       if (url) {
  //         handleURL(url)
  //       } else {
  //         handleText(text)
  //       }
  //     } else {
  //       log.warn('unhandled blob type', type)
  //     }
  //   })
  // }

  const handleDrop = (e: DragEvent) => {
    e.preventDefault()
    const pos = { x: e.x, y: e.y }
    const dataTypes = ['text/html', 'text/plain', 'text/uri-list']

    for (const type of dataTypes) {
      let dataHandled = false
      const data = e.dataTransfer?.getData(type)
      if (!data) continue

      switch (type) {
        case 'text/html':
          const div = document.createElement('div')
          div.innerHTML = data ?? ''
          const images = div.querySelectorAll('img')
          images.forEach(async (img) => {
            try {
              log.debug('img', img.src)
              let source = img.src.startsWith('data:')
                ? img.src
                : await window.api.fetchAsDataURL(img.src)
              console.log('source', source);

              const response = await fetch(source)
              if (!response.ok) throw new Error('failed to fetch')
              const blob = await response.blob()
              console.log('blob', blob)
              handleImage(blob, pos)
            } catch (_) {}
          })
          dataHandled = images.length > 0
          break
        case 'text/plain':
          if (checkIfUrl(data)) {
            handleURL(new URL(data), pos)
          } else {
            handleText(data, pos)
          }
          dataHandled = true
          break
        case 'text/uri-list':
          const urls = data.split(/\r\n|\r|\n/)
          urls.forEach((url) => {
            if (checkIfUrl(url)) {
              handleURL(new URL(url), pos)
            }
          })
          dataHandled = urls.length > 0
          break
      }

      // break out of the loop after handling at least one of the
      // possible data types
      if (dataHandled) break
    }

    const files = Array.from(e.dataTransfer?.files ?? [])
    log.debug('files', files)

    files.forEach(async (file) => {
      const type = file.type

      if (type.startsWith('image')) {
        handleImage(file, getNewCardPosition())
      } else {
        log.warn('unhandled file type', type)
      }
    })
  }
  // <svelte:window on:paste={handlePaste} on:mousemove={handleMouseMove} />
</script>

<svelte:body on:dragover|preventDefault={() => {}} on:drop|preventDefault={handleDrop} />
