import {
  EventContext,
  PageChatMessageSentEventError,
  PromptType,
  type ChatMessageContentItem,
  type AIChatMessageSource,
  type AIChatMessageParsed,
  type DetectedResource,
  type WebViewEventSendNames,
  type WebViewSendEvents
} from '@deta/types'
import { codeLanguageToMimeType, markdownToHtml, useLogScope } from '@deta/utils'
import { WebParser } from '@deta/web-parser'
import { PromptIDs, getPrompt } from './prompts'
import type { AIService } from './aiClean'
import {
  APIKeyMissingError,
  BadRequestError,
  TooManyRequestsError,
  UnauthorizedError
} from '@deta/backend/types'
import { type ChatError } from '@deta/types/src/ai.types'
import { ResourceManager } from '@deta/services/resources'
import { ResourceTag } from '@deta/utils/formatting'

const log = useLogScope('AI')

export const DUMMY_CHAT_RESPONSE = `
<id>{message_id}</id>

<sources>
	<source>
		<id>source1</id>
		<resource_id>resource1</resource_id>
		<content>hey there</content>
		<!-- Optional Metadata for the source id -->
		<metadata>
			<timestamp>
				12
			</timestamp>
		</metadata>
	</source>
</sources>

<answer>
An answer text. The citation will follow one of more sentences if present like this <citation>source1</citation>. You could have multiple citations in a single answer like this <citation>source2</citation> <citation>source3</citation>.
</answer>
`

export const escapeXML = (xml: string) => {
  return xml.replace(/&(?!(amp;|lt;|gt;|quot;|apos;))/g, '&amp;')
}

export const parseXML = (xml: string) => {
  const parser = new DOMParser()

  const escapedXML = escapeXML(xml)
  const xmlDoc = parser.parseFromString(`<xml>${escapedXML}</xml>`, 'text/xml')

  const parseError = xmlDoc.getElementsByTagName('parsererror')
  if (parseError.length > 0) {
    console.warn('Error parsing chat response: ' + (parseError[0]?.textContent ?? 'unknown error'))
    return xmlDoc
  }

  return xmlDoc
}

export const parseXMLChatResponseSources = (xml: Document) => {
  const sources = xml.getElementsByTagName('source')

  const sourceData = Array.from(sources).map((source) => {
    const id = source.getElementsByTagName('id')[0].textContent
    const uid = source.getElementsByTagName('uid')[0]?.textContent
    const resource_id = source.getElementsByTagName('resource_id')[0]?.textContent
    const content = source.getElementsByTagName('content')[0]?.textContent
    const timestamp = source.getElementsByTagName('timestamp')[0]?.textContent
    const url = source.getElementsByTagName('url')[0]?.textContent
    const page = source.getElementsByTagName('page')[0]?.textContent

    return {
      id,
      uid,
      resource_id,
      content,
      metadata: {
        timestamp: timestamp ? Number(timestamp) : undefined,
        url: url ? String(url) : undefined,
        page: page ? Number(page) : undefined
      }
    } as AIChatMessageSource
  })

  return sourceData
}

export const parseXMLChatResponseAnswer = (xml: Document) => {
  const answer = xml.getElementsByTagName('answer')[0] ?? xml

  // convert the answer html to an array of text items and citiation items following the order that they appear in in the string
  const items: ChatMessageContentItem[] = []
  let currentText = ''
  let currentCitation = ''

  for (let i = 0; i < answer.childNodes.length; i++) {
    const node = answer.childNodes[i]

    if (node.nodeName === 'citation') {
      items.push({ type: 'citation', content: node.textContent ?? '' })
    } else if (node.nodeName === '#text') {
      items.push({ type: 'text', content: node.textContent ?? '' })
    } else {
      // @ts-ignore
      items.push({ type: 'text', content: node.innerHTML ?? '' })
    }
  }

  return { content: answer.textContent, contentItems: items }
}

