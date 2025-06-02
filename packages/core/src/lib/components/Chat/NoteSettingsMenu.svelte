<script lang="ts">
  import {
    SelectDropdown,
    type SelectItem
  } from '@horizon/core/src/lib/components/Atoms/SelectDropdown'
  import { openDialog } from '@horizon/core/src/lib/components/Core/Dialog/Dialog.svelte'
  import { useSmartNotes } from '@horizon/core/src/lib/service/ai/note'
  import { useOasis } from '@horizon/core/src/lib/service/oasis'
  import type { Resource } from '@horizon/core/src/lib/service/resources'
  import { useTabsManager } from '@horizon/core/src/lib/service/tabs'
  import { useToasts } from '@horizon/core/src/lib/service/toast'
  import { debugMode } from '@horizon/core/src/lib/stores/debug'
  import { ResourceTypes, type TabResource } from '@horizon/core/src/lib/types'
  import { Icon } from '@horizon/icons'
  import { conditionalArrayItem, copyToClipboard, useLogScope } from '@horizon/utils'
  import { createEventDispatcher } from 'svelte'
  import { derived, writable } from 'svelte/store'
  import AppBarButton from '../Browser/AppBarButton.svelte'
  import { CompletionEventID } from '@horizon/core/src/lib/components/Onboarding/onboardingScripts'

  export let resource: Resource
  export let showOnboarding: boolean = true

  const log = useLogScope('NoteSettingsMenu')
  const oasis = useOasis()
  const tabsManager = useTabsManager()
  const toasts = useToasts()

  const dispatch = createEventDispatcher<{
    onboarding: void
    'close-sidebar': void
  }>()

  const isOpen = writable(false)

  const items = derived(
    [],
    () =>
      [
        {
          id: 'view',
          label: 'View Details',
          icon: 'eye'
        },
        {
          id: 'tab',
          label: 'Open as Tab',
          icon: 'arrow.diagonal'
        },
        ...conditionalArrayItem(showOnboarding, {
          id: 'info',
          label: 'How to Use',
          icon: 'info',
          topSeparator: true
        }),
        ...conditionalArrayItem($debugMode, {
          id: 'copy-id',
          label: 'Copy Resource ID',
          icon: 'code'
        }),
        {
          id: 'delete',
          label: 'Delete Note',
          kind: 'danger',
          icon: 'trash',
          topSeparator: true
        }
      ] as SelectItem[]
  )

  const openDetails = async () => {
    log.debug('Opening note details:', resource.id)
    await oasis.openResourceDetailsSidebar(resource.id, { select: true, selectedSpace: 'auto' })
  }

  const deleteNote = async () => {
    log.debug('Deleting note:', resource.id)

    const { closeType: confirmed } = await openDialog({
      message: `Are you sure you want to delete the note "${resource.metadata?.name}"?`,
      actions: [
        { title: 'Cancel', type: 'reset' },
        { title: 'Delete', type: 'submit', kind: 'danger' }
      ]
    })

    if (!confirmed) {
      log.debug('User cancelled chat deletion')
      return
    }

    await oasis.deleteResourcesFromOasis([resource.id], false)

    toasts.success('Note deleted!')
  }

  const openNoteTab = async () => {
    log.debug('Opening note as tab:', resource.id)

    // First perform the action
    tabsManager.openResourcFromContextAsPageTab(resource.id)
    dispatch('close-sidebar')

    // Then dispatch the completion event with a slight delay to ensure
    // the action has completed and state is updated before the event is processed
    setTimeout(() => {
      log.debug('Dispatching OpenNoteAsTab completion event')
      document.dispatchEvent(new CustomEvent(CompletionEventID.OpenNoteAsTab, { bubbles: true }))
    }, 50)
  }

  const showOnboardingNote = async () => {
    const newTab = await tabsManager.create<TabResource>(
      {
        title: 'Intro to Surf Notes',
        icon: '',
        type: 'resource',
        resourceId: 'onboarding',
        resourceType: ResourceTypes.DOCUMENT_SPACE_NOTE
      },
      {
        active: true
      }
    )

    log.debug('created onboarding tab', newTab)
  }

  const handleSelect = async (e: CustomEvent<string>) => {
    try {
      const id = e.detail
      log.debug('Selected', id)

      if (id === 'view') {
        await openDetails()
      } else if (id === 'delete') {
        await deleteNote()
      } else if (id === 'tab') {
        await openNoteTab()
      } else if (id === 'info') {
        showOnboardingNote()
      } else if (id === 'copy-id') {
        copyToClipboard(resource.id)
        toasts.success('Copied resource ID to clipboard!')
      } else {
        log.warn('Unknown action', id)
      }
    } catch (error) {
      log.error('Error handling select', error)
    }
  }
</script>

<SelectDropdown
  {items}
  search="disabled"
  open={isOpen}
  side="top"
  closeOnMouseLeave={false}
  keepHeightWhileSearching
  on:select={handleSelect}
>
  <AppBarButton active={$isOpen}>
    <Icon name="dots.vertical" size="1.2rem" />
  </AppBarButton>
</SelectDropdown>
