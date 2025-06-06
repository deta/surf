<script lang="ts">
  import { createEventDispatcher } from 'svelte'
  import { derived, writable } from 'svelte/store'

  import {
    conditionalArrayItem,
    copyToClipboard,
    getFileType,
    getHostname,
    getHumanDistanceToNow,
    isMac,
    isModKeyPressed,
    parseStringIntoUrl,
    useDebounce,
    useLogScope,
    wait
  } from '@horizon/utils'
  import { Editor } from '@horizon/editor'
  import { DynamicIcon, Icon, IconConfirmation } from '@horizon/icons'
  import {
    ResourceTagsBuiltInKeys,
    ResourceTypes,
    WEB_RESOURCE_TYPES,
    type ResourceTagsBuiltIn
  } from '@horizon/types'
  import { WebParser } from '@horizon/web-parser'

  import { ResourceJSON, type ResourceObject } from '@horizon/core/src/lib/service/resources'
  import ResourcePreview from '@horizon/core/src/lib/components/Resources/ResourcePreview.svelte'
  import { useOasis } from '@horizon/core/src/lib/service/oasis'
  import { addSelectionById } from '@horizon/core/src/lib/components/Oasis/utils/select'
  import { useConfig } from '@horizon/core/src/lib/service/config'
  import {
    SelectDropdown,
    type SelectItem
  } from '@horizon/core/src/lib/components/Atoms/SelectDropdown'
  import { useTabsManager } from '@horizon/core/src/lib/service/tabs'
  import { openDialog } from '@horizon/core/src/lib/components/Core/Dialog/Dialog.svelte'
  import { SpaceEntryOrigin } from '@horizon/core/src/lib/types'
  import { useResourceManager } from '@horizon/core/src/lib/service/resources'
  import { useToasts } from '@horizon/core/src/lib/service/toast'
  import { isGeneratedResource } from '@horizon/core/src/lib/utils/resourcePreview'

  export let resource: ResourceObject

  const log = useLogScope('ResourceDetails')
  const oasis = useOasis()
  const tabsManager = useTabsManager()
  const resourceManager = useResourceManager()
  const toasts = useToasts()
  const dispatch = createEventDispatcher<{
    open: string
    close: void
    'open-and-chat': string
    remove: { ids: string; deleteFromStuff: boolean }
  }>()

  const userContext = writable(resource.metadata?.userContext ?? '')
  const showContent = writable(false)
  const content = writable<string | null>(null)
  const contentStatus = writable<'idle' | 'loading' | 'refreshing'>('idle')
  const searchValue = writable('')
  const popoverOpened = writable(false)
  const clientWidth = writable(0)

  log.debug('ResourceDetails', resource)

  let editor: Editor
  let copyIcon: IconConfirmation
  let resourcePreview: ResourcePreview

  const numVisibleActions = derived(clientWidth, ($clientWidth) => {
    if ($clientWidth < 375) return 1
    if ($clientWidth < (isWebResource ? 485 : 525)) return 2
    if ($clientWidth < (isWebResource ? 600 : 650)) return 3
    if ($clientWidth < (isWebResource ? 720 : 755)) return 4
    if ($clientWidth < (isWebResource ? 800 : 830)) return 5
    return 6
  })

  const resourceSpaces = derived([oasis.spaces, resource.spaceIds], ([$spaces, $spaceIds]) => {
    return $spaces.filter((space) => $spaceIds.includes(space.id))
  })

  const saveToSpaceItems = derived(
    [oasis.spaces, searchValue, resource.spaceIds],
    ([spaces, searchValue, resourceSpaceIds]) => {
      const spaceItems = spaces
        .sort((a, b) => {
          return a.indexValue - b.indexValue
        })
        .map(
          (space) =>
            ({
              id: space.id,
              label: space.dataValue.folderName,
              disabled: resourceSpaceIds.includes(space.id),
              icon: resourceSpaceIds.includes(space.id) ? 'check' : undefined,
              data: space
            }) as SelectItem
        )

      if (!searchValue) return spaceItems

      return spaceItems.filter((item) =>
        item.label.toLowerCase().includes(searchValue.toLowerCase())
      )
    }
  )

  const resourceActions = derived(numVisibleActions, (numVisibleActions) => {
    return [
      {
        id: 'open-tab',
        label: 'Open as Tab',
        icon: 'arrow.up.right'
      },
      {
        id: 'chat',
        label: 'Use in Chat',
        icon: 'chat'
      },
      ...conditionalArrayItem(isWebResource, {
        id: 'copy-url',
        label: 'Copy URL',
        icon: 'copy'
      }),
      ...conditionalArrayItem(!isWebResource, {
        id: 'reveal',
        label: isMac() ? 'Reveal in Finder' : 'Open in Explorer',
        icon: 'search'
      }),
      {
        id: 'mini-browser',
        label: numVisibleActions >= 3 ? 'Mini Browser' : 'Open in Mini Browser',
        icon: 'eye'
      },
      {
        id: 'edit-title',
        label: 'Edit Title',
        icon: 'edit'
      },
      {
        id: 'delete',
        label: 'Delete from Stuff',
        icon: 'trash',
        kind: 'danger',
        topSeparator: true
      }
    ] as SelectItem[]
  })

  const visibleActions = derived(
    [resourceActions, numVisibleActions],
    ([$resourceActions, $numVisibleActions]) => {
      return $resourceActions.slice(0, $numVisibleActions)
    }
  )

  const moreActions = derived(
    [resourceActions, numVisibleActions],
    ([$resourceActions, $numVisibleActions]) => {
      return $resourceActions.slice($numVisibleActions)
    }
  )

  $: isWebResource = WEB_RESOURCE_TYPES.some((x) => resource.type.startsWith(x))

  $: canonicalUrl = parseStringIntoUrl(
    resource.tags?.find((x) => x.name === ResourceTagsBuiltInKeys.CANONICAL_URL)?.value || ''
  )?.href

  $: sourceHostname = resource.metadata?.sourceURI ? getHostname(resource.metadata.sourceURI) : ''
  $: sourceUrl = parseStringIntoUrl(resource.metadata?.sourceURI || '')

  $: showOpenAsFile =
    resource.type === ResourceTypes.PDF ||
    !(Object.values(ResourceTypes) as string[]).includes(resource.type)

  $: savedWithAction = (resource.tags ?? []).find(
    (x) => x.name === ResourceTagsBuiltInKeys.SAVED_WITH_ACTION
  )?.value as ResourceTagsBuiltIn[ResourceTagsBuiltInKeys.SAVED_WITH_ACTION] | undefined

  $: generatedResource = isGeneratedResource(resource)

  const getSavedWithActionLabel = (
    action?: ResourceTagsBuiltIn[ResourceTagsBuiltInKeys.SAVED_WITH_ACTION]
  ) => {
    switch (action) {
      case 'download':
        return 'Downloaded'
      case 'paste':
        return 'Pasted'
      case 'generated':
        return 'Generated'
      case 'import':
        return 'Imported'
      case 'drag/browser':
      case 'drag/local':
        return 'Dropped'
      default:
        return 'Bookmark'
    }
  }

  const saveUserContext = useDebounce((value: string) => {
    log.debug('saveUserContext', value)
    resourceManager.updateResourceMetadata(resource.id, { userContext: value })
  }, 300)

  const getContent = async () => {
    try {
      if (!(resource instanceof ResourceJSON)) {
        return null
      }

      const data = await resource.getParsedData()
      const content = WebParser.getResourceContent(resource.type, data)

      const text = content.html || content.plain || ''

      return text
    } catch (error) {
      log.error('getContent', error)
      return null
    }
  }

  const toggleShowContent = async () => {
    log.debug('toggleShowContent', $showContent)
    if ($showContent) {
      $showContent = false
    } else {
      $showContent = true
      contentStatus.set('loading')
      $content = await getContent()
      contentStatus.set('idle')
    }
  }

  const selectSpace = async (spaceId: string) => {
    oasis.selectedSpace.set(spaceId)

    await wait(200)

    addSelectionById(resource.id, { removeOthers: true, scrollTo: true })
  }

  const handleOpenAsTab = (e?: MouseEvent) => {
    log.debug('open as tab')
    const shouldBeActive = !e || !isModKeyPressed(e)
    if (shouldBeActive) {
      tabsManager.showNewTabOverlay.set(0)
    }

    tabsManager.openResourcFromContextAsPageTab(resource.id, {
      active: shouldBeActive
    })
  }

  const handleUseInChat = () => {
    log.debug('use in chat')
    dispatch('open-and-chat', resource.id)
  }

  const handleOpenInMiniBrowser = () => {
    log.debug('open in mini browser')
    dispatch('open', resource.id)
  }

  const handleCopyUrl = () => {
    log.debug('copy url')
    copyToClipboard(canonicalUrl || resource.metadata?.sourceURI || '')

    if (copyIcon) {
      copyIcon.showConfirmation()
    }
  }

  const handleOpenAsFile = () => {
    if (resource.metadata?.name) {
      window.api.openResourceLocally({
        id: resource.id,
        metadata: resource.metadata,
        type: resource.type,
        path: resource.path,
        deleted: resource.deleted,
        createdAt: resource.createdAt,
        updatedAt: resource.updatedAt
      })
    } else {
      openDialog({
        title: 'Resource not found',
        message: '',
        actions: [{ title: 'Close', type: 'reset' }]
      })
    }
  }

  const refreshResourceData = async () => {
    const resourceType = getFileType(resource.type)

    contentStatus.set('refreshing')

    try {
      await resourceManager.refreshResourceData(resource)
      $content = await getContent()
    } catch (e) {
      log.error('Failed to refresh resource', e)
      toasts.error(`Failed to refresh ${resourceType}`)
    } finally {
      contentStatus.set('idle')
    }
  }

  const handleContextSelect = (e: CustomEvent<string>) => {
    log.debug('save to', e.detail)

    if (resource.spaceIdsValue.includes(e.detail)) {
      oasis.removeResourcesFromSpace(e.detail, [resource.id])
    } else {
      oasis.addResourcesToSpace(e.detail, [resource.id], SpaceEntryOrigin.ManuallyAdded)
    }
  }

  const handleDelete = async () => {
    dispatch('remove', { ids: resource.id, deleteFromStuff: true })
  }

  const handleOpenSource = (e: MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

    if (!sourceUrl) return

    if (e.shiftKey) {
      handleOpenInMiniBrowser()
      return
    }

    handleOpenAsTab(e)
  }

  const runAction = (id: string) => {
    switch (id) {
      case 'open-tab':
        handleOpenAsTab()
        break
      case 'chat':
        handleUseInChat()
        break
      case 'mini-browser':
        handleOpenInMiniBrowser()
        break
      case 'copy-url':
        handleCopyUrl()
        break
      case 'delete':
        handleDelete()
        break
      case 'reveal':
        handleOpenAsFile()
        break
      case 'edit-title':
        resourcePreview.startEditingTitle()
        break
    }
  }

  $: saveUserContext($userContext)