export const parseXMLChatResponseID = (xml: Document) => {
  const id = xml.getElementsByTagName('id')[0]?.textContent
  return id
}

// This function is used to check if the chat response chunk is complete or not
export const checkChatResponseChunkState = (chunk: string) => {
  const state = {
    id: false,
    sources: false,
    answer: false
  }

  if (chunk.includes('</id>')) {
    state.id = true
  }

  if (chunk.includes('</sources>')) {
    state.sources = true
  }

  if (chunk.includes('</answer>')) {
    state.answer = true
  }

  return state
}

export const parseChatResponse = (response: string) => {
  const state = checkChatResponseChunkState(response)
  const isDone = state.id && state.sources && state.answer

  const stage = isDone
    ? 'done'
    : state.answer
      ? 'answer'
      : state.sources
        ? 'sources'
        : state.id
          ? 'id'
          : 'incomplete'

  const result = {
    id: null as string | null,
    complete: isDone,
    stage: stage,
    sources: [] as AIChatMessageSource[],
    content: null as string | null,
    contentItems: null as ChatMessageContentItem[] | null
  }

  const xml = parseXML(response)

  if (state.id) {
    result.id = parseXMLChatResponseID(xml)
  }

  if (state.sources) {
    result.sources = parseXMLChatResponseSources(xml)
  }

  if (state.answer) {
    const parsed = parseXMLChatResponseAnswer(xml)
    result.contentItems = parsed.contentItems
    result.content = parsed.content
  }

  return result
}

export const parseChatResponseContent = (response: string) => {
  const xml = parseXML(response)
  return parseXMLChatResponseAnswer(xml)
}

export const parseChatResponseSources = (response: string) => {
  const xml = parseXML(response)
  return parseXMLChatResponseSources(xml)
}

export const handleInlineAI = async (
  ai: AIService,
  data: WebViewSendEvents[WebViewEventSendNames.Transform],
  detectedResource: DetectedResource
) => {
  const { text, query, type, includePageContext } = data
  log.debug('Inline AI transformation', data)

  const content = WebParser.getResourceContent(detectedResource.type, detectedResource.data)
  const pageContext = detectedResource
    ? `\n\nFull page content to use only as reference:\n${content.plain}`
    : ''

  const userMessages = [
    text,
    ...(includePageContext ? [`Additional context from the page: "${pageContext}"`] : [])
  ]

  let transformation: string | null = ''
  if (type === 'summarize') {
    const prompt = await getPrompt(PromptIDs.INLINE_SUMMARIZER)
    const completion = await ai.createChatCompletion(userMessages, prompt.content)
    if (completion.error) {
      log.error('Failed to generate completion', completion.error)
      return null
    }

    transformation = completion.output
  } else if (type === 'explain') {
    const prompt = await getPrompt(PromptIDs.INLINE_EXPLAINER)
    const completion = await ai.createChatCompletion(userMessages, prompt.content)
    if (completion.error) {
      log.error('Failed to generate completion', completion.error)
      return null
    }

    transformation = completion.output
  } else if (type === 'translate') {
    const prompt = await getPrompt(PromptIDs.INLINE_TRANSLATE)
    log.debug('translate prompt', prompt)
    const completion = await ai.createChatCompletion(userMessages, prompt.content)
    if (completion.error) {
      log.error('Failed to generate completion', completion.error)
      return null
    }

    transformation = completion.output
  } else if (type === 'grammar') {
    const prompt = await getPrompt(PromptIDs.INLINE_GRAMMAR)
    const completion = await ai.createChatCompletion(userMessages, prompt.content)
    if (completion.error) {
      log.error('Failed to generate completion', completion.error)
      return null
    }

    transformation = completion.output
  } else if (query) {
    const prompt = await getPrompt(PromptIDs.INLINE_TRANSFORM_USER)
    const completion = await ai.createChatCompletion(
      [
        query,
        text,
        ...(includePageContext ? [`Additional context from the page: "${pageContext}"`] : [])
      ],
      prompt.content
    )

    if (completion.error) {
      log.error('Failed to generate completion', completion.error)
      return null
    }

    transformation = completion.output
  }

  return transformation
}

