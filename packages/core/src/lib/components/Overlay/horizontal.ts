import { type HandlerAction, type HorizontalAction, type Action } from '@deta/teletype/src'
import { createSecondaryAction, type TeletypeStaticAction } from './service/teletypeActions'
import {
  ActionDisplayPriority,
  ActionSelectPriority
} from '@deta/teletype/src/components/Teletype/types'
import type { ResourceManager } from '../../service/resources'
import { ResourceTagsBuiltInKeys, type SpaceEntry } from '../../types'
import {
  TeletypeAction,
  TeletypeActionGroup,
  dispatchTeletypeEvent
} from './service/teletypeActions'
import TeletypeResourcePreview from './TeletypeResourcePreview.svelte'
import { type Resource } from '../../service/resources'
import { staticActions } from './service/staticActions'
import { createExecutioner } from './service/translations'
import { truncate } from '@horizon/utils'
import type { OasisService } from '../../service/oasis'

const createSpaceHorizontalItem = async (entry: SpaceEntry, resource: Resource) => {
  const url =
    resource.metadata?.sourceURI ??
    resource.tags?.find((tag) => tag.name === ResourceTagsBuiltInKeys.CANONICAL_URL)?.value

  return {
    id: entry.id,
    name: truncate(resource.metadata?.name || 'Untitled', 30),
    description: resource.metadata?.userContext || '',
    icon: getPrimaryResourceType(resource.type) || 'document',
    execute: TeletypeAction.OpenResource,
    component: TeletypeResourcePreview,
    componentProps: {
      resource
    },
    view: 'Inline',
    actionPanel: [
      createSecondaryAction({
        id: 'open-history-in-mini-browser',
        name: 'Open in Mini-Browser',
        handler: createExecutioner(TeletypeAction.OpenResourceInMiniBrowser, { resource })
      }),
      {
        id: `copy-history`,
        name: 'Copy URL',
        icon: 'copy',
        handler: createExecutioner(TeletypeAction.CopyURL, { url })
      }
    ],
    handler: createExecutioner(TeletypeAction.OpenResource, { resource })
  }
}

const createSpaceAction = async (
  result: TeletypeStaticAction,
  resourceManager: ResourceManager,
  oasis: OasisService
) => {
  const spaceContents = await resourceManager.getSpaceContents(result.id)
  const space = await oasis.getSpace(result.id)

  const horizontalItems = await Promise.all(
    spaceContents.map(async (entry: SpaceEntry) => {
      const resource = await resourceManager.getResource(entry.resource_id)
      if (!resource) return null
      return createSpaceHorizontalItem(entry, resource)
    })
  )

  const validItems = horizontalItems.filter((item) => item !== null).slice(0, 10)

  const horizontalAction = {
    id: result.id,
    section: result.name ? `Context → ${result.name}` : `Context → ${result.name}`,
    name: result.name,
    keywords: result.keywords || [],
    selectPriority: result.selectPriority || ActionSelectPriority.HIGH,
    displayPriority: result.displayPriority || ActionDisplayPriority.HIGH,
    horizontalItems: validItems as unknown as Action[],
    horizontalParentAction: TeletypeAction.OpenSpaceInStuff,
    payload: { space }
  } as HorizontalAction

  const openSpaceAction = {
    id: result.id + '-open',
    name: result.name,
    selectPriority: result.selectPriority || ActionSelectPriority.HIGH,
    displayPriority: result.displayPriority || ActionDisplayPriority.HIGHEST,
    execute: TeletypeAction.OpenSpaceAsContext,
    icon: result.icon,
    actionIcon: result.actionIcon,
    actionText: result.actionText,
    actionPanel: result.actionPanel,
    section: 'Contexts',
    handler: result.handler
  } as Action

  const actions: (Action | HorizontalAction)[] = [openSpaceAction]

  actions.push(horizontalAction)

  return actions
}

