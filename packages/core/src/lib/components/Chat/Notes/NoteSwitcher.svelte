<script lang="ts">
  import { onMount } from 'svelte'
  import { derived, writable, type Writable } from 'svelte/store'

  import { tooltip, getHumanDistanceToNow, useLogScope, useDebounce } from '@deta/utils'
  import { Icon } from '@deta/icons'

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
  import { useToasts } from '@deta/ui'
  import { ResourceTypes } from '@horizon/core/src/lib/types'
  import { useSmartNotes } from '@horizon/core/src/lib/service/ai/note'
  import { useOasis } from '@horizon/core/src/lib/service/oasis'
  import { useResourceManager } from '@horizon/core/src/lib/service/resources'
  import type { ResourceNote } from '@horizon/core/src/lib/service/resources'
  import { useTabsManager } from '@horizon/core/src/lib/service/tabs'
  import { EventContext } from '@deta/types'
  import { SearchResourceTags } from '@deta/utils/src/tags'

  export let selectedChatId: Writable<string> = writable('')
  export let open: Writable<boolean> = writable(false)

  const toasts = useToasts()
  const log = useLogScope('ChatSwitcher')
  const oasis = useOasis()
  const resourceManager = useResourceManager()
  const smartNotes = useSmartNotes()
  const tabsManager = useTabsManager()

  const loadingChat = writable(false)
  const searchValue = writable('')
  const searching = writable(false)
  const searchResults = writable<ResourceNote[]>([])
  const filteredNotes = writable<ResourceNote[]>([])
  const notes = smartNotes.rawNotes

  const selectNewItem = {
    id: 'new',
    label: 'Create Note',
    icon: 'add'
  } as SelectItem

  $: if ($searchValue) {
    handleSearch($searchValue)
  }
  $: loadNotes($notes)

  // Get the current space ID from activeScopeId
  const currentSpaceId = derived([tabsManager.activeScopeId], ([$activeScopeId]) => {
    return $activeScopeId || oasis.defaultSpaceID
  })

  // Filter notes based on the current space
  async function loadNotes(
    notes: ResourceNote[] = smartNotes.rawNotesValue,
    maxItems: number = 50
  ) {
    filteredNotes.set(
      notes
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
        .slice(0, maxItems)
    )
  }

  const items = derived([filteredNotes, selectedChatId], ([notes, selectedChatId]) => {
    return notes
      .filter((note) => !!note.metadata?.name && note.id !== selectedChatId)
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
        SearchResourceTags.Deleted(false),
        SearchResourceTags.ResourceType(ResourceTypes.DOCUMENT_SPACE_NOTE)
      ])

      const resources = results.resources.map((r) => r.resource) as ResourceNote[]
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

  const deleteNote = async (note: ResourceNote) => {
    try {
      log.debug('Deleting note:', note)

      const messageSuffix = note.metadata?.name ? ` "${note.metadata.name}"` : ''
      const { closeType: confirmed } = await openDialog({
        message: `Are you sure you want to delete the note ${messageSuffix}?`,
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

      await oasis.deleteResourcesFromOasis([note.id], false)

      // TODO: why store is not udpated on delete?
      filteredNotes.update((notes) => notes.filter((n) => n.id !== note.id))

      toasts.success('Note deleted!')
    } catch (error) {
      log.error('Failed to delete folder:', error)
    }
  }

  const getContextItems = (note: ResourceNote, active: boolean) =>
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
      await loadNotes($notes)
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

      loadNotes($notes)
    })

    const unsubRemoved = oasis.on('removed-resources', (space, resourceIds) => {
      if (space.id !== $currentSpaceId) return
      if (resourceIds.length === 0) return

      loadNotes($notes)
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
  disabled={$loadingChat}
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
    disabled={$loadingChat}
  >
    <Icon name="chevron.down" className="opacity-60 {$open ? 'rotate-180' : ''}" />
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