</script>

<div class="wrapper" bind:clientWidth={$clientWidth}>
  <button on:click={() => dispatch('close')} class="close">
    <Icon name="close" size="16px" />
  </button>

  <div class="header">
    <div class="preview">
      <ResourcePreview
        bind:this={resourcePreview}
        {resource}
        viewMode="responsive"
        interactive
        disableContextMenu
        origin="stuff-details"
        on:open
      />
    </div>
  </div>

  <div class="actions">
    {#each $visibleActions as action (action.id)}
      <button on:click={() => runAction(action.id)} class="action">
        <Icon name={action.icon} size="17px" />
        {action.label}
      </button>
    {/each}

    {#if $moreActions.length > 0}
      <SelectDropdown
        items={moreActions}
        search="disabled"
        side="bottom"
        on:select={(e) => runAction(e.detail)}
      >
        <button class="action">
          <Icon name="dots" size="17px" />
          More
        </button>
      </SelectDropdown>
    {/if}
  </div>

  <div class="details-content">
    <div class="metadata">
      <div class="metadata-item">
        <div class="metadata-item-label">First Saved</div>
        <div class="metadata-item-value text-label-small">
          {getHumanDistanceToNow(resource.createdAt)}
        </div>
      </div>

      <div class="metadata-item">
        <div class="metadata-item-label">Last Updated</div>
        <div class="metadata-item-value text-label-small">
          {getHumanDistanceToNow(resource.updatedAt)}
        </div>
      </div>

      <div class="metadata-item">
        <div class="metadata-item-label">Type</div>
        <div class="metadata-item-value text-label-small">
          {#if generatedResource}
            Surflet
          {:else if resource.type === ResourceTypes.DOCUMENT_SPACE_NOTE}
            Note
          {:else}
            {getFileType(resource.type)}
          {/if}
        </div>
      </div>

      <div class="metadata-item">
        <div class="metadata-item-label">Action</div>
        <div class="metadata-item-value text-label-small">
          {getSavedWithActionLabel(savedWithAction)}
        </div>
      </div>

      {#if sourceUrl && (sourceUrl?.href !== canonicalUrl || generatedResource)}
        <div class="metadata-item">
          <div class="metadata-item-label">
            {#if generatedResource}
              Generated on
            {:else}
              Source
            {/if}
          </div>
          <button on:click={handleOpenSource} class="space-item">
            <DynamicIcon name="favicon;;{sourceUrl.href}" size="16px" />
            {#if sourceHostname}
              <div class="text-label-small">{sourceHostname}</div>
            {/if}
          </button>
        </div>
      {/if}

      {#if $resourceSpaces.length > 0}
        <div class="metadata-item">
          <div class="metadata-item-label">
            <div>Saved In</div>

            <SelectDropdown
              items={saveToSpaceItems}
              search="manual"
              {searchValue}
              inputPlaceholder="Select a context to save to…"
              open={popoverOpened}
              side="bottom"
              keepHeightWhileSearching
              on:select={handleContextSelect}
            >
              <div class="context-select-trigger">
                {#if $popoverOpened}
                  <Icon name="chevron.up" size="16px" />
                {:else}
                  <Icon name="chevron.down" size="16px" />
                {/if}
              </div>

              <div slot="empty" class="flex flex-col justify-center gap-2 h-full">
                {#if $searchValue.length > 0 || $saveToSpaceItems.length === 0}
                  <div class="h-full flex flex-col justify-center">
                    <p class="text-gray-400 dark:text-gray-400 text-center py-6">
                      No Contexts found
                    </p>
                  </div>
                {/if}
              </div>
            </SelectDropdown>
          </div>
          <div class="spaces-wrapper">
            {#each $resourceSpaces as space}
              <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
              <div
                class="space-item"
                on:click|preventDefault|stopPropagation={() => selectSpace(space.id)}
              >
                <DynamicIcon name={space.getIconString()} size="16px" />
                <div class="text-label-small">
                  {space.dataValue.folderName}
                </div>
              </div>
            {/each}
          </div>
        </div>
      {/if}
    </div>

    {#if resource.type !== ResourceTypes.DOCUMENT_SPACE_NOTE}
      <div class="user-context">
        {#if resource.metadata}
          <Editor
            bind:this={editor}
            bind:content={$userContext}
            autofocus={false}
            placeholder="Add your own notes…"
          />
        {/if}
      </div>
    {/if}

    {#if isWebResource}
      <div class="content-wrapper">
        <div class="content-title">
          <button
            on:click={() => toggleShowContent()}
            class="content-action"
            style="padding-left: 0;"
          >
            <Icon name="chevron.right" className={$showContent ? 'rotate-90' : ''} />
            Saved Content
          </button>

          {#if $contentStatus === 'refreshing'}
            <div class="content-action">
              <Icon name="spinner" size="17px" />
              <div class="text-label-small">Refreshing</div>
            </div>
          {:else}
            <button on:click={() => refreshResourceData()} class="content-action">
              <Icon name="reload" size="17px" />
              <div class="text-label-small">Refresh</div>
            </button>
          {/if}
        </div>

        {#if $showContent}
          {#if $contentStatus === 'loading'}
            <div class="loading">
              <Icon name="spinner" />
              Loading content…
            </div>
          {:else}
            <div class="content">
              {#if $content}
                <Editor content={$content} readOnly />
              {:else}
                <div>No content available</div>
              {/if}
            </div>
          {/if}
        {/if}
      </div>
    {/if}
  </div>
</div>

<style lang="scss">
  .wrapper {
    position: relative;
    height: 100%;
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 2rem;
    padding: 2rem;
    background-color: #fff;
    border: 1px solid #e5e5e5;

    :global(.dark) & {
      background-color: #1f2937;
      border-color: #2d3748;
    }

    & {
      :global(.tiptap) {
        font-size: 0.9em !important;
      }
    }
  }

  .close {
    position: absolute;
    top: 0.25rem;
    left: 0.25rem;
    background: none;
    border: none;
    padding: 0.25rem;
    border-radius: 0.5rem;
    transition: opacity 0.2s ease-in-out;
    opacity: 0.25;

    &:hover {
      opacity: 1;
    }
  }

  .header {
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .actions {
    display: flex;
    gap: 0.75rem;
    align-items: center;
    justify-content: center;
  }

  .action {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.35rem 0.75rem;
    border-radius: 12px;
    background: #f4f4f4;
    border: 1px dashed #e5e5e5;
    cursor: pointer;
    transition: background 0.2s ease-in-out;

    font-size: 0.9em;
    font-weight: 450;
    letter-spacing: 0.01em;

    :global(.dark) & {
      background-color: rgb(55 65 81);
      border-color: rgb(75 85 99);
      color: rgb(209 213 219);

      &:hover {
        background: #2d3748;
      }
    }

    &:hover {
      background: #e5e5e5;
    }
  }

  .details-content {
    display: flex;
    flex-direction: column;
    gap: 2rem;
    height: 100%;
    overflow-y: auto;
  }

  .preview {
    width: 100%;
    height: auto;
    aspect-ratio: 5 / 4;
  }

  .text-label-small {
    font-size: 0.9em;
    font-weight: 450;
    letter-spacing: 0.01em;
  }

  .metadata {
    display: flex;
    align-items: flex-start;
    justify-content: stretch;
    flex-wrap: wrap;
    gap: 1.5rem;
    overflow-x: hidden;
    width: 100%;
    height: fit-content;
    flex-shrink: 0;
  }

  .metadata-item {
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    padding: 0 0.25rem;
    width: fit-content;

    :global(.dark) & {
      color: rgb(209 213 219);
    }
  }

  .metadata-item-label {
    display: flex;
    align-items: center;
    gap: 0.25rem;

    font-size: 0.9em;
    font-weight: 400;
    letter-spacing: 0.01em;
    opacity: 0.7;
  }

  .metadata-item-value {
    display: flex;
    align-items: center;
    gap: 0.25rem;
  }

  .context-select-trigger {
    padding: 0.25rem;
    margin: -0.25rem;
    border-radius: 8px;

    :global(.dark) & {
      &:hover {
        background: #2d3748;
      }
    }

    &:hover {
      background: #f4f4f4;
    }
  }

  .user-context {
    padding: 1rem;
    border: 1px dashed #e5e5e5;
    border-radius: 0.5rem;
    min-height: 100px;
    max-height: 600px;
    resize: vertical;
    overflow-y: auto;

    :global(.dark) & {
      border-color: rgb(75 85 99);
      color: rgb(209 213 219);
    }
  }

  .loading {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .content-wrapper {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    height: 100%;
    min-height: 250px;
    overflow: hidden;
  }

  .content-title {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;

    button {
      flex-shrink: 0;
    }
  }

  .content-action {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.25rem 0.5rem;
    border-radius: 10px;
    opacity: 0.7;

    transition: all 0.2s ease-in-out;

    :global(.dark) & {
      color: rgb(209 213 219);

      &:hover {
        background: #2d3748;
      }
    }

    &:hover {
      background: #f4f4f4;
      opacity: 1;
    }
  }

  .content {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    padding: 1rem;
    border: 1px dashed #e5e5e5;
    border-radius: 0.5rem;
    overflow-y: auto;

    :global(.dark) & {
      border-color: rgb(75 85 99);
      color: rgb(209 213 219);
    }
  }

  .spaces-wrapper {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  .space-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.25rem 0.5rem;
    border-radius: 10px;
    border: 1px dashed #e5e5e5;
    user-select: none;
    outline: none;

    :global(.dark) & {
      border-color: rgb(75 85 99);
      color: rgb(209 213 219);

      &:hover {
        background: #2d3748;
      }
    }

    &:active {
      outline: none;
    }

    &:hover {
      background: #f4f4f4;
    }
  }
</style>