export const parseAIError = (e: any) => {
  let content = ''
  let error = PageChatMessageSentEventError.Other

  if (e instanceof TooManyRequestsError) {
    error = PageChatMessageSentEventError.TooManyRequests
    content = 'Too many requests. Please try again later.'
  } else if (e instanceof APIKeyMissingError) {
    error = PageChatMessageSentEventError.APIKeyMissing
    content = 'API key is missing. Configure an API key in your Settings to continue.'
  } else if (e instanceof BadRequestError) {
    error = PageChatMessageSentEventError.BadRequest
    content =
      e.message || 'The AI server sent a bad request response, you can try modifying your query'
  } else if (e instanceof UnauthorizedError) {
    error = PageChatMessageSentEventError.Unauthorized
    content =
      'Unauthorized, please check your API key and make sure you have right access permissions.'
  } else {
    content = 'Encountered an unexpected error: ' + (e?.message || String(e))
  }
  if (typeof e === 'string' && e.toLowerCase().includes('Content is too long'.toLowerCase())) {
    content = 'The content is too long to process. Please try a more specific question.'
  }

  if (typeof e === 'string' && e.includes('RAG Empty Context')) {
    content = `Unfortunately, we failed to find relevant information to answer your query.
\nThere might have been an issue with extracting all information from your current context.
\nPlease try asking a different question or let us know if the issue persists.`
  }

  return {
    type: error,
    message: content
  } as ChatError
}

const aggregateTextNodes = (node: Node, text: string, stopCitationId: string) => {
  if (node.nodeType === Node.TEXT_NODE) {
    const textNode = node as Text
    text += textNode.textContent
  } else if (node.nodeType === Node.ELEMENT_NODE) {
    const elem = node as HTMLElement

    if (elem.tagName === 'CITATION') {
      const uid = elem.getAttribute('data-uid')
      if (uid === stopCitationId) {
        return text
      }
    } else {
      for (const child of elem.childNodes) {
        text = aggregateTextNodes(child, text, stopCitationId)
      }
    }
  }

  return text
}

// concatenate text nodes that come before the citation node within the same parent node
const getCitationParentTextContent = (citation: HTMLElement) => {
  let text = ''

  let parent = citation.parentNode as HTMLElement

  // handle citations wrapped in spans from the Editor
  if (parent.tagName === 'SPAN' && parent.hasAttribute('data-citation-id')) {
    parent = parent.parentNode as HTMLElement
  }

  if (!parent) {
    return ''
  }

  for (const child of parent.childNodes) {
    if (child === citation) {
      break
    }

    text = aggregateTextNodes(child, text, citation.id)
  }

  return text
}

export const mapCitationsToText = (content: HTMLElement) => {
  log.debug('Mapping citations to text', content)
  let citationsToText = new Map<string, string>()

  /*
			For each citation node, we need to find the text that corresponds to it.
			We do this by finding the text node that comes before the citation node.
			We need to make sure we only use the relevant text not the entire text content between the last citation and the current citation.
			We do this by only taking the text nodes of elements that are directly in front of the citation node.

			Example:
			<p>First text with a citation <citation>1</citation></p>
			<p>Second text with a citation <citation>2</citation></p>
			<p>Third text with no citation</p>
			<p>Forth <strong>text</strong> with a citation <citation>3</citation></p>

			Parsed mapping:

			1: First text with a citation
			2: Second text with a citation
			3: Forth text with a citation
	*/

  let lastText = ''

  /*
			loop through all child nodes to find the citation node
			take all text nodes that come before the citation within the same parent node and concatenate them
			if the citation node is inside a styled node like <strong> or <em> we need to take the text node of the styled node
	*/

  const mapCitationsToTextRecursive = (node: Node, citationsToText: Map<string, string>) => {
    if (node.nodeType === Node.ELEMENT_NODE) {
      const elem = node as HTMLElement
      if (elem.tagName === 'CITATION') {
        const citationID = elem.getAttribute('data-uid')
        const text = getCitationParentTextContent(elem)

        if (!citationID) {
          log.error('ChatMessage: No citation ID found for citation', elem)
          return
        }

        if (text) {
          if (citationsToText.has(citationID)) {
            citationsToText.set(citationID, citationsToText.get(citationID) + ' | ' + text)
          } else {
            citationsToText.set(citationID, text)
          }
        }
      } else {
        for (const child of elem.childNodes) {
          mapCitationsToTextRecursive(child, citationsToText)
        }
      }
    }
  }

  mapCitationsToTextRecursive(content, citationsToText)

  log.debug('Mapped citations to text', citationsToText)

  return citationsToText
}

