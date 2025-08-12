<script lang="ts">
  import { slide } from 'svelte/transition'
  import { writable, derived } from 'svelte/store'
  import { Tooltip } from 'bits-ui'

  import { DynamicIcon, Icon } from '@deta/icons'
  import { flyAndScale, getFileType, getHostname, tooltip, useLogScope } from '@deta/utils'
  import type { ResourceStateCombined } from '@deta/types'
  import { Editor } from '@deta/editor'

  import type { SavingItem } from '@horizon/core/src/lib/service/saving'
  import { useOasis } from '@horizon/core/src/lib/service/oasis'
  import { useToasts } from '@deta/ui'
  import { SpaceEntryOrigin } from '@horizon/core/src/lib/types'

  import {
    SelectDropdown,
    type SelectItem
  } from '@horizon/core/src/lib/components/Atoms/SelectDropdown'
  import { useResourceManager } from '@horizon/core/src/lib/service/resources'

  export let item: SavingItem

  const log = useLogScope('SavingItem')
  const oasis = useOasis()
  const resourceManager = useResourceManager()
  const toasts = useToasts()

  type State = ResourceStateCombined | 'loading'

  const searchValue = writable('')
  const popoverOpened = writable(false)
  const resourceSpaceIds = writable<string[]>([])
  const savingInProgress = writable(false)
  const forceOpen = writable(false)
  const temporaryResourceSpaces = writable<string[]>([])

  let hovered = false

  $: data = item.data
  $: userContext = item.userContext
  $: title = item.title

  $: resource = item.resource
  $: resourceState = $resource?.state
  $: state = (!$resourceState ? 'loading' : $resourceState) as State

  $: spaceIds = $resource?.spaceIds
  $: spaces = Array.from(new Set([...($spaceIds ? $spaceIds : []), ...$temporaryResourceSpaces]))

  $: resourceSpaceIds.set($spaceIds ?? [])

  $: formattedUrl = getHostname($data.url)

  $: log.debug('state', state)
  $: log.debug('resource', $resource)
  $: log.debug('temporaryResourceSpaces', $temporaryResourceSpaces)
  $: log.debug('spaces', spaces)

  $: if (state === 'idle' || state === 'error') {
    if (!hovered && !$popoverOpened) {
      item.startTimeout()
    }
  } else {
    item.stopTimeout()
  }

  $: if ($popoverOpened) {
    item.stopTimeout()
  }

  $: if (hovered || $popoverOpened || $savingInProgress) {
    log.debug('prevent close')
    item.preventClose.set(true)
  } else {
    item.preventClose.set(false)
  }

  $: if ($popoverOpened || $savingInProgress) {
    forceOpen.set(true)
  } else {
    setTimeout(() => {
      forceOpen.set(false)
    }, 1500)
  }

  $: if ($resource && $temporaryResourceSpaces.length > 0) {
    log.debug(
      'resource became available, persisting temporary spaces list',
      $temporaryResourceSpaces
    )
    persistTemporaryResourceSpaces($temporaryResourceSpaces)
  }

  const saveToSpaceItems = derived(
    [oasis.spaces, searchValue, resourceSpaceIds, temporaryResourceSpaces],
    ([spaces, searchValue, resourceSpaceIds, temporaryResourceSpaces]) => {
      const spaceItems = spaces
        .sort((a, b) => {
          return a.indexValue - b.indexValue
        })
        .map((space) => {
          const checked =
            resourceSpaceIds.includes(space.id) || temporaryResourceSpaces.includes(space.id)
          return {
            id: space.id,
            label: space.dataValue.folderName,
            disabled: checked,
            icon: checked ? 'check' : space.getIconString(),
            data: space
          } as SelectItem
        })

      if (!searchValue) return spaceItems

      return spaceItems.filter((item) =>
        item.label.toLowerCase().includes(searchValue.toLowerCase())
      )
    }
  )

  $: log.debug('popoverOpened', $popoverOpened)

  const closeItem = async () => {
    oasis.removePendingSave()
  }

  const saveItem = async () => {
    await item.persistChanges()
    closeItem()
  }

  const viewInStuff = async () => {
    if (!$resource) return
    await saveItem()

    oasis.openResourceDetailsSidebar($resource, {
      select: true,
      selectedSpace: 'auto'
    })
  }

  const handleMouseEnter = () => {
    hovered = true
    item.stopTimeout()
  }

  const handleMouseLeave = () => {
    hovered = false
    item.startTimeout()
  }

  const persistTemporaryResourceSpaces = async (spaceIds: string[]) => {
    if (!$resource) return

    if (spaceIds.length > 0) {
      log.debug('saving resource to spaces', spaceIds)

      for (const spaceId of spaceIds) {
        await oasis.addResourcesToSpace(spaceId, [$resource.id], SpaceEntryOrigin.ManuallyAdded)
      }

      $temporaryResourceSpaces = []
    }
  }

  const toggleSaveToSpace = async (spaceId: string) => {
    try {
      log.debug('save to', spaceId)

      savingInProgress.set(true)

      if (!$resource) {
        log.debug('no resource to save yet, using temporary list')
        if ($temporaryResourceSpaces.includes(spaceId)) {
          $temporaryResourceSpaces = $temporaryResourceSpaces.filter((id) => id !== spaceId)
        } else {
          $temporaryResourceSpaces = [...$temporaryResourceSpaces, spaceId]
        }

        return
      }

      if ($resource.spaceIdsValue.includes(spaceId)) {
        await oasis.removeResourcesFromSpace(spaceId, [$resource.id])
      } else {
        await oasis.addResourcesToSpace(spaceId, [$resource.id], SpaceEntryOrigin.ManuallyAdded)
      }
    } catch (e) {
      log.error('error saving to space', e)
    } finally {
      savingInProgress.set(false)
    }
  }

  const refreshResourceData = async () => {
    if (!$resource) return

    const resourceType = getFileType($resource.type)
    const toast = toasts.loading(`Reprocessing ${resourceType}`)

    try {
      state = 'loading'
      await resourceManager.refreshResourceData($resource)
      toast.success(`Reprocessed ${resourceType}!`)
    } catch (e) {
      log.error('Failed to reprocess resource', e)
      toast.error(`Failed to reprocess ${resourceType}`)
    } finally {
      state = $resource.stateValue
    }
  }
