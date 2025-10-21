import { toHtml } from 'hast-util-to-html'
import type { State } from 'hast-util-to-mdast'
import type { Element } from 'hast'
import type { Nodes as MdastNodes } from 'mdast'

/**
 * Handle citation elements like:
 * ```
 * <citation data-id="11" data-info="%7B%22id%22%3A%2211%22%2C%22source%22%3A%7B%22id%22%3A%2211%22%2C%22uid%22%3A%22649c898e-466f-4c3b-9c3c-4f7a3e40e731%22%2C%22resource_id%22%3A%223c35b630-e298-4824-8c34-e3c14c46ceeb%22%2C%22metadata%22%3A%7B%22timestamp%22%3A20.48%2C%22url%22%3A%22https%3A%2F%2Fyoutube.com%2Fwatch%3Fv%3Db6mo-rTiJoE%22%7D%2C%22render_id%22%3A%2211%22%2C%22all_chunk_ids%22%3A%5B%2211%22%5D%7D%2C%22renderID%22%3A%2211%22%7D" id="11" info="[object Object]">11</citation>
 * ```
 */
export const handleCitations = (state: State, node: Element) => {
  try {
    // Get the data-info attribute and parse it
    const dataInfo = node.properties?.dataInfo
    if (typeof dataInfo === 'string') {
      const info = JSON.parse(decodeURIComponent(dataInfo))
      const url = info.source?.metadata?.url
      const timestamp = info.source?.metadata?.timestamp

      if (url) {
        // If it's a YouTube URL and has a timestamp, add it to the URL
        if (url.includes('youtube.com') && timestamp) {
          const timestampInSeconds = Math.floor(parseFloat(timestamp)).toString()
          const minutes = Math.floor(parseInt(timestampInSeconds) / 60)
          const seconds = parseInt(timestampInSeconds) % 60
          const formattedTimestamp = `${minutes}:${seconds.toString().padStart(2, '0')}`
          const result = {
            type: 'link',
            url: `${url}&t=${timestampInSeconds}`,
            children: [{ type: 'text', value: `(${formattedTimestamp})` }]
          } satisfies MdastNodes

          state.patch(node, result)
          return result
        } else {
          // For other URLs, just create a simple link
          const result = {
            type: 'link',
            url: url,
            children: [
              {
                type: 'text',
                value: `(${(() => {
                  try {
                    return new URL(url).hostname
                  } catch {
                    return (node.children[0] as any)?.value || url
                  }
                })()})`
              }
            ]
          } satisfies MdastNodes
          state.patch(node, result)
          return result
        }
      }
    }
  } catch (error) {
    console.error('Error processing citation:', error)
  }

  // Fallback to original HTML if parsing fails
  const result = { type: 'html', value: toHtml(node) } satisfies MdastNodes
  state.patch(node, result)
  return result
}

/**
 * Handle websearch elements like:
 * ```
 * <websearch data-query="latest details on Apple Liquid Glass visual design technology version 26, features, performance, real-world usage, UI trends, supported devices" data-results="[{&quot;url&quot;:&quot;https://www.macrumors.com/guide/ios-26-liquid-glass/&quot;,&quot;title&quot;:&quot;iOS 26: Everything You Need to Know About the Liquid Glass Redesign&quot;},{&quot;url&quot;:&quot;https://www.apple.com/newsroom/2025/06/apple-introduces-a-delightful-and-elegant-new-software-design/&quot;,&quot;title&quot;:&quot;Apple introduces a delightful and elegant new software design&quot;},{&quot;url&quot;:&quot;https://applescoop.org/story/what-is-liquid-glass-ui-apples-ios-26-redesign-explained&quot;,&quot;title&quot;:&quot;What Is Liquid Glass? Apple's iOS 26 Redesign Explained&quot;},{&quot;url&quot;:&quot;https://www.usatoday.com/story/tech/2025/09/15/apple-ios-26-liquid-glass/86165634007/&quot;,&quot;title&quot;:&quot;Apple's Liquid Glass now available. Here's how to get it.&quot;},{&quot;url&quot;:&quot;https://apple.gadgethacks.com/news/ios-26-released-liquid-glass-design-changes-everything/&quot;,&quot;title&quot;:&quot;iOS 26 Released: Liquid Glass Design Changes Everything&quot;}]" data-done="true" data-name="Web Search" data-limit="5"></websearch>
 * ```
 */
