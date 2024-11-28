import type { DragculaDragEvent } from '../../../../dragcula/dist'
import type { Resource, ResourceManager } from '../service/resources'
import { DragTypeNames, type DragTypes } from '../types'

/**
 * Util to fetch the resource instance from any of the possible resource drag data types
 */
export async function getResourceFromDrag(
  drag: DragculaDragEvent<DragTypes>,
  resourceManager: ResourceManager
): Promise<Resource | null> {
  if (
    !(
      drag.item!.data.hasData(DragTypeNames.SURF_RESOURCE) ||
      drag.item!.data.hasData(DragTypeNames.ASYNC_SURF_RESOURCE) ||
      drag.item!.data.hasData(DragTypeNames.SURF_RESOURCE_ID)
    )
  )
    return null

  let resource: Resource | null = null
  if (drag.item!.data.hasData(DragTypeNames.SURF_RESOURCE)) {
    resource = drag.item!.data.getData(DragTypeNames.SURF_RESOURCE)
  } else if (drag.item!.data.hasData(DragTypeNames.ASYNC_SURF_RESOURCE)) {
    const resourceFetcher = drag.item!.data.getData(DragTypeNames.ASYNC_SURF_RESOURCE)
    resource = await resourceFetcher()
  } else if (drag.item!.data.hasData(DragTypeNames.SURF_RESOURCE_ID)) {
    const resourceId = drag.item!.data.getData(DragTypeNames.SURF_RESOURCE_ID)
    resource = await resourceManager.getResource(resourceId)
  }

  return resource
}
