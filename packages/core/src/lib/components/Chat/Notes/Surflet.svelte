<script lang="ts">
  import type { Resource } from '@horizon/core/src/lib/service/resources'
  import SurfletRenderer from '../SurfletRenderer.svelte'

  import { type Editor } from '@horizon/editor'
  import { useResourceManager } from '@horizon/core/src/lib/service/resources'

  export let node
  export let updateAttributes: (attrs: Record<string, any>) => void
  export let editor: Editor
  export let codeContent: string = ''
  export let resourceId: string = ''

  const resourceManager = useResourceManager()

  let resource: Resource | null = null

  $: if (node && node.attrs) {
    if (node.attrs.codeContent) {
      codeContent = node.attrs.codeContent
    }
    if (node.attrs.resourceId) {
      resourceId = node.attrs.resourceId
    }
  }

  $: getResource(resourceId)

  const getResource = async (id: string) => {
    if ((resource && resource.id === id) || !id) {
      return
    }

    resource = await resourceManager.getResource(id)
  }

  const handleUpdateCode = (e: CustomEvent<string>) => {
    const newContent = e.detail
    console.log('TipTapCodeBlock handleUpdateCode', newContent)

    if (!newContent) {
      return
    }

    // update the node's text content via the TipTap editor
    const pos = node.pos + 1 // Position inside the node (skip the node itself)

    if (isNaN(pos)) {
      return
    }

    const textPos = editor.state.doc.resolve(pos)
    const $from = textPos
    const $to = editor.state.doc.resolve(node.pos + node.nodeSize - 1)

    editor.commands.deleteRange({ from: $from.pos, to: $to.pos })
    editor.commands.insertContentAt($from.pos, newContent)
  }

  const handleCreateResource = (e: CustomEvent<string>) => {
    console.log('TipTapCodeBlock handleCreateResource', e.detail)
    updateAttributes({ resourceId: e.detail })
    getResource(e.detail)
  }
</script>

<SurfletRenderer
  resource={resource ?? undefined}
  {codeContent}
  isEditable={editor?.isEditable}
  initialCollapsed={false}
  collapsable
  resizable={true}
  minHeight="150px"
  maxHeight="800px"
  initialHeight="550px"
  on:update-code={handleUpdateCode}
  on:created-resource={handleCreateResource}
></SurfletRenderer>

<style>
</style>
