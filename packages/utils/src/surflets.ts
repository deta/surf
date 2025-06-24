import { visit } from 'unist-util-visit'
import type { Element, Root } from 'hast'

function cleanAttributeValue(value: string): string {
  return value
    .replace(/\r?\n/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function parseSurfletAttributes(attributesStr: string): Record<string, string> {
  const attributes: Record<string, string> = {}
  const attrRegex = /(\w+)=["']([^"']*?)["']/g
  let attrMatch

  while ((attrMatch = attrRegex.exec(attributesStr)) !== null) {
    const prefixedAttr = `data-${attrMatch[1]}`
    const cleanedValue = cleanAttributeValue(attrMatch[2])
    attributes[prefixedAttr] = cleanedValue
  }

  return attributes
}

function createSurfletNode(attributesStr: string): any {
  const attributes = parseSurfletAttributes(attributesStr)

  return {
    type: 'surflet',
    data: {
      hName: 'surflet',
      hProperties: attributes
    }
  }
}

function handleSimpleSurflet(node: any, index: number, parent: any): boolean {
  if (node.children.length !== 1 || node.children[0].type !== 'text') {
    return false
  }

  const textNode = node.children[0]
  const surfletMatch = textNode.value.match(/^\s*:::surflet\{([^}]+)\}\s*$/)

  if (surfletMatch) {
    const surfletNode = createSurfletNode(surfletMatch[1])
    if (parent && typeof index === 'number') {
      parent.children.splice(index, 1, surfletNode)
    }
    return true
  }

  return false
}

function handleIncompleteSurflet(node: any): boolean {
  if (node.children.length !== 1 || node.children[0].type !== 'text') {
    return false
  }

  const textNode = node.children[0]
  const incompleteMatch = textNode.value.match(/^\s*:::surflet(\{[^}]*)?\s*$/)

  if (incompleteMatch) {
    node.children = [{ type: 'text', value: '' }]
    return true
  }

  return false
}

function cleanTextContent(text: string): string {
  return text.replace(/\s*:::surflet(\{[^}]*)?\s*$/, '')
}

function processTextNodeForSurflets(child: any): { nodes: any[]; hasChanges: boolean } {
  if (child.type !== 'text' || !child.value) {
    return { nodes: [child], hasChanges: false }
  }

  let processedValue = cleanTextContent(child.value)
  const surfletRegex = /\s*:::surflet\{([^}]+)\}\s*/g
  const nodes: any[] = []
  let match
  let lastEnd = 0
  let foundSurflet = false

  while ((match = surfletRegex.exec(processedValue)) !== null) {
    foundSurflet = true

    if (match.index > lastEnd) {
      const textBefore = processedValue.slice(lastEnd, match.index)
      if (textBefore.trim()) {
        nodes.push({ type: 'text', value: textBefore })
      }
    }

    nodes.push(createSurfletNode(match[1]))
    lastEnd = match.index + match[0].length
  }

  const hasChanges = foundSurflet || processedValue !== child.value

  if (hasChanges) {
    if (lastEnd < processedValue.length) {
      let textAfter = processedValue.slice(lastEnd)
      textAfter = textAfter.replace(/^:::+/, '').trim()
      if (textAfter) {
        nodes.push({ type: 'text', value: textAfter })
      }
    }
  } else {
    nodes.push(child)
  }

  return { nodes, hasChanges }
}

function splitMixedContent(children: any[]): any[] {
  const nodesToInsert: any[] = []
  let currentParagraphChildren: any[] = []

  children.forEach((child) => {
    if (child.type === 'surflet') {
      if (currentParagraphChildren.length > 0) {
        const filteredChildren = currentParagraphChildren.filter(
          (c) => c.type !== 'text' || (c.value && c.value.trim())
        )
        if (filteredChildren.length > 0) {
          nodesToInsert.push({
            type: 'paragraph',
            children: filteredChildren
          })
        }
        currentParagraphChildren = []
      }
      nodesToInsert.push(child)
    } else {
      currentParagraphChildren.push(child)
    }
  })

  if (currentParagraphChildren.length > 0) {
    const filteredChildren = currentParagraphChildren.filter(
      (c) => c.type !== 'text' || (c.value && c.value.trim())
    )
    if (filteredChildren.length > 0) {
      nodesToInsert.push({
        type: 'paragraph',
        children: filteredChildren
      })
    }
  }

  return nodesToInsert
}

function handleMixedContent(node: any, index: number, parent: any): void {
  const newChildren: any[] = []
  let hasChanges = false

  node.children.forEach((child: any) => {
    const { nodes, hasChanges: childHasChanges } = processTextNodeForSurflets(child)
    newChildren.push(...nodes)
    if (childHasChanges) {
      hasChanges = true
    }
  })

  if (hasChanges) {
    const nodesToInsert = splitMixedContent(newChildren)
    if (parent && typeof index === 'number') {
      parent.children.splice(index, 1, ...nodesToInsert)
    }
  }
}

function isWhitespaceOnlyParagraph(node: any): boolean {
  if (!node.children || node.children.length === 0) return true

  return node.children.every(
    (child: any) => child.type === 'text' && (!child.value || !child.value.trim())
  )
}

// custom remark plugin to parse surflets in markdown
// we have a special syntax for surflets in markdown
// :::surflet{attribute1="value1" attribute2="value2"}
// this is complicated to make it as robust as possible against llm inconsistencies
export function remarkParseSurflets() {
  return (tree: any) => {
    visit(tree, 'paragraph', (node: any, index: any, parent: any) => {
      if (!node.children || node.children.length === 0) return

      if (isWhitespaceOnlyParagraph(node)) {
        return
      }

      if (handleSimpleSurflet(node, index, parent)) {
        return
      }

      if (handleIncompleteSurflet(node)) {
        return
      }

      handleMixedContent(node, index, parent)
    })
  }
}

export function rehypeProcessSurflets() {
  return (tree: Root) => {
    visit(tree, 'element', (node: Element) => {
      if (node.tagName === 'surflet') {
        node.children = []
      }
    })
  }
}
