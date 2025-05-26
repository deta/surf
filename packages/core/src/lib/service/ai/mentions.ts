import { ResourceTagsBuiltInKeys, ResourceTypes } from '@horizon/types'
import {
  conditionalArrayItem,
  getFileKind,
  getFileType,
  truncate,
  truncateURL,
  useLogScope
} from '@horizon/utils'
import type { AIService } from './ai'
import { Provider } from '@horizon/types/src/ai.types'
import type { OasisService } from '../oasis'
import {
  BUILT_IN_MENTIONS_BASE,
  INBOX_MENTION,
  NOTE_MENTION,
  WIKIPEDIA_SEARCH_MENTION
} from '../../constants/chat'
import { MentionItemType, type MentionItem } from '@horizon/editor'
import { ResourceManager } from '../resources'
import type { MentionItemsFetcher } from '@horizon/editor/src/lib/extensions/Mention/suggestion'

export const createResourcesMentionsFetcher = (
  resourceManager: ResourceManager,
  notResourceId?: string
) => {
  const log = useLogScope('ResourcesMentionsFetcher')
  const userSettings = resourceManager.config.settingsValue

  return async (query: string) => {
    log.debug('fetching mention items', query)

    if (query.length > 0) {
      const result = await resourceManager.searchResources(
        query,
        [
          ResourceManager.SearchTagDeleted(false),
          ResourceManager.SearchTagResourceType(ResourceTypes.HISTORY_ENTRY, 'ne'),
          ResourceManager.SearchTagNotExists(ResourceTagsBuiltInKeys.SILENT),
          ResourceManager.SearchTagNotExists(ResourceTagsBuiltInKeys.HIDE_IN_EVERYTHING)
        ],
        {
          semanticEnabled: userSettings.use_semantic_search
        }
      )

      return result
        .filter((item) => item.resource.id !== notResourceId)
        .slice(0, 10)
        .map((item) => {
          const resource = item.resource

          const canonicalURL =
            (resource.tags ?? []).find((tag) => tag.name === ResourceTagsBuiltInKeys.CANONICAL_URL)
              ?.value || resource.metadata?.sourceURI

          const getLabel = (max: number) => {
            if (resource.metadata?.name) {
              return resource.metadata.name
            } else if (canonicalURL) {
              // while truncating is also handled in CSS, for URLs we want to truncate in a smarter way so as much information as possible is shown
              return truncateURL(canonicalURL, max)
            } else {
              return getFileType(resource.type)
            }
          }

          return {
            id: resource.id,
            label: getLabel(35),
            suggestionLabel: getLabel(35),
            hideInRoot: true,
            icon: canonicalURL ? `favicon;;${canonicalURL}` : `file;;${getFileKind(resource.type)}`,
            type: MentionItemType.RESOURCE,
            data: resource
          } as MentionItem
        })
    } else {
      return []
    }
  }
}

export const createMentionsFetcher = (
  services: { oasis: OasisService; ai: AIService; resourceManager: ResourceManager },
  notResourceId?: string
) => {
  const log = useLogScope('MentionsHelper')
  const { oasis, ai, resourceManager } = services

  const resourceFetcher = createResourcesMentionsFetcher(resourceManager, notResourceId)

  const mentionItemsFetcher: MentionItemsFetcher = async ({ query }) => {
    log.debug('fetching mention items', query)

    const spaces = oasis.spacesObjectsValue
    const models = ai.modelsValue
    const userSettings = oasis.config.settingsValue

    const builtInMentions = [
      ...BUILT_IN_MENTIONS_BASE,
      ...conditionalArrayItem(!userSettings.save_to_active_context, INBOX_MENTION),
      ...conditionalArrayItem(!!notResourceId, NOTE_MENTION),
      ...conditionalArrayItem(userSettings.experimental_chat_web_search, WIKIPEDIA_SEARCH_MENTION)
    ]

    let modelMentions: MentionItem[] = []

    if (query) {
      // With query: show all matching models, else only show the default models
      modelMentions = models.map(
        (model) =>
          ({
            id: `model-${model.id}`,
            label: model.label,
            suggestionLabel: `Ask ${model.label}`,
            aliases: ['model', 'ai', model.custom_model_name, model.provider].filter(
              Boolean
            ) as string[],
            icon: model.icon,
            type: MentionItemType.MODEL,
            hideInRoot: model.provider !== Provider.Custom
          }) as MentionItem
      )
    }

    const spaceItems = spaces
      .sort((a, b) => {
        return a.indexValue - b.indexValue
      })
      .map(
        (space) =>
          ({
            id: space.id,
            label: space.dataValue.folderName,
            icon: space.getIconString(),
            type: MentionItemType.CONTEXT
          }) as MentionItem
      )

    const items = [...builtInMentions, ...modelMentions, ...spaceItems]

    if (!query) {
      return items
    }

    const compare = (a: string, b: string) => a.toLowerCase().includes(b.toLowerCase())

    const filteredActions = items.filter((item) => {
      if (!query && item.hideInRoot) {
        return false
      }

      if (query && item.hideInSearch) {
        return false
      }

      if (compare(item.label, query)) {
        return true
      }

      if (item.aliases && item.aliases.some((alias) => compare(alias, query))) {
        return true
      }

      return false
    })

    const stuffResults = await resourceFetcher(query)

    return [...filteredActions, ...stuffResults]
  }

  return mentionItemsFetcher
}
