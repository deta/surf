<script lang="ts">
  import { hasClassOrParentWithClass, posToAbsolute } from '@horizon/tela'
  import type { Horizon } from '../../service/horizon'
  import { useLogScope } from '../../utils/log'
  import { parseClipboardItems, shouldIgnorePaste } from '../../service/clipboard'
  import { parseStringIntoUrl } from '../../utils/url'
  import { DEFAULT_CARD_SIZE } from '../../constants/card'
    import { get } from 'svelte/store'

  export let horizon: Horizon

  const log = useLogScope('MediaImporter')

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
      0, // TODO: get $viewOffset.x from board
      0,
      {
        x: 0,
        y: 0,
        w: window.innerWidth,
        h: window.innerHeight
      },
      1
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
</script>

<svelte:window on:paste={handlePaste} on:mousemove={handleMouseMove} />