const createDefaultAction = (result: TeletypeStaticAction): HandlerAction => {
  return {
    id: result.id,
    name: result.name,
    icon: result.icon || 'document',
    section: result.section || 'Results',
    keywords: result.keywords || [],
    selectPriority: result.selectPriority || ActionSelectPriority.NORMAL,
    displayPriority: result.displayPriority || ActionDisplayPriority.LOW,
    actionPanel: result.actionPanel,
    handler: async () => {
      try {
        await result.handler?.(result)
      } catch (error) {}
    }
  } as HandlerAction
}

const createResourceAction = async (entry: { id: string }, resourceManager: ResourceManager) => {
  try {
    const resource = await resourceManager.getResource(entry.id)
    if (!resource) return null

    const url =
      resource.metadata?.sourceURI ??
      resource.tags?.find((tag) => tag.name === ResourceTagsBuiltInKeys.CANONICAL_URL)?.value

    return {
      id: entry.id,
      name: resource.metadata?.name || 'UNTITLED',
      description: resource.metadata?.userContext || '',
      icon: getPrimaryResourceType(resource.type) || 'document',
      execute: TeletypeAction.OpenResource,
      group: TeletypeActionGroup.Resources,
      component: TeletypeResourcePreview,
      componentProps: {
        resource
      },
      view: 'Inline',
      actionPanel: [
        createSecondaryAction({
          id: 'open-history-in-mini-browser',
          name: 'Open in Mini-Browser',
          handler: createExecutioner(TeletypeAction.OpenResourceInMiniBrowser, { resource })
        }),
        {
          id: `copy-history`,
          name: 'Copy URL',
          icon: 'copy',
          handler: createExecutioner(TeletypeAction.CopyURL, { url })
        }
      ],
      handler: createExecutioner(TeletypeAction.OpenResource, { resource })
    }
  } catch (error) {
    return null
  }
}

const createResourceActions = async (
  entries: { id: string }[],
  resourceManager: ResourceManager
) => {
  const resources = await Promise.all(
    entries.map((entry) => createResourceAction(entry, resourceManager))
  )

  return {
    id: new Date().toISOString(),
    section: 'From your Stuff',
    name: 'Resources',
    ignoreFuse: true,
    displayPriority: ActionDisplayPriority.LOW,
    horizontalItems: resources.filter(Boolean) as unknown as Action[],
    horizontalParentAction: TeletypeAction.OpenStuff
  } as HorizontalAction
}

export const createActionsFromResults = async (
  results: TeletypeStaticAction[],
  resourceManager: ResourceManager,
  oasis: OasisService
): Promise<(HandlerAction | HorizontalAction | Action)[]> => {
  if (!results?.length) return []

  const resourceResults = results.filter(
    (result) => result?.group === TeletypeActionGroup.Resources
  )
  const otherResults = results.filter((result) => result?.group !== TeletypeActionGroup.Resources)

  const resourceSection =
    resourceResults.length > 0
      ? await createResourceActions(resourceResults, resourceManager)
      : null

  const otherActions = await Promise.all(
    otherResults.map(async (result) => {
      if (!result) return null

      switch (result.group) {
        case TeletypeActionGroup.Space: {
          const [openSpaceAction, horizontalAction] = await createSpaceAction(
            result,
            resourceManager,
            oasis
          )

          if (horizontalAction) {
            return [openSpaceAction, horizontalAction]
          }

          return [openSpaceAction]
        }
        default:
          return createDefaultAction(result)
      }
    })
  )

  const flattenedActions = otherActions.flatMap((action) =>
    Array.isArray(action) ? action : [action]
  )

  const filteredActions = [
    ...(resourceSection ? [resourceSection] : []),
    ...flattenedActions
  ].filter((action): action is HandlerAction | HorizontalAction | Action => action !== null)

  return filteredActions
}

// Helper function to determine the icon based on resource type
const getPrimaryResourceType = (type: string): string => {
  switch (true) {
    case type.startsWith('document'):
      return 'file-text'
    case type.startsWith('post'):
      return 'pencil'
    case type.startsWith('chat'):
      return 'message-circle'
    case type.startsWith('link'):
      return 'link'
    case type.startsWith('article'):
      return 'book-open'
    case type.startsWith('image'):
      return 'image'
    case type.startsWith('audio'):
      return 'music'
    case type.startsWith('video'):
      return 'video'
    default:
      return 'document'
  }
}
