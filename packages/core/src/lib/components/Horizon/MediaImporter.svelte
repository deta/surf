<script lang="ts">
  import { hasClassOrParentWithClass, posToAbsolute } from '@horizon/tela'
  import type { Horizon } from '../../service/horizon'
  import { useLogScope } from '../../utils/log'
  import { parseClipboardItems } from '../../service/clipboard'
  import { checkIfUrl, parseStringIntoUrl } from '../../utils/url'
  import { DEFAULT_CARD_SIZE } from '../../constants/card'
  import { get } from 'svelte/store'

  export let horizon: Horizon

  const log = useLogScope('MediaImporter')

  $: activeCardId = horizon.activeCardId
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

  const getNewCardPosition = (basePosition: any) => {
    if (!basePosition) basePosition = { x: mouseX, y: mouseY }

    const viewportPos = posToAbsolute(
      basePosition.x,
      basePosition.y,
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
  
  const getNewCardHorizontalPositionCreator = (gap: number, basePosition: any) => {
    const initialPos = getNewCardPosition(basePosition)

    return (nth: number) => {
      return {
        x: initialPos.x + nth * (DEFAULT_CARD_SIZE.width + gap),
        y: initialPos.y
      }
    }
  }

  const shouldIgnorePaste = (elem: HTMLElement) => {
    const isInputElem =
      ['INPUT', 'TEXTAREA'].includes(elem.tagName) || elem.hasAttribute('contenteditable')
    const isCardElem = hasClassOrParentWithClass(elem, 'card')

    return isInputElem || isCardElem || $activeCardId !== null
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

    let num = 0
    const getNewCardHorizontalPosition = getNewCardHorizontalPositionCreator(30, null)

    const blobs = await parseClipboardItems(clipboardItems)
    log.debug(
      'parsed items',
      blobs.map((blob) => blob.type)
    )

    blobs.forEach(async (blob) => {
      const type = blob.type

      if (type.startsWith('image')) {
        handleImage(blob, getNewCardHorizontalPosition(num))
        num++
      } else if (type.startsWith('text')) {
        const text = await blob.text()
        log.debug('text', text)

        const url = parseStringIntoUrl(text)
        if (url) {
          handleURL(url, getNewCardHorizontalPosition(num))
          num++
        } else {
          handleText(text, getNewCardHorizontalPosition(num))
          num++
        }
      } else {
        log.warn('unhandled blob type', type)
      }
    })
  }

  const handleDrop = async (e: DragEvent) => {
    log.debug('drop', e)
    e.preventDefault()
    e.dataTransfer?.types.map((t) => log.debug(t, e.dataTransfer?.getData(t)))

    const dataTypes = ['text/html', 'text/plain', 'text/uri-list']
    const pos = { x: e.clientX, y: e.clientY }

    for (const type of dataTypes) {
      let dataHandled = false
      const data = e.dataTransfer?.getData(type)
      if (!data || data.trim() === '') continue

      switch (type) {
        case 'text/html':
          dataHandled = await processHTMLDrop(pos, data)
          break
        case 'text/plain':
          dataHandled = await processTextData(pos, data)
          break
        case 'text/uri-list':
          dataHandled = await processUriListData(pos, data)
          break
      }

      // break out of the loop after handling at least one of the
      // possible data types
      if (dataHandled) break
    }

    let num = 0
    const getNewCardHorizontalPosition = getNewCardHorizontalPositionCreator(30, pos)

    const files = Array.from(e.dataTransfer?.files ?? [])
    files.forEach(async (file) => {
      const type = file.type

      if (type.startsWith('image')) {
        handleImage(file, getNewCardHorizontalPosition(num))
        num++
      } else {
        log.warn('unhandled file type', type)
      }
    })
  }

  const processHTMLDrop = async (basePos: any, data: string): Promise<boolean> => {
    let handledData = false

    const div = document.createElement('div')
    div.innerHTML = data ?? ''
    const images = Array.from(div.querySelectorAll('img'))

    let num = 0
    const getNewCardHorizontalPosition = getNewCardHorizontalPositionCreator(30, basePos)

    await Promise.allSettled(
      images.map(async (img) => {
        try {
          let source = img.src.startsWith('data:')
            ? img.src
            : // @ts-ignore
              await window.api.fetchAsDataURL(img.src)

          const response = await fetch(source)
          if (!response.ok) throw new Error('failed to fetch')
          const blob = await response.blob()
          handleImage(blob, getNewCardHorizontalPosition(num))

          handledData = true
          num++
        } catch (err) {
          log.debug('failed to create image card: ', { image: img, err: err })
        }
      })
    )

    return handledData
  }

  const processTextData = async (basePos: any, data: string): Promise<boolean> => {
    if (data.trim() === '') return false
    const pos = getNewCardPosition(basePos)

    if (checkIfUrl(data)) {
      handleURL(new URL(data), pos)
    } else {
      handleText(data, pos)
    }

    return true
  }

  const processUriListData = async (basePos: any, data: string): Promise<boolean> => {
    let dataHandled = false
    const pos = getNewCardPosition(basePos)

    const urls = data.split(/\r\n|\r|\n/)
    urls.forEach((url) => {
      if (checkIfUrl(url)) {
        handleURL(new URL(url), pos)
        dataHandled = true
      }
    })

    return dataHandled
  }

  const handleImage = async (blob: Blob, pos: { x: number; y: number }) => {
    const card = await horizon.addCardFile(blob, {
      x: pos.x - DEFAULT_CARD_SIZE.width / 2,
      y: pos.y - DEFAULT_CARD_SIZE.height / 2,
      width: DEFAULT_CARD_SIZE.width,
      height: DEFAULT_CARD_SIZE.height
    })
    log.debug('created card', get(card))
  }

  const handleURL = async (url: URL, pos: { x: number; y: number }) => {
    const card = await horizon.addCardLink(url.href, {
      x: pos.x - DEFAULT_CARD_SIZE.width / 2,
      y: pos.y - DEFAULT_CARD_SIZE.height / 2,
      width: DEFAULT_CARD_SIZE.width,
      height: DEFAULT_CARD_SIZE.height
    })
    log.debug('created card', get(card))
  }

  const handleText = async (text: string, pos: { x: number; y: number }) => {
    const card = await horizon.addCardText(text, {
      x: pos.x - DEFAULT_CARD_SIZE.width / 2,
      y: pos.y - DEFAULT_CARD_SIZE.height / 2,
      width: DEFAULT_CARD_SIZE.width,
      height: DEFAULT_CARD_SIZE.height
    })
    log.debug('created card', get(card))
  }
</script>

<svelte:window on:paste={handlePaste} on:mousemove={handleMouseMove} />
<svelte:body on:dragover|preventDefault={() => {}} on:drop|preventDefault={handleDrop} />
