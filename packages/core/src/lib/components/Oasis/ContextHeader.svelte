<script lang="ts">
  import { createEventDispatcher } from 'svelte'

  export let headline: string | undefined = undefined
  export let description: string | undefined = undefined

  export let headlineEditable = true
  export let descriptionEditable = true

  const dispatch = createEventDispatcher<{
    'changed-headline': string
    'changed-description': string
  }>()

  let headlineInput: HTMLInputElement
  let descriptionInput: HTMLInputElement

  let previousHeadline = headline

  function exitEditingHeadline() {
    if (headline === undefined || previousHeadline === undefined) return
    headlineInput.blur()
    if (headline.trim() === '') {
      headline = previousHeadline
    } else {
      previousHeadline = headline
      dispatch('changed-headline', headline)
    }
  }

  async function exitEditingDescription() {
    if (description === undefined) return
    descriptionInput.blur()
    if (description.trim() === '') {
      description = ''
    }

    dispatch('changed-description', description)
  }
</script>

<div class="context-header">
  <div class="header-content">
    {#if $$slots['breadcrumb']}
      <div class="breadcrumb">
        <slot name="breadcrumb" />
      </div>
    {/if}
    <div class="inputs-section">
      <div class="headline-container">
        {#if headline !== undefined || headlineEditable}
          <div class="headline-title">
            {#if $$slots['icon']}
              <div class="icon-wrapper">
                <slot name="icon" />
              </div>
            {/if}

            <input
              bind:this={headlineInput}
              bind:value={headline}
              class="editable headline"
              type="text"
              disabled={!headlineEditable}
              on:blur={exitEditingHeadline}
              on:keydown={(e) => {
                e.stopPropagation()
                if (e.key === 'Enter') exitEditingHeadline()
              }}
            />
          </div>
        {/if}

        <slot name="headline-content" />
      </div>

      {#if description !== undefined || descriptionEditable}
        <input
          bind:value={description}
          bind:this={descriptionInput}
          class="editable description"
          class:empty={!description || description?.trim() === ''}
          type="text"
          placeholder="Add a description"
          disabled={!descriptionEditable}
          on:mousedown|stopPropagation
          on:blur={exitEditingDescription}
          on:keydown={(e) => {
            e.stopPropagation()
            if (e.key === 'Enter') exitEditingDescription()
            if (e.key === 'Escape') {
              descriptionInput.blur()
            }
          }}
        />
      {/if}

      <slot name="header-content" />
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
    padding: 3.5rem 3rem 3rem 3rem;
    view-timeline-name: --context-header;
    view-timeline-axis: block;
    z-index: 1;

    &::before {
      content: '';
      position: absolute;
      inset: -4px;
      z-index: -2;

      background: linear-gradient(
          to bottom,
          color-mix(in srgb, light-dark(#f7f9fb, #101827), transparent 50%),
          light-dark(#f7f9fb, #101827)
        ),
        var(--background-image);
      background-size: cover;
      background-position: center;
      filter: blur(2px);

      animation: fadeIn 234ms ease-in;
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
    flex-direction: column;
    justify-content: space-between;
    width: 100%;
    margin-right: 4rem;
    .inputs-section {
      position: relative;
      color: var(--contrast-color);
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
        z-index: -1;
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
</style>