export const renderIDFromCitationID = (
  citationID: string | null,
  sources?: AIChatMessageSource[]
) => {
  if (!citationID || !sources) return ''

  for (const source of sources) {
    if (source.all_chunk_ids.includes(citationID)) {
      return source.render_id
    }
  }
  return ''
}

export const getCitationInfo = (id: string, sources?: AIChatMessageSource[]) => {
  const renderID = renderIDFromCitationID(id, sources)
  const source = sources?.find((source) => source.render_id === renderID)

  return {
    id,
    source,
    renderID
  }
}

export const populateRenderAndChunkIds = (sources: AIChatMessageSource[] | undefined) => {
  if (!sources) return
  sources.forEach((source, idx) => {
    source.render_id = (idx + 1).toString()
    source.all_chunk_ids = [source.id]
  })
  return sources
}

export const convertChatOutputToNoteContent = async (
  response: AIChatMessageParsed,
  services: { resourceManager: ResourceManager }
) => {
  let content = response.content
  log.debug('Parsing response content', response, content)

  const sources = populateRenderAndChunkIds(response.sources)

  const element = document.getElementById(`chat-response-${response.id}`)
  if (!element) {
    log.debug('No element found for response', response)
    return null
  }

  const html = element.innerHTML
  const domParser = new DOMParser()
  const doc = domParser.parseFromString(html, 'text/html')

  const getInfo = (id: string) => {
    const renderID = renderIDFromCitationID(id, sources)
    const source = sources?.find((source) => source.render_id === renderID)

    return { id, source, renderID }
  }

  const citations = doc.querySelectorAll('citation')

  // loop through the citations and replace them with the citation item
  citations.forEach((citation) => {
    const id = citation.textContent
    if (!id) return

    const info = getInfo(id)
    citation.setAttribute('id', info.renderID)
    citation.setAttribute('data-info', encodeURIComponent(JSON.stringify(info)))
    citation.innerHTML = info.renderID
  })

  const replaceWithResource = (node: Element, resourceId: string, type: string) => {
    const newCodeBlock = document.createElement('resource')

    newCodeBlock.setAttribute('id', resourceId)
    newCodeBlock.setAttribute('data-type', type)
    newCodeBlock.innerHTML = ''

    node.replaceWith(newCodeBlock)
  }

  const codeBlocksRes = doc.querySelectorAll('code-block')
  const codeBlocks = Array.from(codeBlocksRes)

  for await (const codeBlock of codeBlocks) {
    try {
      const resourceId = codeBlock.getAttribute('data-resource')
      const language = codeBlock.getAttribute('data-language') ?? 'plaintext'
      const type = codeLanguageToMimeType(language)
      if (resourceId) {
        replaceWithResource(codeBlock, resourceId, type)
        continue
      }

      const pre = codeBlock.querySelector('pre')
      if (!pre) continue

      const code = pre.textContent
      if (!code) continue

      const name = codeBlock.getAttribute('data-name') ?? undefined
      // const rawUrl = tab?.type === 'page' ? tab.currentLocation || tab.initialLocation : undefined
      // const url = (rawUrl ? parseUrlIntoCanonical(rawUrl) : undefined) || undefined
      // todo: create resource with code
      log.debug('Creating resource for', language, { code })

      const resource = await services.resourceManager.findOrCreateCodeResource(
        {
          code,
          name,
          language,
          url: ''
        },
        undefined,
        [ResourceTag.silent()]
      )

      log.debug('Created resource', resource)

      if (resource) {
        replaceWithResource(codeBlock, resource.id, resource.type)
      }
    } catch (e) {
      log.error('Error creating code resource', e)
    }
  }

  // remove html comments like <!--  -->
  doc.querySelectorAll('comment').forEach((comment) => {
    comment.remove()
  })

  return doc.body.innerHTML
}

