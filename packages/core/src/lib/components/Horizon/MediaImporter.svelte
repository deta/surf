<script lang="ts">
  import { posToAbsolute } from '@horizon/tela'
  import type { Horizon } from '../../service/horizon'
  import { useLogScope } from '../../utils/log'
  import { parseClipboardItems, shouldIgnorePaste } from '../../service/clipboard'
  import { parseStringIntoUrl } from '../../utils/url'
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

  const handleMouseMove = (e: MouseEvent) => {
    mouseX = e.clientX
    mouseY = e.clientY
  }

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

  const handleImage = async (blob: Blob) => {
    log.debug('Pasted Image:', blob)

    const pos = getNewCardPosition()
    const card = await horizon.addCardFile(blob, {
      x: pos.x,
      y: pos.y,
      width: DEFAULT_CARD_SIZE.width,
      height: DEFAULT_CARD_SIZE.height
    })
    log.debug('created card', get(card))
  }

  const handleURL = async (url: URL) => {
    log.debug('Pasted URL:', url)

    const pos = getNewCardPosition()
    const card = await horizon.addCardLink(url.href, {
      x: pos.x,
      y: pos.y,
      width: DEFAULT_CARD_SIZE.width,
      height: DEFAULT_CARD_SIZE.height
    })
    log.debug('created card', get(card))
  }

  const handleText = async (text: string) => {
    log.debug('Pasted Text:', text)

    const pos = getNewCardPosition()
    const card = await horizon.addCardText(text, {
      x: pos.x,
      y: pos.y,
      width: DEFAULT_CARD_SIZE.width,
      height: DEFAULT_CARD_SIZE.height
    })
    log.debug('created card', get(card))
  }

  const handlePaste = async (e: ClipboardEvent) => {
    log.debug('paste', e)

    const target = e.target as HTMLElement
    if (shouldIgnorePaste(target)) {
      log.debug('ignoring paste')
      return
    }

    e.preventDefault()

    const clipboardItems = await navigator.clipboard.read()
    log.debug('clipboardItems', clipboardItems)

    const blobs = await parseClipboardItems(clipboardItems)
    log.debug(
      'parsed items',
      blobs.map((blob) => blob.type)
    )

    blobs.forEach(async (blob) => {
      const type = blob.type

      if (type.startsWith('image')) {
        handleImage(blob)
      } else if (type.startsWith('text')) {
        const text = await blob.text()
        log.debug('text', text)

        const url = parseStringIntoUrl(text)
        if (url) {
          handleURL(url)
        } else {
          handleText(text)
        }
      } else {
        log.warn('unhandled blob type', type)
      }
    })
  }

  const handleDrop = (e: DragEvent) => {
    log.debug('drop', e)

    const files = Array.from(e.dataTransfer?.files ?? [])
    log.debug('files', files)

    files.forEach(async (file) => {
      const type = file.type

      if (type.startsWith('image')) {
        handleImage(file)
      } else {
        log.warn('unhandled file type', type)
      }
    })
  }
</script>

<svelte:body on:dragover|preventDefault={() => {}} on:drop|preventDefault={handleDrop} />
<svelte:window on:paste={handlePaste} on:mousemove={handleMouseMove} />