</script>

<!-- svelte-ignore a11y-no-static-element-interactions -->
<div
  class="wrapper no-drag"
  class:force-open={$forceOpen}
  on:mouseenter={handleMouseEnter}
  on:mouseleave={handleMouseLeave}
>
  <button on:click={() => closeItem()} class="close">
    <Icon name="close" size="0.9rem" />
  </button>

  <div class="header">
    <div class="meta">
      <DynamicIcon name={$data.icon ?? 'world'} size="1rem" />
      <div class="url">
        {formattedUrl}
      </div>
    </div>

    <div class="status-indicator">
      <!-- "loading" | "idle" | "extracting" | "post-processing" | "error" -->
      {#if state === 'idle'}
        <Icon name="check" size="0.9rem" />
        <div class="status">Processed!</div>
      {:else if state === 'error'}
        <button
          on:click={() => refreshResourceData()}
          use:tooltip={{ text: 'Retry processing', position: 'left' }}
        >
          <Icon name="reload" size="0.9rem" />
        </button>
        <div class="status">Failed to process</div>
      {:else}
        <Icon name="spinner" size="0.9rem" />

        <div class="status">
          {#if state === 'loading'}
            Processing…
          {:else if state === 'extracting'}
            Extracting…
          {:else if state === 'post-processing'}
            Post-processing…
          {:else}
            {state}
          {/if}
        </div>
      {/if}
    </div>
  </div>

  <div class="data title" class:no-title={!$title}>
    <input bind:value={$title} placeholder="Title" class="title-input" />
  </div>

  <div class="expandable">
    {#if $data.description}
      <div transition:slide={{ axis: 'y' }} class="data">
        <p class="description">
          {$data.description}
        </p>
      </div>
    {/if}

    <!-- key block is needed to make sure the editor updates once the resource user context is fully loaded -->
    {#key !!$userContext}
      <div class="context">
        <Editor bind:content={$userContext} placeholder="Add some notes..." />
      </div>
    {/key}

    <footer>
      <div class="actions">
        {#if $resource}
          <button on:click={() => viewInStuff()} class="btn secondary">
            <Icon name="eye" size="1rem" />
            View in Stuff
          </button>
        {/if}
      </div>

      <div class="spaces spaces-footer">
        {#if spaces.length > 0}
          {#each spaces as id (id)}
            {#await oasis.getSpace(id) then space}
              {#if space}
                <Tooltip.Root openDelay={25} closeDelay={10}>
                  <Tooltip.Trigger>
                    <!-- svelte-ignore a11y-click-events-have-key-events -->
                    <div on:click={() => toggleSaveToSpace(space.id)}>
                      <DynamicIcon name={space.getIconString()} size="1rem" />
                    </div>
                  </Tooltip.Trigger>
                  <Tooltip.Content
                    transition={flyAndScale}
                    transitionConfig={{ y: 8, duration: 150 }}
                    sideOffset={8}
                  >
                    <div class="bg-gray-100 dark:bg-gray-800">
                      <Tooltip.Arrow
                        class="rounded-[2px] border-l border-t border-gray-200 dark:border-gray-700"
                      />
                    </div>
                    <div
                      class="flex items-center justify-center border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-xl px-3 py-2 font-medium shadow-md outline-none"
                      style="font-size: 0.8rem;"
                    >
                      {space.dataValue.folderName}
                    </div>
                  </Tooltip.Content>
                </Tooltip.Root>
              {/if}
            {/await}
          {/each}
        {/if}

        <SelectDropdown
          items={saveToSpaceItems}
          search="manual"
          {searchValue}
          inputPlaceholder="Select a Context to save to…"
          open={popoverOpened}
          side="bottom"
          keepHeightWhileSearching
          on:select={(e) => toggleSaveToSpace(e.detail)}
        >
          <div class="save-to-space" style="opacity: 0.5;">
            <Icon name="add" size="15px" className={$popoverOpened ? 'rotate-90' : ''} />
          </div>

          <div slot="empty" class="flex flex-col justify-center gap-2 h-full">
            {#if $searchValue.length > 0 || $saveToSpaceItems.length === 0}
              <div class="h-full flex flex-col justify-center">
                <p class="text-gray-400 dark:text-gray-400 text-center py-6">No Contexts found</p>
              </div>
            {/if}
          </div>
        </SelectDropdown>
      </div>
    </footer>
  </div>
</div>

<style lang="scss">
  @use '@horizon/core/src/lib/styles/utils' as utils;

  .wrapper {
    @include utils.light-dark-custom(
      'background-fill-mix',
      rgba(255, 255, 255, 1),
      rgba(0, 0, 0, 1),
      rgba(255, 255, 255, 1),
      rgba(0, 0, 0, 1)
    );

    --radius: 16px;
    @include utils.squircle($fill: var(--fill), $radius: var(--radius), $smooth: 0.33);
    @include utils.light-dark-custom(
      'fill',
      #fbf5ef,
      rgba(0, 0, 0, 1),
      color-mix(in srgb, var(--base-color), 55% var(--background-fill-mix)),
      color-mix(in srgb, var(--base-color), 30% var(--background-fill-mix))
    );
    @include utils.light-dark-custom(
      'squircle-outline-color',
      rgba(0, 0, 0, 0.08),
      rgba(255, 255, 255, 0.18),
      color-mix(in srgb, var(--base-color), 40% rgba(190, 190, 190, 0.75))
    );

    --squircle-shadow: 0px 2px 2px -1px var(--black-05);
    --squircle-outline-width: 2.25px;

    --transition-timing-function: cubic-bezier(0.25, 0.1, 0.25, 1);
    --transition-duration: 0.3s;
    --transition-delay: 0.1s;

    color: var(--contrast-color);
    position: relative;

    width: 100%;
    display: flex;
    flex-direction: column;
    padding-inline: 0.8rem;
    padding-block: 0.6rem;
    padding-top: 0.85rem;
    padding-bottom: 0.75rem;
    font-size: 0.9rem;
    transition: all var(--transition-duration) var(--transition-timing-function);

    :global(body:has(#app-contents.horizontalTabs)) & {
      width: 42ch;
    }

    /* Adding specific transition delays for hover effects */
    &.force-open .expandable,
    &.force-open .title,
    &.force-open .close,
    &:hover .expandable,
    &:hover .title,
    &:hover .close {
      transition-delay: 0s; /* No delay when force open */
    }

    &:hover,
    &.force-open {
      padding-bottom: 0.75rem;
      .expandable {
        max-height: 300px;
        opacity: 1;
        margin-top: 0.5rem;
      }

      .title {
        display: flex;
        margin-top: 0.5rem;
      }

      .close {
        display: block;
      }
    }
  }

  .expandable {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    max-height: 0;
    opacity: 0;
    margin-left: -2px;
    margin-top: 0;
    overflow: hidden;
    transition:
      all var(--transition-duration) var(--transition-timing-function),
      max-height var(--transition-duration) var(--transition-timing-function)
        var(--transition-delay),
      opacity var(--transition-duration) var(--transition-timing-function) var(--transition-delay),
      margin-top var(--transition-duration) var(--transition-timing-function)
        var(--transition-delay);

    .data {
      padding-inline: 0.2rem;
    }
  }

  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
  }

  .meta {
    display: flex;
    gap: 8px;
  }

  .url {
    font-size: 0.8em;
    color: var(--col-text-muted);
  }

  .data {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .title {
    margin-top: 0.25rem;
    transition:
      all var(--transition-duration) var(--transition-timing-function),
      display 0s var(--transition-timing-function) var(--transition-delay),
      margin-top var(--transition-duration) var(--transition-timing-function)
        var(--transition-delay);

    &.no-title {
      display: none;
      margin-top: 0;
    }
  }

  .description {
    width: 100%;
    font-size: 0.9em;
    color: var(--col-text-muted);

    // limit to 2 lines
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    transition: -webkit-line-clamp var(--transition-duration) var(--transition-timing-function);
  }

  .title-input {
    font-size: 1em;
    font-weight: 600;
    field-sizing: content;
    background: transparent;
    text-decoration: underline rgb(from currentColor r g b / 0.35) dotted;
    text-underline-offset: 3px;

    &:focus {
      outline: none;
      text-decoration-color: rgb(from currentColor r g b / 0.65);
    }
  }

  .context {
    width: 100%;
    min-height: 70px;
    max-height: 600px;
    resize: vertical;
    overflow-y: auto;
    padding: 8px;
    border: 1px solid rgb(from currentColor r g b / 0.45);
    border-radius: 8px;
    //      background: color-mix(in srgb, var(--base-color), 50% rgba(190, 190, 190, 0.75));
    background: transparent;
    background: rgb(from currentColor r g b / 0.1);
    color: var(--color);

    & {
      :global(.tiptap) {
        font-size: 0.95rem !important;
      }
    }

    &:focus {
      outline: none;
      border-color: var(--contrast-color);
    }
  }

  .actions {
    display: flex;
    align-items: center;
    gap: 0.25rem;

    --radius: 10px;

    > :first-child {
      @include utils.squircle(
        $fill: var(--fill),
        $radius: 5px,
        $radius-bottom-left: var(--radius),
        $smooth: 0.33
      );
      padding-left: 0.6rem;
    }

    button {
      @include utils.light-dark-custom('color', #fff, #fff, var(--base-color), var(--base-color));
      @include utils.light-dark-custom(
        'fill',
        #54b1ef,
        #54b1ef,
        var(--contrast-color),
        var(--contrast-color)
      );

      &.secondary {
        @include utils.light-dark-custom(
          'color',
          rgba(0 0 0 / 55%),
          #fff,
          var(--contrast-color),
          var(--contrast-color)
        );
        @include utils.light-dark-custom(
          'fill',
          rgba(0 0 0 / 10%),
          rgba(255 255 255 / 35%),
          color-mix(in srgb, var(--base-color), 40% rgba(190, 190, 190, 0.75)),
          color-mix(in srgb, var(--base-color), 40% rgba(190, 190, 190, 0.75))
        );
      }

      &:hover {
        opacity: 0.9;
      }

      @include utils.squircle($fill: var(--fill), $radius: 5px, $smooth: 0.33);
      --squircle-outline-width: 0;
      --squircle-outline-color: transparent;

      text-box: trim-both cap alphabetic;
      display: flex;
      align-items: center;
      justify-items: center;
      gap: 0.35rem;
      padding: 0.3rem 0.9rem;
      color: var(--color);
      font-size: 0.875rem;
      font-weight: 450;
      letter-spacing: 0.01em;
      cursor: pointer;
    }
  }

  .status-indicator {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.8em;
    color: var(--col-text-muted);
  }

  .status {
    font-size: 0.9em;
    color: var(--col-text-muted);
  }

  footer {
    display: flex;
    flex-shrink: 0;
    flex-grow: 1;
    align-items: center;
    justify-content: space-between;
    gap: 1.25rem;
  }

  .spaces {
    display: flex;
    flex-shrink: 0;
    flex-grow: 1;
    align-items: center;
    justify-content: end;
    gap: 0.5rem;
    margin-top: 0.25rem;
  }

  .save-to-space {
    font-size: 0.8em;
    opacity: 0.75;
    padding: 0.25rem;
    border-radius: 8px;

    &:hover {
      background: var(--col-text-muted);
    }
  }

  .close {
    position: absolute;
    z-index: 1;
    top: 2px;
    right: 2px;
    transform: translate(50%, -50%);

    display: none;
    padding: 0.2rem;
    border-radius: 100%;
    transition:
      opacity var(--transition-duration) var(--transition-timing-function),
      display 0s var(--transition-timing-function) var(--transition-delay);

    background: #fbf5ef;
    color: var(--col-text-muted);
    border: 1px solid #c9c9c9;

    &:hover {
      opacity: 0.9;
    }
  }
</style>
