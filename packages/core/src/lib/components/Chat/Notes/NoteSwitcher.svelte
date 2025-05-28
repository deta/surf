<script lang="ts">
  import { onMount } from 'svelte'
  import { derived, writable, type Writable, get } from 'svelte/store'

  import { tooltip, getHumanDistanceToNow, useLogScope, useDebounce } from '@horizon/utils'
  import { Icon } from '@horizon/icons'

  import { useAI } from '@horizon/core/src/lib/service/ai/ai'
  import {
    SelectDropdown,
    SelectDropdownItem,
    type SelectItem
  } from '@horizon/core/src/lib/components/Atoms/SelectDropdown'
  import {
    contextMenu,
    type CtxItem
  } from '@horizon/core/src/lib/components/Core/ContextMenu.svelte'
  import { openDialog } from '@horizon/core/src/lib/components/Core/Dialog/Dialog.svelte'
  import { useToasts } from '@horizon/core/src/lib/service/toast'
  import { ResourceTypes, ResourceTagsBuiltInKeys } from '@horizon/core/src/lib/types'
  import { SmartNote, useSmartNotes } from '@horizon/core/src/lib/service/ai/note'
  import { useOasis } from '@horizon/core/src/lib/service/oasis'
  import { useResourceManager } from '@horizon/core/src/lib/service/resources'
  import { ResourceManager } from '@horizon/core/src/lib/service/resources'
  import type { ResourceNote } from '@horizon/core/src/lib/service/resources'
  import { useTabsManager } from '@horizon/core/src/lib/service/tabs'
  import { useConfig } from '@horizon/core/src/lib/service/config'
  import { EventContext } from '@horizon/types'

  export let selectedChatId: Writable<string> = writable('')
  export let open: Writable<boolean> = writable(false)

  const ai = useAI()
  const toasts = useToasts()
  const log = useLogScope('ChatSwitcher')
  const oasis = useOasis()
  const resourceManager = useResourceManager()
  const smartNotes = useSmartNotes()
  const tabsManager = useTabsManager()
  const config = useConfig()

  const loadingChat = writable(false)
  const searchValue = writable('')
  const searching = writable(false)
  const searchResults = writable<ResourceNote[]>([])
  const filteredNotes = writable<ResourceNote[]>([])

  const userSettings = config.settings
  const notes = smartNotes.rawNotes

  $: if ($searchValue) {
    handleSearch($searchValue)
  }

  const selectNewItem = {
    id: 'new',
    label: 'Create Note',
    icon: 'add'
  } as SelectItem

  // Get the current space ID from activeScopeId
  const currentSpaceId = derived([tabsManager.activeScopeId], ([$activeScopeId]) => {
    return $activeScopeId || oasis.defaultSpaceID
  })

  // Filter notes based on the current space
  async function filterNotesBySpace(
    spaceId: string,
    notes: ResourceNote[] = smartNotes.rawNotesValue
  ) {
    if (!spaceId) return

    try {
      log.debug('Filtering notes for space:', spaceId)

      // Use the provided notes or get all available notes
      const allNotes = notes

      // If Context is Inbox: Show only notes that aren't in any other space
      if (spaceId === 'inbox') {
        log.debug('Filtering notes for inbox')

        // Get all spaces except inbox
        const spaces = oasis.spacesValue.filter((space) => space.id !== 'inbox')

        // Get all note IDs that are in other spaces
        const notesInOtherSpaces = new Set<string>()
        await Promise.all(
          spaces.map(async (space) => {
            const spaceNotes = await oasis.fetchNoteResourcesFromSpace(space.id)
            spaceNotes.forEach((note) => notesInOtherSpaces.add(note.id))
          })
        )

        // Filter notes to only those that aren't in any other space
        const inboxNotes = allNotes.filter((note) => !notesInOtherSpaces.has(note.id))

        log.debug('Filtered inbox notes:', inboxNotes.length)
        filteredNotes.set(inboxNotes)
        return
      }

      // Regular space: Only show notes from this space using the reusable method
      const noteResources = await oasis.fetchNoteResourcesFromSpace(spaceId)
      if (noteResources.length === 0) {
        log.debug('No notes found in space:', spaceId)
        filteredNotes.set([])
        return
      }

      // Get the note IDs from the resources
      const noteIds = noteResources.map((resource) => resource.id)

      log.debug('Note IDs in space:', noteIds.length)

      // Filter notes to only those in the current space
      const spacesNotes = allNotes.filter((note) => noteIds.includes(note.id))

      log.debug('Filtered notes for space:', spacesNotes.length)
      filteredNotes.set(spacesNotes)
    } catch (error) {
      log.error('Error filtering notes by space:', error)
      filteredNotes.set([])
    }
  }

  // Watch for changes to the current space and notes
  $: filterNotesBySpace($currentSpaceId, $notes)

  const items = derived([filteredNotes, selectedChatId], ([notes, selectedChatId]) => {
    return notes
      .filter((note) => !!note.metadata?.name && note.id !== selectedChatId)
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .map(
        (note) =>
          ({
            id: note.id,
            label: note.metadata?.name,
            description: getHumanDistanceToNow(note.updatedAt),
            data: note
          }) as SelectItem
      )
  })

  const filterdItems = derived(
    [items, searchResults, searchValue, selectedChatId],
    ([$items, $searchResults, $searchValue, $selectedChatId]) => {
      if (!$searchValue) return $items

      return $searchResults
        .filter((resource) => !!resource.metadata?.name && resource.id !== $selectedChatId)
        .map(
          (resource) =>
            ({
              id: resource.id,
              label: resource.metadata?.name,
              description: getHumanDistanceToNow(resource.updatedAt),
              data: resource
            }) as SelectItem
        )
    }
  )

  const debouncedSearch = useDebounce(async () => {
    try {
      if (!$searchValue) {
        searchResults.set([])
        return
      }

      searching.set(true)

      const results = await resourceManager.searchResources($searchValue, [
        ResourceManager.SearchTagDeleted(false),
        ResourceManager.SearchTagResourceType(ResourceTypes.DOCUMENT_SPACE_NOTE)
      ])

      const resources = results.map((r) => r.resource) as ResourceNote[]
      searchResults.set(resources)
    } catch (err) {
      log.error('Failed to search chats:', err)
      searchResults.set([])
    } finally {
      searching.set(false)
    }
  }, 200)

  const handleSearch = (query: string) => {
    if (!query) {
      searchResults.set([])
      return
    }

    searching.set(true)
    debouncedSearch()
  }

  const switchNote = async (noteId: string) => {
    try {
      loadingChat.set(true)

      const note = await smartNotes.getNote(noteId)
      if (!note) return

      log.debug('Switching note:', note.id)

      // const oldChat = $selectedChat

      smartNotes.changeActiveNote(note)
      open.set(false)
    } catch (err) {
      log.error('Failed to switch chat:', err)
    } finally {
      loadingChat.set(false)
    }
  }

  const createNote = async () => {
    try {
      loadingChat.set(true)
      log.debug('Creating new chat')

      const note = await smartNotes.createNote('', { eventContext: EventContext.Chat })
      switchNote(note.id)
    } catch (err) {
      log.error('Failed to create chat:', err)
    } finally {
      loadingChat.set(false)
    }
  }

  const deleteNote = async (note: SmartNote) => {
    try {
      log.debug('Deleting note:', note.id)

      const { closeType: confirmed } = await openDialog({
        message: `Are you sure you want to delete the note "${note.titleValue}"?`,
        actions: [
          { title: 'Cancel', type: 'reset' },
          { title: 'Delete', type: 'submit', kind: 'danger' }
        ]
      })

      if (!confirmed) {
        log.debug('User cancelled chat deletion')
        return
      }

      if (note.id === $selectedChatId) {
        await createNote()
      }

      await oasis.deleteResourcesFromOasis([note.resource.id], false)

      toasts.success('Note deleted!')
    } catch (error) {
      log.error('Failed to delete folder:', error)
    }
  }

  const getContextItems = (note: SmartNote, active: boolean) =>
    [
      {
        type: 'action',
        icon: 'eye',
        hidden: active,
        text: 'Open',
        action: () => switchNote(note.id)
      },
      {
        type: 'action',
        icon: 'trash',
        text: 'Delete Note',
        kind: 'danger',
        action: () => deleteNote(note)
      }
    ] satisfies CtxItem[]

  const handleSelect = async (e: CustomEvent<string>) => {
    const chatId = e.detail
    if (chatId === 'new') {
      createNote()
      return
    }

    switchNote(chatId)
  }

  onMount(async () => {
    try {
      loadingChat.set(true)

      // Initial filtering of notes based on current space
      if ($currentSpaceId) {
        await filterNotesBySpace($currentSpaceId)
      }
    } catch (err) {
      log.error('Failed to list chats:', err)
    } finally {
      loadingChat.set(false)
    }
  })

  onMount(() => {
    const unsubAdded = oasis.on('added-resources', (space, resourceIds) => {
      if (space.id !== $currentSpaceId) return
      if (resourceIds.length === 0) return

      filterNotesBySpace($currentSpaceId)
    })

    const unsubRemoved = oasis.on('removed-resources', (space, resourceIds) => {
      if (space.id !== $currentSpaceId) return
      if (resourceIds.length === 0) return

      filterNotesBySpace($currentSpaceId)
    })

    return () => {
      unsubAdded()
      unsubRemoved()
    }
  })
