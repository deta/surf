import type { DetectedResource } from '@horizon/types'
import type { ChatMessageContentItem, ChatMessageSource } from '../components/Browser/types'
import type { WebViewWrapperEvents } from '../components/Cards/Browser/WebviewWrapper.svelte'
import { SIMPLE_SUMMARIZER_PROMPT } from '../constants/prompts'
import log from '../utils/log'
import { WebParser } from '@horizon/web-parser'
import { PromptIDs, getPrompt } from './prompts'

export const summarizeText = async (text: string, additionalSystemPrompt?: string) => {
  // @ts-expect-error
  const summary = await window.api.createAIChatCompletion(
    text,
    SIMPLE_SUMMARIZER_PROMPT + (additionalSystemPrompt ? ' ' + additionalSystemPrompt : '')
  )

  log.debug('Summarized text', summary)

  return summary as string
}

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

export const parseXML = (xml: string) => {
  const parser = new DOMParser()
  const xmlDoc = parser.parseFromString(`<xml>${xml}</xml>`, 'text/xml')

  console.log('xmlDoc', xmlDoc)

  const parseError = xmlDoc.getElementsByTagName('parsererror')
  if (parseError.length > 0) {
    console.warn('Error parsing chat response: ' + parseError[0]?.textContent ?? 'unknown error')
    return xmlDoc
  }

  return xmlDoc
}

export const parseXMLChatResponseSources = (xml: Document) => {
  const sources = xml.getElementsByTagName('source')

  const sourceData = Array.from(sources).map((source) => {
    const id = source.getElementsByTagName('id')[0].textContent
    const hash = source.getElementsByTagName('hash')[0]?.textContent
    const resource_id = source.getElementsByTagName('resource_id')[0]?.textContent
    const content = source.getElementsByTagName('content')[0]?.textContent
    const timestamp = source.getElementsByTagName('timestamp')[0]?.textContent
    const url = source.getElementsByTagName('url')[0]?.textContent

    console.log('source', id, resource_id, content, timestamp, url)

    return {
      id,
      hash,
      resource_id,
      content,
      metadata: {
        timestamp: timestamp ? Number(timestamp) : undefined,
        url: url ? String(url) : undefined
      }
    } as ChatMessageSource
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

    console.log('node', node.nodeName, node)

    if (node.nodeName === 'citation') {
      items.push({ type: 'citation', content: node.textContent ?? '' })
    } else if (node.nodeName === '#text') {
      items.push({ type: 'text', content: node.textContent ?? '' })
    } else {
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
    sources: [] as ChatMessageSource[],
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
  data: WebViewWrapperEvents['transform'],
  detectedResource: DetectedResource
) => {
  const { text, query, type, includePageContext } = data

  const content = WebParser.getResourceContent(detectedResource.type, detectedResource.data)
  const pageContext = detectedResource
    ? `\n\nFull page content to use only as reference:\n${content.plain}`
    : ''

  const textContent = includePageContext
    ? `Text selection from the user: ${text}\n\n Additional context from the page: ${pageContext}`
    : text

  let transformation = ''
  if (type === 'summarize') {
    const prompt = await getPrompt(PromptIDs.INLINE_SUMMARIZER)
    // @ts-expect-error
    transformation = await window.api.createAIChatCompletion(textContent, prompt.content)
  } else if (type === 'explain') {
    const prompt = await getPrompt(PromptIDs.INLINE_EXPLAINER)
    // @ts-expect-error
    transformation = await window.api.createAIChatCompletion(textContent, prompt.content)
  } else if (type === 'translate') {
    const prompt = await getPrompt(PromptIDs.INLINE_TRANSLATE)
    log.debug('translate prompt', prompt)
    // @ts-expect-error
    transformation = await window.api.createAIChatCompletion(textContent, prompt.content)
  } else if (type === 'grammar') {
    const prompt = await getPrompt(PromptIDs.INLINE_GRAMMAR)
    // @ts-expect-error
    transformation = await window.api.createAIChatCompletion(textContent, prompt.content)
  } else {
    const prompt = await getPrompt(PromptIDs.INLINE_TRANSFORM_USER)
    // @ts-expect-error
    transformation = await window.api.createAIChatCompletion(
      `User instruction: "${query}"\n\n` + includePageContext
        ? textContent
        : `Text selection from the user: ${text}`,
      prompt.content
    )
  }

  return transformation
}
