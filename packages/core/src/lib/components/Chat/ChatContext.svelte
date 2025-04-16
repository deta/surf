<script lang="ts">
  import { get, derived } from 'svelte/store'
  import type { AIChat } from '@horizon/core/src/lib/service/ai/chat'
  import { useTabsManager } from '../../service/tabs'
  import { useOasis } from '@horizon/core/src/lib/service/oasis'

  const tabsManager = useTabsManager()
  const oasis = useOasis()

  // Get the name of the space using activeScopeId, defaulting to Home when null
  const spaceName = derived(
    [tabsManager.activeScopeId, oasis.spaces],
    ([$activeScopeId, $spaces]) => {
      if ($activeScopeId === null) {
        return 'Home'
      } else if ($activeScopeId) {
        const space = $spaces.find((space) => space.id === $activeScopeId)
        return space?.dataValue?.folderName ?? $activeScopeId
      }
      return ''
    }
  )
</script>

<div class="chat-context">{$spaceName}</div>

<style lang="scss">
  .chat-context {
    padding: 2px 8px;
    border-radius: 6px;
    background: paint(squircle) !important;
    --squircle-radius: 8px;
    --squircle-smooth: 0.28;

    &:hover {
      --squircle-fill: rgba(0, 0, 0, 0.1);
    }
  }
</style>
