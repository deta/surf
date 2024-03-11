<script lang="ts">
  import { clamp, hasClassOrParentWithClass, posToAbsolute } from '@horizon/tela'
  import type { Horizon } from '../../service/horizon'
  import { useLogScope } from '../../utils/log'
  import { DEFAULT_CARD_SIZE } from '../../constants/card'
  import { get } from 'svelte/store'
  import { processDrop, processPaste } from '../../service/mediaImporter'
  import {
    ResourceTypes,
    type DownloadRequestMessage,
    type SFFSResourceMetadata,
    type SFFSResourceTag,
    type DownloadUpdatedMessage,
    type DownloadDoneMessage
  } from '../../types'
  import { ResourceLink, ResourceTag } from '../../service/resources'

  export let horizon: Horizon

  const log = useLogScope('MediaImporter')
  const downloadResourceMap = new Map<string, string>()

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
          createImageCard(item.data, getNewCardHorizontalPosition(idx), item.metadata, [
            ResourceTag.paste()
          ])
        } else {
          createFileCard(item.data, getNewCardHorizontalPosition(idx), item.metadata, [
            ResourceTag.paste()
          ])
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
        if (item.data.type.startsWith('image')) {
          createImageCard(item.data, getNewCardHorizontalPosition(idx), item.metadata, [
            ResourceTag.dragLocal()
          ])
        } else {
          createFileCard(item.data, getNewCardHorizontalPosition(idx), item.metadata, [
            ResourceTag.dragLocal()
          ])
        }
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

    if (
      resource.type === ResourceTypes.LINK ||
      resource.type === ResourceTypes.ARTICLE ||
      resource.type.startsWith(ResourceTypes.POST) ||
      resource.type.startsWith(ResourceTypes.CHAT_MESSAGE)
    ) {
      const bookmark = await (resource as ResourceLink).getParsedData()
      if (!bookmark || !bookmark.url) {
        log.error('Bookmark not found', resourceId)
        return
      }

      log.debug('bookmark', bookmark)

      createBrowserCard(new URL(bookmark.url), pos, resource.id)
    } else {
      horizon.addCard({
        x: pos.x - DEFAULT_CARD_SIZE.width / 2,
        y: pos.y - DEFAULT_CARD_SIZE.height / 2,
        width: DEFAULT_CARD_SIZE.width,
        height: DEFAULT_CARD_SIZE.height,
        type: resource.type === ResourceTypes.DOCUMENT_SPACE_NOTE ? 'text' : 'file',
        resourceId: resource.id
      })
    }
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

  const createImageCard = async (
    blob: Blob,
    pos: { x: number; y: number },
    metadata: Partial<SFFSResourceMetadata>,
    tags: SFFSResourceTag[]
  ) => {
    // Find out size
    const src = URL.createObjectURL(blob)
    const [imgWidth, imgHeight] = await new Promise((resolve, reject) => {
      let img = new Image()
      img.onload = () => resolve([img.width, img.height])
      img.onerror = reject
      img.src = src
    })

    // TODO: Make this respect our default card size a bit better
    const aspect = clamp(imgWidth / imgHeight, 0, 4)
    let targetWidth = Math.round(DEFAULT_CARD_SIZE.width * aspect)
    let targetHeight = Math.round(DEFAULT_CARD_SIZE.width)

    const card = await horizon.addCardWithResource(
      'file',
      {
        x: pos.x - DEFAULT_CARD_SIZE.width / 2,
        y: pos.y - DEFAULT_CARD_SIZE.height / 2,
        width: targetWidth,
        height: targetHeight
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

  const createBrowserCard = async (
    url: URL,
    pos: { x: number; y: number },
    resourceId?: string
  ) => {
    const position = {
      x: pos.x - DEFAULT_CARD_SIZE.width / 2,
      y: pos.y - DEFAULT_CARD_SIZE.height / 2,
      width: 800,
      height: 500
    }

    if (resourceId) {
      const card = await horizon.addCardBrowserWithResource(url.href, resourceId, position)
      log.debug('created card', get(card))
    } else {
      const card = await horizon.addCardBrowser(url.href, position)
      log.debug('created card', get(card))
    }
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

  // @ts-ignore
  window.api.onRequestDownloadPath(async (data: DownloadRequestMessage) => {
    // TODO: add metadata/tags here
    const resource = await horizon.createResource(
      data.mimeType,
      undefined,
      {
        name: data.filename,
        sourceURI: data.url
      },
      [ResourceTag.download()]
    )
    downloadResourceMap.set(data.id, resource.id)
    log.debug('new download request', { ...data, savePath: resource.path })
    return resource.path
  })
  // @ts-ignore
  window.api.onDownloadUpdated((data: DownloadUpdatedMessage) => {
    log.debug('download updated', data)
  })
  // @ts-ignore
  window.api.onDownloadDone((data: DownloadDoneMessage) => {
    // TODO: trigger the post-processing call here
    log.debug('download done', data)

    const resourceId = downloadResourceMap.get(data.id)
    if (resourceId && data.state === 'completed') horizon.resourceManager.reloadResource(resourceId)

    downloadResourceMap.delete(data.id)
  })
</script>

<svelte:window on:paste={handlePaste} on:mousemove={handleMouseMove} />
<svelte:body on:dragover|preventDefault={() => {}} on:drop|preventDefault={handleDrop} />
