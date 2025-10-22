import type { MentionProvider, MentionItem, MentionType } from '../mention.types'
import { MentionTypes } from '../mention.types'
import { getFileKind, SearchResourceTags, truncate, useLogScope } from '@deta/utils'
import { Resource, ResourceJSON, useResourceManager } from '../../resources'
import { ResourceTagsBuiltInKeys } from '@deta/types'

export class ResourceMentionProvider implements MentionProvider {
  readonly name = 'resources'
  readonly type: MentionType = MentionTypes.RESOURCE
  readonly isLocal = true
  private readonly log = useLogScope('ResourceMentionProvider')

  private resourceManager = useResourceManager()

  async initialize(): Promise<void> {
    this.log.debug('Initialized')
  }

  canHandle(query: string): boolean {
    return query.trim().length > 2
  }

  async getMentions(query: string): Promise<MentionItem[]> {
    try {
      const resources = await this.searchResources(query.trim())

      if (!resources || resources.length === 0) {
        return []
      }

      const mentionItems: MentionItem[] = resources.slice(0, 8).map((resource) => {
        const url = resource.url
        const data = (resource as ResourceJSON<any>).parsedData

        return {
          id: resource.id,
          type: MentionTypes.RESOURCE,
          name: truncate(
            data?.title ||
              resource.metadata?.name ||
              url ||
              `${resource.id} - ${resource.type}` ||
              'Undefined',
            30
          ),
          icon: url ? `favicon;;${url}` : `file;;${getFileKind(resource.type)}`,
          description: url ? `${url}` : undefined,
          priority: 50,
          keywords: ['resource', url ? new URL(url).hostname.toLowerCase() : ''].filter(Boolean),
          metadata: {
            resourceId: resource.id,
            url: url
          }
        }
      })

      return mentionItems

      // Strip the @ character from the query for filtering
      // const searchQuery = query.startsWith('@') ? query.slice(1) : query

      // // Filter and sort by query relevance
      // return filterAndSortMentions(mentionItems, searchQuery)
    } catch (error) {
      this.log.error('Error fetching tabs for mentions:', error)
      return []
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

  destroy(): void {
    // Cleanup if needed
  }
}
