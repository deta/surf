<script lang="ts">
  import { getEditorContentText } from '@horizon/editor'
  import type {
    Resource,
    ResourceDocument,
    ResourceJSON,
    ResourceNote
  } from '../../service/resources'
  import { useLogScope } from '@horizon/utils'
  import { ResourceTypes, type ResourceData } from '@horizon/types'
  import { get } from 'svelte/store'
  import { MEDIA_TYPES } from '../../service/mediaImporter'
  import { DragculaDragEvent, HTMLDragItem } from '@horizon/dragcula'
  import { DragTypeNames, type DragTypes } from '../../types'

  export let draggable = true
  export let resource: Resource

  const log = useLogScope('DragResourceWrapper')

  const handleDragStart = (drag: DragculaDragEvent<DragTypes>) => {
    drag.item!.data.setData(DragTypeNames.SURF_RESOURCE, resource)
    drag.dataTransfer?.setData('application/vnd.space.dragcula.resourceId', resource.id)
    drag.item!.data.setData(DragTypeNames.SURF_RESOURCE_ID, resource.id)

    drag.continue()
  }

  const OLD__handleDragStart = (e: DragEvent) => {
    log.debug('Item drag start', e, resource.id)

    // if (
    //   e.target instanceof Element &&
    //   (e.target.classList.contains('drawer-item') || e.target.closest('.drawer-item'))
    // ) {
    //   isDraggingDrawerItem.set(true)
    // }

    if (!e.dataTransfer) {
      log.error('No dataTransfer found')
      return
    }

    // this will be used by the MediaImporter to import the resource and create a card
    e.dataTransfer.setData(MEDIA_TYPES.RESOURCE, resource.id)

    // horizon.telemetry.trackEvent(TelemetryEventTypes.OasisDrag, {
    //   kind: getPrimaryResourceType(resource.type),
    //   type: resource.type
    // })

    log.debug('Resource type', resource.type)
    if (
      resource.type.startsWith(ResourceTypes.LINK) ||
      resource.type.startsWith(ResourceTypes.POST) ||
      resource.type.startsWith(ResourceTypes.CHAT_MESSAGE) ||
      resource.type.startsWith(ResourceTypes.ARTICLE)
    ) {
      const data = (resource as ResourceJSON<ResourceData>).parsedData
      log.debug('parsed resource data')

      // We cannot read the data here as the drag start event is synchronous
      if (!data) {
        log.warn('No parsed data found, cannot add primitive data to dataTransfer')
        return
      }

      if ((data as any).url) {
        e.dataTransfer.setData('text/uri-list', (data as any).url)
      } else {
        e.dataTransfer.setData('text/plain', JSON.stringify(data))
      }
    } else if (resource.type === ResourceTypes.DOCUMENT_SPACE_NOTE) {
      const data = get((resource as ResourceNote).parsedData)
      log.debug('parsed resource data', data)

      // We cannot read the data here as the drag start event is synchronous
      if (!data) {
        log.warn('No parsed data found, cannot add primitive data to dataTransfer')
        return
      }

      const textContent = getEditorContentText(data)
      e.dataTransfer.setData('text/plain', textContent)
      e.dataTransfer.setData('text/html', data)
    } else if (resource.type.startsWith(ResourceTypes.DOCUMENT)) {
      const document = (resource as ResourceDocument).parsedData
      log.debug('parsed resource data')

      // We cannot read the data here as the drag start event is synchronous
      if (!document) {
        log.warn('No parsed data found, cannot add primitive data to dataTransfer')
        return
      }

      e.dataTransfer.setData('text/plain', document.content_plain)
      e.dataTransfer.setData('text/html', document.content_html)
    } else if (resource.type.startsWith('image/')) {
      const filePath = resource.path
      log.debug('file path', filePath)

      e.preventDefault()

      window.api.startDrag(resource.id, filePath, resource.type)
    } else {
      const blob = resource.rawData
      if (!blob) {
        log.error('No data found')
        return
      }

      log.debug('Creating file out of resource', blob)

      // convert to file
      const file = new File([blob], resource?.metadata?.name ?? 'unknown', {
        type: blob.type,
        lastModified: new Date(resource.updatedAt).getTime()
      })

      log.debug('Created file', file)

      // TODO: this is not usable by most other applications. Needs further investigation
      const createdItem = e.dataTransfer.items.add(file)
      log.debug('Added file to dataTransfer', createdItem)
    }

    e.dataTransfer.setData(MEDIA_TYPES.RESOURCE, resource.id)
  }
</script>

<!-- svelte-ignore missing-declaration a11y-no-static-element-interactions -->
<div
  id={resource.id}
  {draggable}
  use:HTMLDragItem.action={{}}
  class="drag-item"
  style:view-transition-name="oasis-resource-{resource.id}"
  on:DragStart={handleDragStart}
>
  <slot />
</div>

<style lang="scss">
  .drag-item {
    display: block;
  }
  :global(.drag-item[data-drag-preview]) {
    box-shadow: none;
    max-width: 25ch;
    border-radius: 14px;
    overflow: hidden;
  }
  :global(.drag-item[data-drag-preview] .resource-preview .preview) {
    box-shadow:
      rgba(50, 50, 93, 0.2) 0px 13px 27px -5px,
      rgba(0, 0, 0, 0.25) 0px 8px 16px -8px;
  }
</style>
