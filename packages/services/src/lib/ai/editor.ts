import { findChildren } from '@tiptap/core'
import type { Attrs, Node } from '@tiptap/pm/model'
import type { Transaction } from '@tiptap/pm/state'

import { conditionalArrayItem, generateID, useLogScope, wait } from '@deta/utils'

import type { Editor as EditorComp } from '@deta/editor'
import { type Editor } from '@deta/editor/editor'

export type AIGenerationStatus = 'idle' | 'initializing' | 'generating' | 'completed' | 'failed'

export type AIGenerationOptions = {
  id?: string
  textQuery: string
  autoScroll?: boolean
  showPrompt?: boolean
}

export class EditorAIGeneration {
  noteEditor: NoteEditor
  editor: Editor

  readonly id: string
  readonly textQuery: string
  readonly pos: number

  autoScroll: boolean
  showPrompt: boolean
  status: AIGenerationStatus
  node: Node | null

  log: ReturnType<typeof useLogScope>

  constructor(noteEditor: NoteEditor, pos: number, opts: AIGenerationOptions) {
    this.noteEditor = noteEditor
    this.editor = noteEditor.editor

    this.pos = pos
    this.id = opts.id || generateID()
    this.textQuery = opts.textQuery

    this.autoScroll = opts.autoScroll ?? true
    this.showPrompt = opts.showPrompt ?? true
    this.status = 'idle'
    this.node = null

    this.log = useLogScope('EditorAIGeneration')
  }

  createNode() {
    this.log.debug('Creating AI generation node', this.id, this.textQuery)

    const tr = this.editor.view.state.tr
    const schema = this.editor.view.state.schema

    // Create text node for prompt content
    const textNode = schema.text(this.textQuery)

    // Create the prompt node with the text content
    const promptNode = schema.nodes.prompt.create({ id: this.id }, textNode)

    this.log.debug('Prompt node created', promptNode)

    // Create the output node (initially empty)
    const outputNode = schema.nodes.output.create({
      id: this.id
    })

    this.log.debug('Output node created', outputNode)

    // Create the generation node containing all the above nodes
    const generationNode = schema.nodes.generation.create({ id: this.id, status: 'initializing' }, [
      ...conditionalArrayItem(this.showPrompt, promptNode),
      outputNode
    ])

    this.log.debug('Generation node created', generationNode)

    // Insert the entire structure at the current position
    tr.insert(this.pos, generationNode)

    this.editor.view.dispatch(tr)

    this.log.debug('AI generation node inserted', this.id)

    this.status = 'initializing'
    this.node = generationNode

    if (this.autoScroll) {
      wait(200).then(() => {
        this.scrollToNode()
      })
    }
  }

  getNodeByType(type: string) {
    const nodePos = this.noteEditor.getNodeByID(this.id, type)
    if (nodePos) {
      this.log.debug('Node found', this.id, type, nodePos)
      return nodePos
    }

    this.log.debug('Node not found directly, trying via parent generation node', this.id, type)

    // get generation node
    const generationNode = this.noteEditor.getNodeByID(this.id, 'generation')
    if (!generationNode) {
      this.log.warn('Generation node not found', this.id)
      return null
    }

    // get the first child of the generation node matching the type
    const nodesWithPos = findChildren(generationNode.node, (node) => {
      return node.type.name === type
    })

    if (!nodesWithPos) {
      this.log.warn('Node not found', this.id, type)
      return null
    }

    this.log.debug('Node found in generation node', this.id, type, nodesWithPos)

    const nodeWithPos = nodesWithPos[0]
    const nodes = this.editor.$nodes(type)
    const matchingNodePos =
      nodeWithPos && (nodes ?? []).find((nodePos) => nodePos.node === nodeWithPos.node)
    if (matchingNodePos) {
      this.log.debug('Matching node position found', this.id, type, matchingNodePos)
      return matchingNodePos
    }

    this.log.warn('Matching node position not found', this.id, type)
    return null
  }

  deleteNode(id: string, type: string, transaction?: Transaction) {
    this.log.debug('Deleting AI generation node', id, type)

    const nodePos = this.noteEditor.getNodeByID(id, type)
    if (!nodePos) {
      this.log.warn('Node not found, cannot delete', id, type)
      return
    }

    const tr = transaction || this.editor.view.state.tr
    tr.delete(nodePos.pos, nodePos.pos + nodePos.node.nodeSize)

    if (!transaction) {
      this.editor.view.dispatch(tr)
    }
  }

