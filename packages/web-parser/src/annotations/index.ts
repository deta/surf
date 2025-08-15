import { type AnnotationRangeData, type AnnotationType } from '@deta/types'

import { getXPath } from './xpath'

export const getRangeData = (range: Range) => {
  const startXPath = getXPath(range.startContainer)
  const endXPath = getXPath(range.endContainer)

  return {
    content_plain: range.toString(),
    content_html: range.cloneContents().textContent,
    start_offset: range.startOffset,
    end_offset: range.endOffset,
    start_xpath: startXPath,
    end_xpath: endXPath
  } as AnnotationRangeData
}

export const getRangeDataFromWindowSelection = () => {
  const selection = window.getSelection()
  if (!selection || selection.rangeCount === 0) {
    return null
  }

  const range = selection.getRangeAt(0)
  return getRangeData(range)
}

export const constructRange = (rangeData: AnnotationRangeData, skipValidation = false) => {
  const startNode = document.evaluate(
    rangeData.start_xpath,
    document,
    null,
    XPathResult.FIRST_ORDERED_NODE_TYPE,
    null
  ).singleNodeValue
  const endNode = document.evaluate(
    rangeData.end_xpath,
    document,
    null,
    XPathResult.FIRST_ORDERED_NODE_TYPE,
    null
  ).singleNodeValue

  if (!startNode || !endNode) {
    const errorMessage =
      'Could not find nodes for XPaths: ' + rangeData.start_xpath + ' and ' + rangeData.end_xpath
    throw new Error(errorMessage)
  }

  const range = new Range()
  range.setStart(startNode, rangeData.start_offset)
  range.setEnd(endNode, rangeData.end_offset)

  // check if the range is valid by comparing the text content
  if (range.toString() !== rangeData.content_plain) {
    const errorMessage =
      'Range is not valid, text does not match: ' +
      range.toString() +
      ' !== ' +
      rangeData.content_plain
    if (!skipValidation) {
      throw new Error(errorMessage)
    } else {
      console.warn(errorMessage)
    }
  }

  return range
}

export function wrapRangeInNode(range: Range, wrapperNode: Node, onClick?: (id: string) => void) {
  const iterator = document.createNodeIterator(
    range.commonAncestorContainer,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode: function (node) {
        return !range.intersectsNode(node) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT
      }
    }
  )

  const nodesToWrap = []
  if (iterator.referenceNode.nodeType === Node.TEXT_NODE) {
    nodesToWrap.push(iterator.referenceNode)
  }

  let currentNode
  while ((currentNode = iterator.nextNode())) {
    nodesToWrap.push(currentNode)
  }

  nodesToWrap.forEach((textNode) => {
    let startOffset = 0
    let endOffset = (textNode as Text).length
    if (textNode === range.startContainer) {
      startOffset = range.startOffset
    }

    if (textNode === range.endContainer) {
      endOffset = range.endOffset
    }

    const length = endOffset - startOffset
    const newNode = (textNode as Text).splitText(startOffset)
    newNode.splitText(length)
    const highlightNode = wrapperNode.cloneNode()

    highlightNode.addEventListener('click', (e) => {
      e.preventDefault()
      e.stopPropagation()

      const id = (highlightNode as Element).getAttribute('id')
      const type = (highlightNode as Element).getAttribute('data-annotation-type') as AnnotationType
      console.log('clicked on highlight', highlightNode)

      if (onClick) {
        onClick(id!)
      }

      // window.dispatchEvent(
      //   new CustomEvent(WebviewAnnotationEventNames.Click, {
      //     detail: {
      //       id: id,
      //       type: type
      //     } as WebviewAnnotationEvents[WebviewAnnotationEventNames.Click]
      //   })
      // )
    })

    textNode.parentNode?.insertBefore(highlightNode, newNode)
    highlightNode.appendChild(newNode)
  })
}

// applies a highlight to the range while making sure the dom structure is not broken
export const applyRangeHighlight = (
  range: Range,
  id: string,
  type: AnnotationType,
  onClick?: (id: string) => void
) => {
  const elem = document.createElement('deta-annotation')

  // set attributes for the element so we can identify it later
  elem.setAttribute('id', id)
  elem.setAttribute('data-annotation-type', type)

  // styling
  elem.classList.add('deta-annotation')
  elem.classList.add('deta-annotation-highlight')

  wrapRangeInNode(range, elem, onClick)
}
