import { type MentionItem } from '@deta/editor'
import type { ActionProvider, TeletypeAction } from '../types'
import {
  generateUUID,
  useLogScope,
  prependProtocol,
  SearchResourceTags,
  truncate,
  getFileKind
} from '@deta/utils'
import { Resource, ResourceJSON, useResourceManager } from '../../resources'
import { ResourceTagsBuiltInKeys, ResourceTypes } from '@deta/types'
import { useBrowser } from '../../browser'

export class ResourcesProvider implements ActionProvider {
  readonly name = 'resources-search'
  readonly isLocal = false
  readonly maxActions = 9

  private readonly log = useLogScope('ResourcesProvider')
  private readonly resourceManager = useResourceManager()
  private readonly browser = useBrowser()

  canHandle(query: string): boolean {
    return query.trim().length >= 2
  }

  async getActions(query: string, _mentions: MentionItem[]): Promise<TeletypeAction[]> {
    const actions: TeletypeAction[] = []
    const trimmedQuery = query.trim()

    if (trimmedQuery.length < 2) return actions

    try {
      const resources = await this.searchResources(trimmedQuery)
      let noteCount = 0
      let otherCount = 0

      resources.forEach((resource, index) => {
        if (resource.type === ResourceTypes.DOCUMENT_SPACE_NOTE) {
          if (noteCount >= 3) return
          noteCount++
        } else {
          if (otherCount >= 6) return
          otherCount++
        }

        actions.push(
          this.createSearchAction(resource, 80 - index, ['search', 'suggestion', 'google'])
        )
      })
    } catch (error) {
      this.log.error('Failed to fetch search suggestions:', error)
    }

    return actions
  }

  private createSearchAction(
    resource: Resource,
    priority: number,
    keywords: string[]
  ): TeletypeAction {
    const url =
      resource.metadata?.sourceURI ??
      resource.tags?.find((tag) => tag.name === ResourceTagsBuiltInKeys.CANONICAL_URL)?.value
    const data = (resource as ResourceJSON<any>).parsedData

    return {
      id: generateUUID(),
      name: truncate(
        data?.title ||
          resource.metadata?.name ||
          url ||
          `${resource.id} - ${resource.type}` ||
          'Undefined',
        30
      ),
      icon: url
        ? `favicon;;${url}`
        : resource.type === ResourceTypes.DOCUMENT_SPACE_NOTE
          ? 'note'
          : `file;;${getFileKind(resource.type)}`,
      section: resource.type === ResourceTypes.DOCUMENT_SPACE_NOTE ? 'Your Notes' : 'Saved Sources',
      priority,
      keywords,
      description: ``,
      buttonText: 'Open',
      handler: async () => {
        this.log.debug('Handling resource open', resource)
        await this.browser.openResourceInCurrentTab(resource)
      }
    }
  }

  private async searchResources(query: string): Promise<Resource[]> {
    try {
      const results = await this.resourceManager.searchResources(
        query,
        [...SearchResourceTags.NonHiddenDefaultTags()],
        {
          includeAnnotations: false,
          semanticEnabled: this.resourceManager.config.settingsValue.use_semantic_search
          // semanticLimit: 0,
          // keywordLimit: 6
        }
      )

      const resources = results.resources.map((x) => x.resource)

      // await Promise.all(
      //   resources.map((resource) => {
      //     if (resource instanceof ResourceJSON) {
      //       return resource.getParsedData()
      //     }
      //   })
      // )

      return resources
    } catch (error) {
      this.log.error('Error fetching Google suggestions:', error)
      return []
    }
  }
}
