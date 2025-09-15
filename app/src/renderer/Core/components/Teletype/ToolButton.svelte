<script lang="ts">
  import { Icon } from '@deta/icons'
  import { Button } from '@deta/ui'

  let {
    toolId,
    tool,
    onToggle,
    disabled = false
  }: {
    toolId: string
    tool: { active: boolean; name: string; icon?: string }
    onToggle: (toolId: string) => void
    disabled?: boolean
  } = $props()
</script>

<Button
  class={tool.active ? 'active tool-button' : 'tool-button'}
  size="md"
  onclick={() => onToggle(toolId)}
  title={tool.name}
  {disabled}
>
  {#if tool.icon}
    <Icon name={tool.icon} size="14" />
  {/if}
  <span class="tool-name">{tool.name}</span>

  {#if tool.active}
    <Icon name="close" size="12" />
  {/if}
</Button>

<style lang="scss">
  // Apply Button component styles locally since global styles don't reach teletype package
  :global(.tools-bar .tool-button[data-button-root]) {
    user-select: none;
    height: min-content;
    width: max-content;
    border-radius: 12px;
    -electron-corner-smoothing: 60%;
    transition: color, scale, opacity;
    transition-duration: 125ms;
    transition-timing-function: ease-out;
    font-weight: 400;
    text-box-trim: trim-both;
    letter-spacing: 0.02em;
    display: flex;
    align-items: center;
    justify-items: center;
    outline: none;
    background: transparent;
    color: #b5bbc7;
    padding: 0.25rem 0.5rem;
    font-size: 13px;
    gap: 0.25rem;
    border-radius: 9px;

    &:hover:not(&:disabled) {
      background: #f3f5ff;
    }

    &:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }

    &:not(&:disabled) {
      &:hover {
        opacity: 1;
      }
      &:active {
        scale: 0.95;
        opacity: 1;
        --bg: linear-gradient(to top, rgba(0, 0, 0, 0.1), rgba(0, 0, 0, 0.12));
      }
      &.active {
        --bg: linear-gradient(to top, rgba(0, 0, 0, 0.1), rgba(0, 0, 0, 0.12));
      }
    }

    &:focus {
      outline: none;
    }
  }

  :global([data-button-root].active) {
    background: #f3f5ff !important;
    color: #6d82ff !important;
  }
</style>
