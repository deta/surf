<script lang="ts">
  import { DynamicIcon, Icon } from '@horizon/icons'

  import { useContextService, type ContextLink } from '@horizon/core/src/lib/service/contexts'
  import { useOasis, type OasisSpace } from '@horizon/core/src/lib/service/oasis'
  import { writable, derived } from 'svelte/store'
  import { newContext } from '@horizon/core/src/lib/constants/browsingContext'

  import {
    SelectDropdown,
    type SelectItem
  } from '@horizon/core/src/lib/components/Atoms/SelectDropdown'
  import { useLogScope } from '@horizon/utils'
  import {
    contextMenu,
    type CtxItem
  } from '@horizon/core/src/lib/components/Core/ContextMenu.svelte'
  import { useTabsManager } from '@horizon/core/src/lib/service/tabs'
  import { ChangeContextEventTrigger, CreateSpaceEventFrom } from '@horizon/types'
  import CustomPopover from '@horizon/core/src/lib/components/Atoms/CustomPopover.svelte'

  export let space: OasisSpace

  const tabsManager = useTabsManager()
  const oasis = useOasis()
  const contextService = useContextService()
  const log = useLogScope('ContextLinks')

  const spaces = oasis.spaces
  const spaceLinks = contextService.useSpaceLinks(space.id, 'all')

  const popoverOpened = writable(false)
  const expanded = writable(false)

  let selectTimeout: ReturnType<typeof setTimeout>
  let forceExpanded = false

  const saveToSpaceItems = derived([spaces, spaceLinks], ([spaces, spaceLinks]) => {
    const spaceItems = spaces
      .filter((x) => space.id !== x.id)
      .sort((a, b) => {
        return a.indexValue - b.indexValue
      })
      .map((space) => {
        const linkExists = spaceLinks.find((link) => link.target.id === space.id)
        return {
          id: space.id,
          label: space.dataValue.folderName,
          disabled: linkExists,
          icon: linkExists ? 'check' : undefined,
          data: space
        } as SelectItem
      })

    return spaceItems
  })

  const brieflyShowExpanded = () => {
    forceExpanded = true
    setTimeout(() => {
      forceExpanded = false
    }, 1500)
  }

  const handleSelect = async (e: CustomEvent<string>) => {
    const spaceId = e.detail
    log.debug('save', spaceId)

    if (spaceId === newContext.id) {
      const newSpace = await oasis.createNewBrowsingSpace(
        ChangeContextEventTrigger.SpaceInOasis,
        CreateSpaceEventFrom.OasisSpacesView,
        { switch: false, newTab: false }
      )

      contextService.createLink(space.id, newSpace.id)

      oasis.selectedSpace.set(newSpace.id)

      brieflyShowExpanded()

      return
    }

    contextService.createLink(space.id, spaceId)
    brieflyShowExpanded()
  }

  const openContext = (id: string) => {
    if (selectTimeout) {
      clearTimeout(selectTimeout)
    }

    contextService.trackLinkUse(space.id, id)

    tabsManager.changeScope(id, ChangeContextEventTrigger.SpaceInOasis)
    tabsManager.showNewTabOverlay.set(0)
  }

  const selectContext = (id: string, useTimeout = false) => {
    contextService.trackLinkUse(space.id, id)

    if (useTimeout) {
      clearTimeout(selectTimeout)
      selectTimeout = setTimeout(() => {
        oasis.selectedSpace.set(id)
      }, 150)
      return
    }

    oasis.selectedSpace.set(id)
  }

  const getLinkEnd = (link: ContextLink) => {
    if (link.source.id === space.id) {
      return link.target
    } else {
      return link.source
    }
  }

  const getCtxMenuItems = (link: ContextLink) => {
    return [
      {
        text: 'View Context',
        icon: 'eye',
        type: 'action',
        action: () => {
          selectContext(getLinkEnd(link).id)
        }
      },
      {
        text: 'Remove Link',
        icon: 'trash',
        type: 'action',
        kind: 'danger',
        action: () => {
          contextService.deleteLink(link.id)
          brieflyShowExpanded()
        }
      }
    ] as CtxItem[]
  }
</script>

