<script lang="ts">
  import { useContextService } from '@horizon/core/src/lib/service/contexts'
  import { OasisSpace, useOasis } from '@horizon/core/src/lib/service/oasis'
  import { derived, type Readable } from 'svelte/store'
  import Folder from '../Folder.svelte'

  export let space: OasisSpace
  export let editingFolderId: Readable<string | null>
  export let onlySelected: boolean = false
  export let depth: number = 0

  const oasis = useOasis()
  const contextService = useContextService()

  const selectedSpace = oasis.selectedSpace
  const spaceLinks = contextService.useSpaceLinks(space.id, 'forward', 1)

  const linkedSpaces = derived([spaceLinks, selectedSpace], ([spaceLinks, selectedSpace]) => {
    return spaceLinks
      .filter((link) => (onlySelected ? link.target.id === selectedSpace : true))
      .map((link) => link.target)
  })
</script>

<div class="list">
  {#each $linkedSpaces as space}
    <Folder
      folder={space}
      selected={$selectedSpace === space.id}
      isEditing={$editingFolderId === space.id}
      {depth}
      {editingFolderId}
      allowPinning
      on:select
      on:space-selected
      on:open-space-as-tab
      on:update-data
      on:use-as-context
      on:open-space-and-chat
      on:Drop
      on:editing-start
      on:editing-end
      on:pin
      on:unpin
    />
  {/each}
</div>

<style>
  .list {
    margin-left: 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.1rem;
  }
</style>
