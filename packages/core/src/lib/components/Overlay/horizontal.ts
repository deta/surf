import { type HandlerAction, type HorizontalAction, type Action } from '@deta/teletype/src'
import { createSecondaryAction, type TeletypeStaticAction } from './service/teletypeActions'
import {
  ActionDisplayPriority,
  ActionSelectPriority
} from '@deta/teletype/src/components/Teletype/types'
import type { ResourceManager } from '../../service/resources'
import { ResourceTagsBuiltInKeys } from '../../types'
import { TeletypeAction, TeletypeActionGroup } from './service/teletypeActions'
import TeletypeResourcePreview from './TeletypeResourcePreview.svelte'
import { createExecutioner } from './service/translations'
import type { OasisService } from '../../service/oasis'

const createSpaceAction = async (result: TeletypeStaticAction, oasis: OasisService) => {
  const actions: Action[] = []
  const space = await oasis.getSpace(result.id)
  if (!space) {
    return actions
  }
  if (space.dataValue.useAsBrowsingContext) {
    const openSpaceAction = {
      section: 'Switch to Browsing Context',
      id: result.id + '-open',
      name: result.name,
      selectPriority: result.selectPriority || ActionSelectPriority.HIGH,
      displayPriority: result.displayPriority || ActionDisplayPriority.HIGH,
      execute: TeletypeAction.OpenSpaceAsContext,
      icon: result.icon,
      actionIcon: result.actionIcon,
      // NOTE: overriding this because it is a context switch
      // not sure completely how the flow of resultAction and this function is composed
      actionText: 'Switch to Context',
      actionPanel: result.actionPanel,
      handler: result.handler
    } as Action
    actions.push(openSpaceAction)
  }

  /*
  TODO: @aavash we should offer this but can't yet fully 
  // grok the logic of the action execution
  const openInStuffAction = {
    id: result.id + '-stuff-open',
    section: 'Open Context in Stuff',
    icon: result.icon,
    name: result.name,
    selectPriority: result.selectPriority || ActionSelectPriority.HIGH,
    displayPriority: result.displayPriority || ActionDisplayPriority.HIGH,
    execute: TeletypeAction.OpenSpaceInStuff,
    actionIcon: result.actionIcon,
    actionText: 'Open',
    actionPanel: result.actionPanel,
    handler: result.handler
  } as Action
  actions.push(openInStuffAction)
  */
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
          const actions = await createSpaceAction(result, oasis)
          return actions
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
