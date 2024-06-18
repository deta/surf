<script lang="ts">
  import { type Resource, useResourceManager } from '../../service/resources'
  import { useLogScope } from '../../utils/log'
  import { generateRootDomain, parseStringIntoUrl } from '../../utils/url'
  import { formatDistanceToNow, parseISO } from 'date-fns'
  import autosize from 'svelte-autosize'

  import Link from '../Atoms/Link.svelte'

  const log = useLogScope('OasisResourceDetails')

  export let draggable = true
  export let resource: Resource

  const resourceManager = useResourceManager()

  let userContext = resource.metadata?.userContext

  let textareaRef: HTMLTextAreaElement

  $: {
    resourceManager.updateResourceMetadata(resource.id, { userContext })
  }

  $: sourceURL = parseStringIntoUrl(resource.metadata?.sourceURI ?? '')

  function formatRelativeDate(dateIsoString: string) {
    return formatDistanceToNow(parseISO(dateIsoString), { addSuffix: true })
  }
</script>

<!-- svelte-ignore missing-declaration a11y-no-static-element-interactions -->
<div class="details-item">
  <div {draggable} on:dragstart class="details-preview">
    <slot />
  </div>
  <div class="textarea-wrapper">
    {#if userContext !== ''}
      <div class="header">
        <div class="title">Notes</div>
      </div>
    {/if}
    <textarea
      use:autosize
      bind:this={textareaRef}
      bind:value={userContext}
      placeholder="Add Note..."
    ></textarea>
  </div>

  <div class="metadata-wrapper">
    {#if sourceURL}
      <div class="header">
        <div class="title">Go to Source</div>
      </div>
    {/if}
    <div class="metadata">
      {#if sourceURL}
        <div class="source-button">
          <Link
            url={sourceURL.href}
            label={`${generateRootDomain(sourceURL.href)}`}
            locked={true}
          />
        </div>
      {/if}

      <div class="metadata-text">
        <span>Updated {formatRelativeDate(resource.updatedAt)}</span>
        <span>Created {formatRelativeDate(resource.createdAt)}</span>
      </div>
    </div>
  </div>
</div>

<style lang="scss">
  .details-item {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4rem;
    width: 100%;
    max-height: 42rem;
    height: min-content;
    .details-preview {
      padding: 2rem;
      max-width: 30rem;
    }
  }

  :global(.details-preview img) {
    max-height: 40rem;
  }

  .textarea-wrapper,
  .metadata-wrapper,
  .references-wrapper {
    position: relative;
    padding: 1rem 4rem;
    left: 0;
    right: 0;
    display: flex;
    width: 100%;
    justify-content: center;
    background: white;
    border-top: 0.5px solid rgba(0, 0, 0, 0.15);
    border-bottom: 0.5px solid rgba(0, 0, 0, 0.15);
  }

  textarea {
    width: 100%;
    max-width: 28rem;
    height: 150px;
    padding: 10px;
    border-radius: 8px;
    outline: none;
    resize: vertical;
    font-family: inherit;
    font-size: 1.25rem;
    font-weight: 500;
    letter-spacing: 0.02rem;
    border: 0;
    resize: none;
  }

  .textarea-wrapper,
  .references-wrapper .metadata-wrapper {
    display: flex;
    align-items: center;
    flex-direction: column;
    .header {
      width: 100%;
      max-width: 28rem;
      padding: 0.75rem;
    }
  }

  .metadata-wrapper {
    padding: 2rem 0;
    flex-direction: column;
    align-items: center;
    text-align: center;
    .header {
      width: 100%;
      max-width: 28rem;
      padding: 0.75rem;
    }
    .metadata {
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      gap: 1rem;
      width: 100%;
      max-width: 28rem;
      font-family: inherit;
      font-size: 1.25rem;
      font-weight: 500;
      .source-button {
        display: flex;
        padding: 0.5rem;
        justify-content: center;
        align-items: center;
        width: fit-content;
        border-radius: 6px;
        border: 0.5px solid rgba(0, 0, 0, 0.2);
        transition: 60ms ease-out;
        &:hover {
          outline: 3px solid rgba(0, 0, 0, 0.15);
        }
      }
      .metadata-text {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.5rem;
        font-family: inherit;
        font-size: 1rem;
        font-weight: 400;
        opacity: 0.6;
        letter-spacing: 0.02rem;
      }
    }
  }

  .references-wrapper {
    display: flex;
    flex-direction: column;
    align-items: center;
    .header {
      padding-top: 1rem;
      .title {
        font-family: inherit;
        font-size: 1rem;
        font-weight: 400;
        opacity: 0.6;
      }
    }
  }

  .cards-wrapper {
    padding: 0.5rem 0.25rem 1.5rem 0.25rem;
    display: flex;
    justify-content: center;
    width: 100%;
    max-width: 40rem;
    gap: 1rem;
    .card {
      padding: 1rem;
      background: white;
      border: 0.5px solid rgba(0, 0, 0, 0.15);
      border-radius: 8px;
      font-family: inherit;
      font-size: 1.25rem;
      font-weight: 500;
      cursor: pointer;
      transition: 60ms ease-out;
      &:hover {
        outline: 3px solid rgba(0, 0, 0, 0.15);
      }
    }
  }
</style>
