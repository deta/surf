<script lang="ts">
  import type { TeletypeSystem } from './index'
  import ToolButton from './ToolButton.svelte'
  import { useLogScope } from '@deta/utils'

  let {
    tools,
    teletype
  }: {
    tools: Map<string, { active: boolean; name: string; icon?: string }>
    teletype: TeletypeSystem
  } = $props()

  const log = useLogScope('ToolsList')

  const handleToggleTool = (toolId: string) => {
    log.debug('Toggling tool:', toolId)
    teletype.toggleTool(toolId)
  }
</script>

{#if tools && tools.size > 0}
  <div class="tools-bar">
    {#each Array.from(tools.entries()) as [toolId, tool] (toolId)}
      <ToolButton {toolId} {tool} onToggle={handleToggleTool} />
    {/each}
  </div>
{/if}

<style lang="scss">
  .tools-bar {
    display: flex;
    gap: 0.5rem;
    padding: 0.25rem;
    background: var(--background-light);
  }
</style>
