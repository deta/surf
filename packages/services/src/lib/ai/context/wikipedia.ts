import { writable } from 'svelte/store'

import { createWikipediaAPI, WikipediaAPI } from '@deta/web-parser'
import { optimisticParseJSON } from '@deta/utils'
import { ModelTiers } from '@deta/types/src/ai.types'

import { ContextItemBase } from './base'
import type { ContextService } from '../contextManager'
import { ContextItemIconTypes, ContextItemTypes } from './types'
import { WIKIPEDIA_TITLE_EXTRACTOR_PROMPT } from '../../constants/prompts'
import { ResourceTag } from '@deta/utils/formatting'

export class ContextItemWikipedia extends ContextItemBase {
  type = ContextItemTypes.WIKIPEDIA

  api: WikipediaAPI

  createdResourceIds: string[] = []

  constructor(service: ContextService) {
    super(service, 'wikipedia', 'search', {
      type: ContextItemIconTypes.IMAGE,
      data: `https://www.google.com/s2/favicons?domain=https://wikipedia.org&sz=48`
    })

    this.label = writable('Ask Wikipedia')

    this.api = createWikipediaAPI()
  }

  async getResourceIds(prompt?: string) {
    if (!prompt) {
      this.log.debug('No prompt provided')
      return []
    }

    this.log.debug('Getting Wikipedia title from prompt:', prompt)
    const completion = await this.service.ai.createChatCompletion(
      prompt,
      WIKIPEDIA_TITLE_EXTRACTOR_PROMPT,
      { tier: ModelTiers.Standard }
    )

    let titles = [{ title: prompt, lang: 'en' }]
    if (!completion.error && completion.output) {
      const clean = completion.output
        .replace('```json\n', '')
        .replace('```json', '')
        .replace('\n```', '')
        .replace('```', '')

      const parsed = optimisticParseJSON(clean)
      this.log.debug('Parsed JSON from completion:', parsed)
      if (parsed && Array.isArray(parsed)) {
        titles = parsed
      } else {
        titles = [{ title: completion.output, lang: 'en' }]
      }
    }

    this.log.debug('Searching Wikipedia for:', titles)

    const rawPages = await Promise.all(
      titles.map(async (item) => {
        const page = await this.api.getFirstPage(item.title, item.lang ?? 'en')
        this.log.debug('Got Wikipedia page:', page)
        return page
      })
    )

    const pages = rawPages
      .filter((page) => page !== null)
      .filter((page, index, self) => self.findIndex((p) => p.id === page.id) === index)
    if (pages.length === 0) {
      this.log.debug('No Wikipedia pages found')
      return []
    }

    this.log.debug('Creating resources for Wikipedia pages:', pages)

    const resourceIds = await Promise.all(
      pages.map(async (page) => {
        const resource = await this.service.resourceManager.createResourceLink(
          {
            url: page.url,
            content_html: page.content,
            title: page.title
          },
          { name: page.title, sourceURI: page.url },
          [ResourceTag.silent(), ResourceTag.createdForChat()]
        )

        this.log.debug('Created resource for page', page, resource)

        return resource.id
      })
    )

    this.createdResourceIds.push(...resourceIds)

    return resourceIds
  }

  async getInlineImages() {
    // TODO: in theory we could grab all image resources here
    return []
  }

  async generatePrompts() {
    return []
  }

  onDestroy(): void {
    this.log.debug('Destroying Wikipedia context item, cleaning up', this.createdResourceIds)

    if (this.createdResourceIds.length > 0) {
      this.service.resourceManager.deleteResources(this.createdResourceIds)
    }
  }
}
