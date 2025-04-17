<script lang="ts">
  import { derived, writable } from 'svelte/store'
  import { createEventDispatcher, onMount } from 'svelte'
  import { useOasis } from '../../service/oasis'
  import { useTabsManager } from '../../service/tabs'
  import { useResourceManager, ResourceManager } from '../../service/resources'
  import { ResourceTypes } from '@horizon/types'
  import OasisResourcesView from '../Oasis/ResourceViews/OasisResourcesView.svelte'
  import type { ResourceNote } from '@horizon/core/src/lib/service/resources'
  import { selectedItemIds } from '../Oasis/utils/select'
  import { useSmartNotes } from '@horizon/core/src/lib/service/ai/note'
  import { useLogScope } from '@horizon/utils'

  const dispatch = createEventDispatcher()
  const log = useLogScope('NotesView')

  const oasis = useOasis()
  const tabsManager = useTabsManager()
  const resourceManager = useResourceManager()
  const smartNotes = useSmartNotes()

  const noteResources = writable<any[]>([])
  const readableResources = derived(noteResources, ($noteResources) => $noteResources)
  const currentSpaceId = derived(tabsManager.activeScopeId, ($selectedSpace) => $selectedSpace)

  // Search value for filtering resources
  const searchValue = writable('')

  // Function to create a new empty chat note
  async function createNewChatNote() {
    try {
      log.debug('Creating new empty chat note')
      const newNote = await smartNotes.createNote('')
      if (newNote) {
        log.debug('New note created:', newNote)
        await smartNotes.changeActiveNote(newNote)
        dispatch('change-tab')
        return newNote
      }
    } catch (error) {
      log.error('Error creating new chat note:', error)
    }
    return null
  }

  // Function to fetch note resources for the current space
  async function fetchNoteResources(spaceId: string | null) {
    try {
      // If Context is Inbox (when currentSpaceId is null): Show only notes that aren't in any other space
      if (spaceId === null) {
        log.debug('Filtering notes for inbox (null spaceId)')

        // Get all notes that aren't in any space using the excludeWithinSpaces option
        const filteredResources = (await resourceManager.listResourcesByTags(
          [ResourceManager.SearchTagResourceType(ResourceTypes.DOCUMENT_SPACE_NOTE)],
          { excludeWithinSpaces: true }
        )) as ResourceNote[]

        log.debug('Filtered inbox notes:', filteredResources.length)
        noteResources.set(filteredResources)

        // Create a new note if there are no notes
        if (filteredResources.length === 0) {
          const newNote = await createNewChatNote()
          if (newNote) {
            noteResources.set([newNote] as ResourceNote[])
          }
        }
        return
      }

      // Regular space: Load only notes from this space using the reusable method
      const filteredResources = await oasis.fetchNoteResourcesFromSpace(spaceId)
      noteResources.set(filteredResources)

      // Create a new note if there are no notes in this space
      if (filteredResources.length === 0) {
        const newNote = await createNewChatNote()
        if (newNote) {
          noteResources.set([newNote] as ResourceNote[])
        }
      }
    } catch (error) {
      log.error('Error fetching note resources:', error)
      noteResources.set([])

      // Try to create a new note even if there was an error fetching resources
      const newNote = await createNewChatNote()
      if (newNote) {
        noteResources.set([newNote] as ResourceNote[])
      }
    }
  }

  $: {
    fetchNoteResources($currentSpaceId)
  }

  // Handle events from OasisResourcesView
  function handleOpen(event: CustomEvent<string | string[]>) {
    const resourceIds = event.detail
    // Open the resource(s) in a tab or appropriate view
    if (Array.isArray(resourceIds)) {
      // Handle array of resource IDs
      if (resourceIds.length > 0) {
        resourceIds.forEach((id) => {
          oasis.openResourceDetailsSidebar(id)
        })
      }
    } else if (resourceIds) {
      // Handle single resource ID
      oasis.openResourceDetailsSidebar(resourceIds)
    }
  }

  // Combined function to handle both single and batch resource removal
  async function handleRemove(
    event: CustomEvent<{ ids: string | string[]; deleteFromStuff: boolean }>
  ) {
    // Get the ids from the event, ensuring they're in array format
    let ids = event.detail?.ids || $selectedItemIds

    // Convert single id to array if needed
    if (!Array.isArray(ids) && ids) {
      ids = [ids]
    }

    const deleteFromStuff = event.detail?.deleteFromStuff || false

    log.debug('Removing resources:', { ids, deleteFromStuff, selectedIds: $selectedItemIds })

    if (!ids || ids.length === 0) {
      log.warn('No resources selected for removal')
      return
    }

    try {
      await oasis.removeResourcesFromSpaceOrOasis(
        ids,
        deleteFromStuff ? undefined : $currentSpaceId
      )

      // Refresh the resources list after deletion
      setTimeout(() => fetchNoteResources($currentSpaceId), 500)
    } catch (error) {
      log.error('Error removing resources:', error)
    }
  }

  // Handle resource click/selection
  async function handleResourceClick(event: CustomEvent) {
    const resourceId = event.detail
    log.debug('Resource clicked:', event.detail)

    // Get the SmartNote object by resource ID before calling changeActiveNote
    const smartNote = await smartNotes.getNote(resourceId)
    if (smartNote) {
      smartNotes.changeActiveNote(smartNote)
      dispatch('change-tab')
    } else {
      log.error('Could not find SmartNote for resource ID:', resourceId)
    }
  }

  onMount(() => {
    fetchNoteResources($currentSpaceId)
  })
</script>

<main class="root-sidebar">
  <div class="sidebar-content">
    {#if $readableResources && $readableResources.length > 0}
      <OasisResourcesView
        resources={readableResources}
        isInSpace={true}
        {searchValue}
        resourcesBlacklistable={false}
        openIn="sidebar"
        fadeIn={true}
        hideViewSettings={true}
        viewType="grid"
        sortBy="resource_added_to_space"
        order="desc"
        on:click={handleResourceClick}
        on:open={handleOpen}
        on:open-and-chat
        on:batch-remove={handleRemove}
        on:remove={handleRemove}
        on:batch-open={handleOpen}
        on:open-in-sidebar={handleResourceClick}
      />
    {:else}
      <!-- Empty state is handled by automatically creating a new note -->
      <div class="empty-state">
        <p>Creating a new chat note...</p>
      </div>
    {/if}
  </div>
</main>

<style lang="scss">
  .root-sidebar {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
  }

  .sidebar-content {
    flex: 1;
    overflow: auto;
    padding: 0.5rem;
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: #666;
    font-size: 0.9rem;
    text-align: center;
    padding: 2rem;
  }
</style>
