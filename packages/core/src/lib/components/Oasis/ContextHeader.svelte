<script lang="ts">
  import { OasisSpace, useOasis } from '../../service/oasis'
  import { get, writable, type Writable } from 'svelte/store'
  import { Icon } from '@horizon/icons'

  import DesktopPreview from '../Chat/DesktopPreview.svelte'
  import OasisSpaceSettings from './Scaffolding/OasisSpaceSettings.svelte'
  import { fly } from 'svelte/transition'
  import OasisSpaceUpdateIndicator from './OasisSpaceUpdateIndicator.svelte'
  import { clickOutside } from '@horizon/utils'
  import SpaceIcon from '@horizon/core/src/lib/components/Atoms/SpaceIcon.svelte'

  export let space: OasisSpace

  export let newlyLoadedResources: Writable<any[]>
  export let processingSourceItems: Writable<any[]>
  export let loadingSpaceSources: Writable<boolean>

  const oasis = useOasis()

  const showSettingsModal = writable(false)

  let isEditingHeadline = false
  let isEditingDescription = false

  let headline = ''
  let description = ''
  let previousHeadline = ''
  let headlineInput: HTMLInputElement
  let descriptionInput: HTMLInputElement

  $: {
    const spaceData = get(space.data)
    if (!isEditingHeadline) {
      headline = spaceData.folderName
      previousHeadline = headline
    }
    if (!isEditingDescription) {
      description = spaceData.description || ''
    }
  }

  function enableEditingHeadline() {
    isEditingHeadline = true
    // setTimeout(() => {
    //   if (headlineInput) {
    //     headlineInput.select()
    //   }
    // }, 0)
  }

  function disableEditingHeadline() {
    headlineInput.blur()
    if (headline.trim() === '') {
      headline = previousHeadline
    } else {
      previousHeadline = headline
      oasis.updateSpaceData(space.id, { folderName: headline })
    }
    isEditingHeadline = false
  }

  function enableEditingDescription() {
    isEditingDescription = true
  }

  async function disableEditingDescription() {
    descriptionInput.blur()
    if (description.trim() === '') {
      description = ''
    }
    await oasis.updateSpaceData(space.id, { description })
    isEditingDescription = false
  }
</script>