<div class="wrapper">
  <div class="select-wrapper">
    <CustomPopover disableHover={false} position="bottom" sideOffset={3}>
      <div slot="trigger">
        <SelectDropdown
          items={saveToSpaceItems}
          search="auto"
          inputPlaceholder="Select a context to link to…"
          open={popoverOpened}
          side="bottom"
          footerItem={newContext}
          keepHeightWhileSearching
          on:select={handleSelect}
        >
          <button
            class="btn-item add-link-btn"
            class:open={$popoverOpened}
            class:hover-text={$spaceLinks.length === 0}
          >
            <div class="add-link-btn-content">
              <Icon name="add" size="15px" stroke-width="2.25" />
              <span class="btn-text">
                {#if $spaceLinks.length === 0}
                  Link to Context
                {/if}
              </span>
            </div>
          </button>
        </SelectDropdown>
      </div>
      <div slot="content" class="context-linking-explainer">
        <h1>
          <Icon name="link" />
          Context Linking (experimental)
        </h1>
        <p>By linking contexts you can quickly navigate between related contexts in your stuff.</p>

        <p>
          Click the + and select a context to link to this one. This sets the current context as the
          source and the selected one as the target.
        </p>

        <p>
          To link in reverse, switch to the other context first and then select this one from it.
        </p>
      </div>
    </CustomPopover>
  </div>

  {#if $spaceLinks.length > 0}
    <div class="items-wrapper" class:force={forceExpanded}>
      <div class="items">
        {#each $spaceLinks as link (link.id)}
          <button
            class="btn-item"
            on:click={() => selectContext(getLinkEnd(link).id, true)}
            on:dblclick={() => openContext(getLinkEnd(link).id)}
            use:contextMenu={{ items: getCtxMenuItems(link) }}
          >
            <div class="link-direction">
              {#if link.source.id === space.id}
                <Icon name="arrow.right" size="13px" stroke-width="2.5" />
              {:else}
                <Icon name="arrow.left" size="13px" stroke-width="2.5" />
              {/if}
            </div>

            <DynamicIcon name={getLinkEnd(link).getIconString()} size="16px" />

            <div class="link-text">
              {getLinkEnd(link).dataValue.folderName}
            </div>
          </button>
        {/each}
      </div>

      <button class="btn-item expand-btn">
        <Icon name="link" size="15px" stroke-width="2.25" />
        {$spaceLinks.length} Context{$spaceLinks.length > 1 ? 's' : ''}
      </button>
    </div>
  {/if}
</div>

<style lang="scss">
  .wrapper {
    position: absolute;
    top: 0;
    left: 0;
    z-index: 100;
    width: fit-content;
    max-width: calc(100% - 200px);
    overflow: hidden;
    padding: 0 1.75rem;
    display: flex;
    align-items: center;
    gap: 0.5rem;

    --background-color: #ffffff4e;
    --background-color-hover: #ffffff7f;
  }

  .select-wrapper,
  .items-wrapper {
    padding: 1rem 0;
  }

  .items-wrapper {
    width: 100%;
    min-width: 100px;
    position: relative;
    overflow: hidden;

    &:hover,
    &:has([data-context-menu-anchor]),
    &.force {
      .items {
        opacity: 1;
        width: 100%;
        pointer-events: auto;
      }

      .expand-btn {
        opacity: 0;
        pointer-events: none;
      }
    }
  }

  .items {
    width: 0;
    opacity: 0;
    gap: 0.5rem;
    flex-wrap: nowrap;
    overflow-x: scroll;
    -ms-overflow-style: none; /* Hide scrollbar for IE and Edge */
    scrollbar-width: none; /* Hide scrollbar for Firefox */
    display: flex;
    transition:
      opacity 0.2s ease-out,
      width 0.2s ease-out;
    interpolate-size: allow-keywords;
    pointer-events: none;

    &::-webkit-scrollbar {
      display: none; /* Hide scrollbar for Chrome, Safari and Opera */
    }
  }

  .expand-btn {
    opacity: 1;
    position: absolute;
    left: 0;
    top: 1rem;
    transition: opacity 0.2s ease-out;
    font-size: 0.9rem;
    letter-spacing: 0.01em;
    font-weight: 450;
    white-space: nowrap;
  }

  .btn-item {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.4rem 0.5rem;
    border-radius: 10px;
    background: var(--background-color);

    &:hover {
      background: var(--background-color-hover);
    }
  }

  .link-text {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    font-size: 0.9rem;
    letter-spacing: 0.01em;
    font-weight: 450;
  }

  .link-direction {
    display: flex;
    align-items: center;
    justify-content: center;
    opacity: 0.5;
  }

  .add-link-btn {
    padding: 0.5rem;

    &:hover,
    &.open {
      background: var(--background-color-hover);

      .add-link-btn-content {
        opacity: 1;
      }
    }

    &.hover-text {
      padding: 0.36rem 0.5rem;

      &:hover,
      &.open {
        .btn-text {
          opacity: 1;
          width: auto;
          margin-left: 0.5rem;
          transition-delay: 0s;
        }
      }
    }
  }

  .add-link-btn-content {
    display: flex;
    align-items: center;
    font-size: 0.9rem;
    letter-spacing: 0.01em;
    font-weight: 450;
    white-space: nowrap;
    opacity: 0.7;
    transition: opacity 0.1s ease-out;
  }

  .hover-text {
    .btn-text {
      opacity: 0;
      width: 0;
      overflow: hidden;
      margin-left: 0;
      transition:
        opacity 0.1s ease-out,
        width 0.1s ease-out,
        margin-left 0.1s ease-out;
      transition-delay: 0.1s;
      interpolate-size: allow-keywords;
    }
  }

  .context-linking-explainer {
    padding: 1rem;
    background: var(--background-color);
    border-radius: 10px;
    width: 300px;
    max-width: 100%;
    box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
    z-index: 100;
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;

    h1 {
      font-size: 1.1rem;
      font-weight: 500;
      margin-bottom: 0.5rem;

      display: flex;
      align-items: center;
      gap: 0.4rem;
    }

    p {
      font-size: 0.9rem;
      line-height: 1.5;
      color: #000000bf;
    }
  }
</style>
