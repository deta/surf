import { ResourceTagsBuiltInKeys } from '@deta/types'
import {
  conditionalArrayItem,
  getFileKind,
  getFileType,
  truncateURL,
  useLogScope
} from '@deta/utils'
import type { AIService } from './ai'
import { Provider } from '@deta/types/src/ai.types'
import {
  BROWSER_HISTORY_MENTION,
  BUILT_IN_MENTIONS_BASE,
  INBOX_MENTION,
  NOTE_MENTION,
  WIKIPEDIA_SEARCH_MENTION
} from '../constants/chat'
import { MentionItemType, type MentionItem as MentionItemEditor } from '@deta/editor'
import { type ResourceManager } from '@deta/services/resources'
import type { MentionItemsFetcher } from '@deta/editor/extensions/Mention'
import { SearchResourceTags } from '@deta/utils/formatting'
import { MentionTypes } from '../mentions/mention.types'
import { useMessagePortClient } from '../messagePort'

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
          ...SearchResourceTags.NonHiddenDefaultTags({
            excludeAnnotations: false
          })
        ],
        {
          semanticEnabled: userSettings.use_semantic_search
        }
      )

      return result.resources
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
          } as MentionItemEditor
        })
    } else {
      return []
    }
  }
}

export const createMentionsFetcher = (
  services: { ai: AIService; resourceManager: ResourceManager },
  notResourceId?: string
) => {
  const log = useLogScope('MentionsHelper')
  const { ai, resourceManager } = services

  const resourceFetcher = createResourcesMentionsFetcher(resourceManager, notResourceId)

  const mentionItemsFetcher: MentionItemsFetcher = async ({ query }) => {
    log.debug('fetching mention items', query)

    const models = ai.modelsValue
    const userSettings = resourceManager.config.settingsValue

    const builtInMentions = [
      ...BUILT_IN_MENTIONS_BASE,
      ...conditionalArrayItem(!userSettings.save_to_active_context, INBOX_MENTION),
      ...conditionalArrayItem(!!notResourceId, NOTE_MENTION),
      ...conditionalArrayItem(userSettings.experimental_chat_web_search, WIKIPEDIA_SEARCH_MENTION),
      BROWSER_HISTORY_MENTION
    ]

    let modelMentions: MentionItemEditor[] = []

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
          }) as MentionItemEditor
      )
    }

    const items = [...builtInMentions, ...modelMentions]

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

export const createRemoteMentionsFetcher = (notResourceId?: string) => {
  const log = useLogScope('MentionsHelper')
  const messagePort = useMessagePortClient()

  const mentionItemsFetcher: MentionItemsFetcher = async ({ query }) => {
    log.debug('fetching mention items', query)

    const items = await messagePort.fetchMentions.request({ query })
    log.debug('fetched mention items', items)

    // Transform service items to editor format
    return items.map((item) => {
      let base = {
        id: item.id,
        label: item.name, // name -> label
        icon: item.icon,
        type: item.type,
        faviconURL: undefined,
        data: item.metadata
      } as MentionItemEditor

      if (item.type === MentionTypes.TAB) {
        base.id = item.metadata?.tabId || item.id
        base.icon = ''
        base.faviconURL = item.icon
      }

      return base
    })
  }

  return mentionItemsFetcher
}