export const generateContentHash = (content: string) => {
  return content
    .split('')
    .reduce((acc, char) => acc + char.charCodeAt(0), 0)
    .toString()
}

export const parseChatOutputToHtml = async (output: AIChatMessageParsed) => {
  const content = output.content
  const sources = populateRenderAndChunkIds(output.sources)

  const domParser = new DOMParser()
  const doc = domParser.parseFromString(content, 'text/html')

  const citations = doc.querySelectorAll('citation')

  citations.forEach((elem) => {
    const id = elem.textContent
    if (!id) {
      log.error('No citation id found')
      return
    }

    const info = getCitationInfo(id, sources)
    elem.setAttribute('test', 'hello')
    elem.setAttribute('data-info', encodeURIComponent(JSON.stringify(info)))
  })

  // separate the <think> block from the rest of the content and convert both separately to html
  const thinkBlock = doc.querySelector('think')
  let thinkHtml = ''
  if (thinkBlock) {
    thinkHtml = await markdownToHtml(thinkBlock.innerHTML)
    thinkBlock.remove()
  }

  const markdown = doc.body.innerHTML
  let html = await markdownToHtml(markdown)
  if (thinkHtml) {
    html = `<think>${thinkHtml}</think>\n${html}`
  }

  return html
}

export const parseChatOutputToSurfletCode = async (output: AIChatMessageParsed) => {
  const content = output.content

  const completeCodeBlockRegex = /```(?:[\w]*\n)?([\s\S]*?)```/
  const completeMatch = content.match(completeCodeBlockRegex)

  const openCodeBlockRegex = /```(?:[\w]*\n)?([\s\S]*)/
  const openMatch = content.match(openCodeBlockRegex)

  let match = ''
  if (completeMatch) {
    match = completeMatch[1]
  } else if (openMatch) {
    match = openMatch[1]
  }
  const surflet = document.createElement('surflet')
  const codeElement = document.createElement('code')
  codeElement.textContent = match // this properly escapes the content

  surflet.appendChild(codeElement)
  return surflet.outerHTML
}

const prepLoadingPhrases = [
  'Analysing your context…',
  'Getting to the essence…',
  'Surfing the data…',
  'Unpacking details…',
  'Summoning the goodies…',
  'Charging the knowledge battery…',
  'Gathering bits of brilliance…',
  'Preparing the magic…',
  'Crafting the wisdom…',
  'Cooking up the insights…',
  'Brewing the brilliance…'
]

const writingLoadingPhrases = [
  'Writing…',
  'Composing…',
  'Gathering thoughts…',
  'Crafting the words…',
  'Weaving the wisdom…',
  'Spinning the story…',
  'Painting the picture…',
  'Sculpting the text…',
  'Inking the ideas…'
]

export const getPrepPhrase = () => {
  return prepLoadingPhrases[Math.floor(Math.random() * prepLoadingPhrases.length)]
}

export const getWritingPhrase = () => {
  return writingLoadingPhrases[Math.floor(Math.random() * writingLoadingPhrases.length)]
}
