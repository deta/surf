<script lang="ts">
  import { hasClassOrParentWithClass, posToAbsolute } from '@horizon/tela'
  import type { Horizon } from '../../service/horizon'
  import { useLogScope } from '../../utils/log'
  import { DEFAULT_CARD_SIZE } from '../../constants/card'
  import { get } from 'svelte/store'
  import { processDrop, processPaste } from '../../service/mediaImporter'
  import { ResourceTypes, type SFFSResourceMetadata, type SFFSResourceTag } from '../../types'
  import { ResourceTag } from '../../service/resources'

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

    return isInputElem || (isCardElem && $activeCardId !== null)
  }

  const handlePaste = async (e: ClipboardEvent) => {
    log.debug('paste', e)

    const target = e.target as HTMLElement
    if (shouldIgnorePaste(target)) {
      log.debug('ignoring paste')
      return
    }

    e.preventDefault()

    const getNewCardHorizontalPosition = getNewCardHorizontalPositionCreator(30, null)

    const result = await processPaste(e)
    result.map((item, idx) => {
      log.debug('processed item', item)

      if (item.type === 'text') {
        createTextCard(item.data, getNewCardHorizontalPosition(idx), item.metadata, [
          ResourceTag.paste()
        ])
      } else if (item.type === 'url') {
        createBrowserCard(item.data, getNewCardHorizontalPosition(idx))
      } else if (item.type === 'file') {
        if (item.data.type.startsWith('image')) {
          createFileCard(item.data, getNewCardHorizontalPosition(idx), item.metadata, [
            ResourceTag.paste()
          ])
        } else {
          log.warn('unhandled file type', item.data.type)
        }
      }
    })
  }

  const handleDrop = async (e: DragEvent) => {
    log.debug('drop', e)
    e.preventDefault()

    // send event to window so that other components know that a drop event has occurred
    window.dispatchEvent(new CustomEvent('drop', { detail: e }))

    const getNewCardHorizontalPosition = getNewCardHorizontalPositionCreator(30, {
      x: e.clientX,
      y: e.clientY
    })

    const result = await processDrop(e)
    result.map((item, idx) => {
      log.debug('processed item', item)

      if (item.type === 'text') {
        createTextCard(item.data, getNewCardHorizontalPosition(idx), item.metadata, [
          ResourceTag.dragLocal()
        ])
      } else if (item.type === 'url') {
        createBrowserCard(item.data, getNewCardHorizontalPosition(idx))
      } else if (item.type === 'file') {
        createFileCard(item.data, getNewCardHorizontalPosition(idx), item.metadata, [
          ResourceTag.dragLocal()
        ])
      } else if (item.type === 'resource') {
        handleResource(item.data, getNewCardHorizontalPosition(idx))
      } else {
        log.warn('unhandled item type', item.type)
      }
    })
  }

  const handleResource = async (resourceId: string, pos: { x: number; y: number }) => {
    log.debug('handleResource', resourceId)

    const resource = await horizon.getResource(resourceId)
    if (!resource) {
      log.error('Resource not found', resourceId)
      return
    }

    log.debug('resource', resource)

    const resourceToCardType: Record<string, string> = {
      [ResourceTypes.NOTE]: 'text',
      [ResourceTypes.LINK]: 'link'
    }

    horizon.addCard({
      x: pos.x - DEFAULT_CARD_SIZE.width / 2,
      y: pos.y - DEFAULT_CARD_SIZE.height / 2,
      width: DEFAULT_CARD_SIZE.width,
      height: DEFAULT_CARD_SIZE.height,
      type: resourceToCardType[resource.type] ?? 'file',
      resourceId: resource.id
    })
  }

  const createFileCard = async (
    blob: Blob,
    pos: { x: number; y: number },
    metadata: Partial<SFFSResourceMetadata>,
    tags: SFFSResourceTag[]
  ) => {
    const card = await horizon.addCardWithResource(
      'file',
      {
        x: pos.x - DEFAULT_CARD_SIZE.width / 2,
        y: pos.y - DEFAULT_CARD_SIZE.height / 2,
        width: DEFAULT_CARD_SIZE.width,
        height: DEFAULT_CARD_SIZE.height
      },
      blob,
      metadata,
      tags
    )
    log.debug('created card', get(card))
  }

  // const createLinkCard = async (url: URL, pos: { x: number; y: number }) => {
  //   const card = await horizon.addCardLink(url.href, {
  //     x: pos.x - DEFAULT_CARD_SIZE.width / 2,
  //     y: pos.y - DEFAULT_CARD_SIZE.height / 2,
  //     width: DEFAULT_CARD_SIZE.width,
  //     height: DEFAULT_CARD_SIZE.height
  //   })
  //   log.debug('created card', get(card))
  // }

  const createBrowserCard = async (url: URL, pos: { x: number; y: number }) => {
    const card = await horizon.addCardBrowser(url.href, {
      x: pos.x - DEFAULT_CARD_SIZE.width / 2,
      y: pos.y - DEFAULT_CARD_SIZE.height / 2,
      width: 800,
      height: 500
    })
    log.debug('created card', get(card))
  }

  const createTextCard = async (
    text: string,
    pos: { x: number; y: number },
    metadata: Partial<SFFSResourceMetadata>,
    tags: SFFSResourceTag[]
  ) => {
    const card = await horizon.addCardText(
      text,
      {
        x: pos.x - DEFAULT_CARD_SIZE.width / 2,
        y: pos.y - DEFAULT_CARD_SIZE.height / 2,
        width: DEFAULT_CARD_SIZE.width,
        height: DEFAULT_CARD_SIZE.height
      },
      metadata,
      tags
    )
    log.debug('created card', get(card))
  }
</script>

<svelte:window on:paste={handlePaste} on:mousemove={handleMouseMove} />
<svelte:body on:dragover|preventDefault={() => {}} on:drop|preventDefault={handleDrop} />