export const handleWebsearch = (state: State, node: Element) => {
  try {
    const isDone = node.properties.dataDone === 'true'
    const query = node.properties.dataQuery as string
    const resultsData = node.properties.dataResults as string
    const results = resultsData ? JSON.parse(decodeURIComponent(resultsData as string)) : []

    if (!query || !results.length) {
      throw new Error('Missing query or results data')
    }

    const result = {
      type: 'root',
      children: [
        {
          type: 'paragraph',
          children: [
            {
              type: 'strong',
              children: [{ type: 'text', value: `Web Search${!isDone ? ' (in progress)' : ''}` }]
            },
            { type: 'text', value: ': ' + query }
          ]
        },
        {
          type: 'paragraph',
          children: [
            { type: 'strong', children: [{ type: 'text', value: 'Results' }] },
            { type: 'text', value: ':' }
          ]
        },
        {
          type: 'list',
          ordered: false,
          spread: false,
          children: results.map((result: { title: string; url: string }) => ({
            type: 'listItem',
            spread: false,
            children: [
              {
                type: 'paragraph',
                children: [
                  {
                    type: 'link',
                    url: result.url,
                    children: [{ type: 'text', value: result.title }]
                  }
                ]
              }
            ]
          }))
        }
      ]
    } satisfies MdastNodes

    state.patch(node, result)
    return result
  } catch (error) {
    console.error('Error processing websearch:', error)
    // Fallback to original HTML if parsing fails
    const result = { type: 'html', value: toHtml(node) } satisfies MdastNodes
    state.patch(node, result)
    return result
  }
}

/**
 * Handle surflet elements like:
 * ```html
 * <surflet data-resource-id="edc810e3-9018-4b37-a13a-a30e492edf1d" data-prompt="Create an interactive demo of Apple" data-done="true" data-name="Liquid Glass UI Demo"></surflet>
 * ```
 */
export const handleSurflet = (state: State, node: Element) => {
  try {
    const resourceId = node.properties?.dataResourceId as string
    const name = node.properties?.dataName as string

    if (!resourceId) {
      throw new Error('Missing resourceId')
    }

    const result = {
      type: 'root',
      children: [
        {
          type: 'link',
          url: `surf://surf/resource/${resourceId}`,
          children: [{ type: 'text', value: name || 'Surflet' }]
        }
        // { type: 'code', lang: 'html', value: (node.children[0] as any)?.value || '' }
      ]
    } satisfies MdastNodes

    state.patch(node, result)
    return result
  } catch (error) {
    console.error('Error processing surflet:', error)
    // Fallback to original HTML if parsing fails
    const result = { type: 'html', value: toHtml(node) } satisfies MdastNodes
    state.patch(node, result)
    return result
  }
}

/**
 * Handles mention span elements like:
 * ```html
 * <span class="mention" data-type="mention" data-id="323e8d75-0fb2-402b-9a0f-7d0cd8dcf80d" data-label="Research" data-mention-type="notebook" data-icon="notebook">@Research</span>
 * ```
 */
export const handleSpan = (state: State, node: Element) => {
  try {
    const classNames = Array.isArray(node.properties?.className) ? node.properties.className : []
    // Only handle mention spans
    if (!classNames.includes('mention') || node.properties?.dataType !== 'mention') {
      return undefined
    }

    const id = node.properties?.dataId as string
    const label = node.properties?.dataLabel as string
    const mentionType = node.properties?.dataMentionType as string

    if (!id || !label) {
      throw new Error('Missing id or label')
    }

    // Generate URL based on mention type
    let url = id
    if (mentionType === 'notebook') {
      url = `surf://surf/notebook/${id}`
    } else if (mentionType === 'resource') {
      url = `surf://surf/resource/${id}`
    }

    const result = {
      type: 'link',
      url: url,
      children: [{ type: 'text', value: `@${label}` }]
    } satisfies MdastNodes

    state.patch(node, result)
    return result
  } catch (error) {
    console.error('Error processing mention span:', error)
    return undefined
  }
}

/**
 * Handles title div elements like:
 * ```html
 * <div data-title-node="" class="title-node-container">Liquid Glass Technology</div>
 * ```
 */
export const handleDIV = (state: State, node: Element) => {
  try {
    const classNames = Array.isArray(node.properties?.className) ? node.properties.className : []
    // Only handle title divs
    if (!classNames.includes('title-node-container')) {
      return undefined
    }

    const result = {
      type: 'heading',
      depth: 1,
      children: [{ type: 'text', value: (node.children[0] as any)?.value }]
    } satisfies MdastNodes

    state.patch(node, result)
    return result
  } catch (error) {
    console.error('Error processing title div:', error)
    return undefined
  }
}
