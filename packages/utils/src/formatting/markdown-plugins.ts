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

function parseComponentAttributes(attributesStr: string): Record<string, string> {
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

function createComponentNode(componentName: string, attributesStr?: string): any {
  const attributes = attributesStr ? parseComponentAttributes(attributesStr) : {}

  console.debug('Creating component node:', componentName, attributes)
  return {
    type: 'component',
    data: {
      hName: componentName,
      hProperties: attributes
    }
  }
}

function handleSimpleComponent(node: any, index: number, parent: any): boolean {
  if (node.children.length !== 1 || node.children[0].type !== 'text') {
    return false
  }

  const textNode = node.children[0]
  // Match :::componentName or :::componentName{attributes}
  const componentMatch = textNode.value.match(/^\s*:::(\w+)(?:\{([^}]*)\})?\s*$/)

  if (componentMatch) {
    const componentName = componentMatch[1]
    const attributesStr = componentMatch[2] || ''
    const componentNode = createComponentNode(componentName, attributesStr)
    if (parent && typeof index === 'number') {
      parent.children.splice(index, 1, componentNode)
    }
    return true
  }

  return false
}

function handleIncompleteComponent(node: any): boolean {
  if (node.children.length !== 1 || node.children[0].type !== 'text') {
    return false
  }

  const textNode = node.children[0]
  // Match incomplete components like :::componentName{ or :::componentName{incomplete
  const incompleteMatch = textNode.value.match(/^\s*:::(\w+)(\{[^}]*)?\s*$/)

  if (incompleteMatch) {
    node.children = [{ type: 'text', value: '' }]
    return true
  }

  return false
}

function cleanTextContent(text: string): string {
  return text.replace(/\s*:::(\w+)(\{[^}]*)?\s*$/, '').replace(/\}\s*$/g, '')
}

function processTextNodeForComponents(child: any): { nodes: any[]; hasChanges: boolean } {
  if (child.type !== 'text' || !child.value) {
    return { nodes: [child], hasChanges: false }
  }

  let processedValue = cleanTextContent(child.value)
  // Match :::componentName or :::componentName{attributes}
  const componentRegex = /\s*:::(\w+)(?:\{([^}]*)\})?\s*/g
  const nodes: any[] = []
  let match
  let lastEnd = 0
  let foundComponent = false

  while ((match = componentRegex.exec(processedValue)) !== null) {
    foundComponent = true

    if (match.index > lastEnd) {
      const textBefore = processedValue.slice(lastEnd, match.index)
      if (textBefore.trim()) {
        nodes.push({ type: 'text', value: textBefore })
      }
    }

    const componentName = match[1]
    const attributesStr = match[2] || ''
    nodes.push(createComponentNode(componentName, attributesStr))
    lastEnd = match.index + match[0].length
  }

  const hasChanges = foundComponent || processedValue !== child.value

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
    if (child.type === 'component') {
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
    const { nodes, hasChanges: childHasChanges } = processTextNodeForComponents(child)
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

// custom remark plugin to parse components in markdown
// we have a special syntax for components in markdown
// :::componentName or :::componentName{attribute1="value1" attribute2="value2"}
// this is complicated to make it as robust as possible against llm inconsistencies
export function remarkParseCustomComponents() {
  return (tree: any) => {
    visit(tree, 'paragraph', (node: any, index: any, parent: any) => {
      if (!node.children || node.children.length === 0) return

      if (isWhitespaceOnlyParagraph(node)) {
        return
      }

      if (handleSimpleComponent(node, index, parent)) {
        return
      }

      if (handleIncompleteComponent(node)) {
        return
      }

      handleMixedContent(node, index, parent)
    })
  }
}

export function rehypeProcessCustomComponents() {
  return (tree: Root) => {
    visit(tree, 'element', (node: Element) => {
      // TODO: take this from the api
      const componentNames = ['surflet', 'websearch']
      if (componentNames.includes(node.tagName)) {
        node.children = []
      }
    })
  }
}