</script>

<SelectDropdown
  items={filterdItems}
  search="manual"
  selected={$selectedChatId}
  footerItem={selectNewItem}
  loading={$searching}
  {searchValue}
  {open}
  side="top"
  inputPlaceholder="Search for a note…"
  loadingPlaceholder="Searching notes…"
  emptyPlaceholder="No notes found"
  closeOnMouseLeave={false}
  keepHeightWhileSearching
  on:select={handleSelect}
>
  <button
    use:tooltip={{ text: 'Switch Note', position: 'right' }}
    class="transform whitespace-nowrap active:scale-95 disabled:opacity-10 appearance-none border-0 group margin-0 flex items-center p-1 hover:bg-sky-200 dark:hover:bg-gray-800 transition-colors duration-200 rounded-md text-sky-1000 dark:text-gray-100 text-sm"
  >
    {#if $loadingChat}
      <Icon name="spinner" className="opacity-40" size="16px" />
    {:else}
      <Icon name="chevron.down" className="opacity-60 {$open ? 'rotate-180' : ''}" />
    {/if}
  </button>

  <div
    slot="item"
    class="w-full"
    let:item
    use:contextMenu={{
      canOpen: !!item?.data,
      items: getContextItems(item?.data, item?.id === $selectedChatId)
    }}
  >
    <SelectDropdownItem {item} />
  </div>
</SelectDropdown>