  updateStatus(status: AIGenerationStatus) {
    this.log.debug('Updating AI generation node status', this.id, status)

    this.status = status

    const tr = this.editor.view.state.tr
    this.updateAIGenerationNodeStatus(status, tr)

    if (status === 'failed') {
      this.deleteNode(this.id, 'generation', tr)
    }

    this.editor.view.dispatch(tr)
  }

  updateOutput(content: string) {
    this.log.debug('Updating AI generation output', this.id, { content })

    if (!this.noteEditor.component) {
      this.log.warn('Note editor component not found, cannot update output', this.id)
      return
    }

    const tr = this.editor.view.state.tr
    const json = this.noteEditor.component.generateJSONFromHTML(content)

    const newOutputNode = this.editor.view.state.schema.nodeFromJSON({
      type: 'output',
      content: json.content,
      attrs: {
        id: this.id
      }
    })

    const outputNode = this.getNodeByType('output')
    if (outputNode) {
      this.log.debug('Output node found', this.id, outputNode)
      tr.replaceWith(outputNode.pos, outputNode.pos + outputNode.size, newOutputNode)
    } else {
      this.log.warn('Output node not found', this.id)
    }

    this.editor.view.dispatch(tr)

    if (this.autoScroll) {
      wait(200).then(() => {
        this.scrollToNode()
      })
    }
  }

  updateNodeAttributes(type: string, attrs: Attrs, transaction?: Transaction) {
    const nodePos = this.getNodeByType(type)
    if (nodePos) {
      const node = nodePos.node
      this.log.debug('Updating node attributes', this.id, type, node, attrs)
      const tr = transaction || this.editor.view.state.tr
      tr.setNodeMarkup(nodePos.pos, undefined, {
        ...node.attrs,
        ...attrs
      })

      if (!transaction) {
        this.editor.view.dispatch(tr)
      }
    }
  }

  updateAIGenerationNodeStatus(status: string, transaction?: Transaction) {
    this.log.debug('Updating AI generation node status', this.id, status)
    this.updateNodeAttributes('generation', { status: status }, transaction)
  }

  scrollToNode() {
    this.log.debug('Scrolling to AI generation node', this.id)

    const nodePos = this.noteEditor.getNodeByID(this.id, 'generation')
    if (nodePos) {
      const wrapper = this.noteEditor.element
      const domElem = nodePos.element

      if (wrapper && domElem) {
        const wrapperRect = wrapper.getBoundingClientRect()
        const domElemRect = domElem.getBoundingClientRect()

        // Calculate the element's position relative to the wrapper
        const relativeTop = domElemRect.top - wrapperRect.top

        // Scroll to position the element at the top with 30px padding
        wrapper.scrollTo({
          top: wrapper.scrollTop + relativeTop - 30,
          behavior: 'smooth'
        })
      }
    }
  }
}

export class NoteEditor {
  editor: Editor
  component: EditorComp
  element: HTMLElement

  log: ReturnType<typeof useLogScope>

  constructor(editor: Editor, component: EditorComp, element: HTMLElement) {
    this.editor = editor
    this.component = component
    this.element = element
    this.log = useLogScope('NoteEditor')
  }

  getLastNodeOfType(type: string) {
    const nodes = this.editor.$nodes(type)
    if (!nodes || nodes.length === 0) {
      return null
    }

    return nodes[nodes.length - 1]
  }

  getNodeByID(id: string, type: string) {
    const nodePositions = this.editor.$nodes(type)
    if (!nodePositions || nodePositions.length === 0) {
      return null
    }

    return nodePositions.find((nodePos) => nodePos.node.attrs.id === id) ?? null
  }

  createAIGeneration(pos: number, opts: AIGenerationOptions) {
    this.log.debug('Creating AI generation', pos, opts)
    const generation = new EditorAIGeneration(this, pos, opts)
    generation.createNode()
    return generation
  }

  static create(editor: Editor, component: EditorComp, element: HTMLElement) {
    return new NoteEditor(editor, component, element)
  }
}