<div class="context-header">
  <div class="header-content">
    <div class="inputs-section">
      <div class="headline-container">
        <div class="headline-title">
          <div class="icon-wrapper">
            <SpaceIcon folder={space} size="xl" />
          </div>

          <input
            class="editable headline font-gambarino"
            type="text"
            bind:this={headlineInput}
            bind:value={headline}
            on:focus={enableEditingHeadline}
            on:blur={disableEditingHeadline}
            on:keydown={(e) => {
              e.stopPropagation()
              if (e.key === 'Enter') disableEditingHeadline()
              if (e.key === 'Escape') isEditingHeadline = false
            }}
          />
        </div>

        <button class="edit-button" on:click={() => ($showSettingsModal = !$showSettingsModal)}
          ><Icon name="settings" size="1.6em" /></button
        >

        <OasisSpaceUpdateIndicator
          space={writable(space)}
          {newlyLoadedResources}
          {loadingSpaceSources}
          {processingSourceItems}
          on:refresh
        />
      </div>
      {#if $showSettingsModal}
        <div
          class="settings-modal-wrapper"
          transition:fly={{ y: 10, duration: 160 }}
          use:clickOutside={() => ($showSettingsModal = false)}
        >
          <OasisSpaceSettings
            bind:space
            on:refresh
            on:clear
            on:delete
            on:load
            on:delete-auto-saved
          />
        </div>
      {/if}

      <input
        class="editable description"
        class:empty={description.trim() === ''}
        type="text"
        placeholder="Add a description"
        bind:value={description}
        bind:this={descriptionInput}
        on:mousedown|stopPropagation
        on:blur={disableEditingDescription}
        on:focus={enableEditingDescription}
        on:keydown={(e) => {
          e.stopPropagation()
          if (e.key === 'Enter') disableEditingDescription()
          if (e.key === 'Escape') {
            isEditingDescription = false
            descriptionInput.blur()
          }
        }}
      />
    </div>
    <div class="preview-section">
      <DesktopPreview desktopId={space.id} />
    </div>
  </div>
</div>

<style lang="scss">
  @keyframes -global-fadeIn {
    0% {
      opacity: 0;
    }
    100% {
      opacity: 1;
    }
  }
  .context-header {
    position: relative;
    display: flex;
    padding: 6rem 8rem 3rem 8rem;
    view-timeline-name: --context-header;
    view-timeline-axis: block;
    z-index: 1;
    overflow: hidden;

    &::before {
      content: '';
      position: absolute;
      inset: -4px;
      background: red;
      z-index: -1;

      background: linear-gradient(
          to bottom,
          color-mix(in srgb, light-dark(#f7f7f7, #101827), transparent 50%),
          light-dark(#f7f7f7, #101827)
        ),
        var(--background-image);
      background-size: cover;
      background-position: center;
      filter: blur(2px);

      animation: fadeIn 234ms ease-in;

      /*
      opacity: 1;
      transition: opacity;
      transition-duration: 234ms;
      transition-timing-function: ease-out;
      transition-delay: 100ms;*/
    }

    &:hover {
      .empty {
        opacity: 1;
        display: block;
      }
    }
  }

  .header-content {
    display: flex;
    justify-content: space-between;
    width: 100%;
    margin-right: 4rem;
    .inputs-section {
      position: relative;
      &:before {
        content: '';
        display: block;
        position: absolute;
        top: -2rem;
        left: -2rem;
        right: -2rem;
        bottom: 0;
        filter: blur(32px) hue-rotate(4deg) brightness(10.5);
        border-radius: 2rem;
        opacity: 0.15;
        background: var(--contrast-color);
        mix-blend-mode: multiply;
        :global(.dark) & {
          opacity: 0.1;
          filter: blur(20px) hue-rotate(4deg) brightness(0);
        }
      }
    }
  }

  .headline-container {
    display: flex;
    align-items: center;

    opacity: 1;
    translate: 0 0;
    transition: opacity, translate;
    transition-duration: 235ms;
    transition-timing-function: ease-out;
    transition-delay: 175ms;
  }

  .headline-title {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    gap: 0.75rem;
    // margin-left: -3.75rem;
    margin-left: -5px;
  }

  .headline {
    display: relative;
    top: 0;
    font-size: 3rem;
    color: #1a1a1a;
    margin-right: 1rem;
    color: var(--contrast-color);
  }

  .edit-button {
    anchor-name: --edit-button;

    appearance: none;
    display: flex;
    align-items: center;
    padding: 0.5em;
    border-radius: 0.75rem;
    border: none;
    font-size: 0.9rem;
    font-weight: 500;
    letter-spacing: 0.02rem;
    transition-property: color, background, opacity;
    transition-duration: 123ms;
    transition-timing-function: ease-out;

    opacity: 0.7;
    color: rgb(from var(--contrast-color) r g b / 1);

    &:hover {
      color: #0369a1;
      background: rgb(232, 238, 241);
      color: var(--contrast-color);
      background: rgb(from var(--base-color) r g b / 0.4);
      opacity: 1;
    }
  }

  .description {
    font-size: 1.4rem;
    font-family:
      system-ui,
      -apple-system,
      BlinkMacSystemFont,
      'Segoe UI',
      Roboto,
      'Helvetica Neue',
      Arial,
      sans-serif;

    opacity: 0.7;
    translate: 0 0;
    transition: opacity, translate;
    transition-duration: 434ms;
    transition-timing-function: ease-out;
    transition-delay: 375ms;

    color: var(--contrast-color);
  }

  .icon-wrapper {
    width: 3rem;
    height: 3rem;
  }

  .description.empty {
    opacity: 0;
    font-style: italic;
    transition: all 0.1s ease-in-out;

    &.show {
      opacity: 1;
    }
  }

  .editable {
    border: none;
    outline: none;
    background: none;
    padding: 0;
    field-sizing: content;
  }

  .editable.headline {
    font-size: 3rem;
    font-family: 'Gambarino-Display';
  }

  .editable.description {
    font-size: 1.5rem;
    font-family:
      system-ui,
      -apple-system,
      BlinkMacSystemFont,
      'Segoe UI',
      Roboto,
      'Helvetica Neue',
      Arial,
      sans-serif;
  }

  .preview-section {
    opacity: 1;
    translate: 0 0;
    transition: opacity, translate;
    transition-duration: 434ms;
    transition-timing-function: ease-out;
    transition-delay: 483ms;
  }

  .settings-modal-wrapper {
    position: fixed;
    position-anchor: --edit-button;
    position-area: end end;
    z-index: 100;
  }
</style>
