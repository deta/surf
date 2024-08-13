<script lang="ts">
  import { type Resource, useResourceManager } from '../../service/resources'
  import { useLogScope } from '../../utils/log'
  import { generateRootDomain, parseStringIntoUrl } from '../../utils/url'
  import { formatDistanceToNow, parseISO } from 'date-fns'
  import autosize from 'svelte-autosize'

  import Link from '../Atoms/Link.svelte'
  import {
    CreateTabEventTrigger,
    ResourceTagsBuiltInKeys,
    type SFFSResourceTag
  } from '@horizon/types'
  import { Icon } from '@horizon/icons'
  import { tooltip } from '../../utils/directives'
  import { useToasts } from '../../service/toast'
  import { createEventDispatcher } from 'svelte'
  import type { BrowserTabNewTabEvent } from '../Browser/BrowserTab.svelte'

  const log = useLogScope('OasisResourceDetails')

  export let draggable = true
  export let resource: Resource

  const resourceManager = useResourceManager()
  const toasts = useToasts()
  const dispatch = createEventDispatcher<{ 'new-tab': BrowserTabNewTabEvent; 'open-url': string }>()

  let userContext = resource.metadata?.userContext
  let showAddTag = false
  let newTagValue = ''
  let localTags: SFFSResourceTag[] = []
  let blockAdd = false
  let showSource = false

  let textareaRef: HTMLTextAreaElement

  $: viewedByUser =
    resource?.tags?.find((tag) => tag.name === ResourceTagsBuiltInKeys.VIEWED_BY_USER)?.value ===
    'true'
  $: hashtags = [
    ...(resource?.tags
      ?.filter((tag) => tag.name === ResourceTagsBuiltInKeys.HASHTAG)
      ?.map((tag) => tag.value) ?? []),
    ...localTags.map((tag) => tag.value)
  ]

  $: {
    resourceManager.updateResourceMetadata(resource.id, { userContext })
  }

  $: sourceURL = parseStringIntoUrl(resource.metadata?.sourceURI ?? '')
  $: canonicalURL = parseStringIntoUrl(
    resource?.tags?.find((tag) => tag.name === ResourceTagsBuiltInKeys.CANONICAL_URL)?.value ?? ''
  )

  function formatRelativeDate(dateIsoString: string) {
    return formatDistanceToNow(parseISO(dateIsoString), { addSuffix: true })
  }

  const handleUnView = async () => {
    resource.tags = (resource.tags ?? []).map((tag) => {
      if (tag.name === ResourceTagsBuiltInKeys.VIEWED_BY_USER) {
        tag.value = 'false'
      }
      return tag
    })

    await resourceManager.updateResourceTag(
      resource.id,
      ResourceTagsBuiltInKeys.VIEWED_BY_USER,
      'false'
    )
    toasts.success('Resource unmarked as viewed')
  }

  const addNewTag = async () => {
    if (newTagValue === '') {
      showAddTag = false
      return
    }

    if (blockAdd) {
      return
    }

    blockAdd = true

    // clean out hashtags
    const cleanValue = newTagValue.replace(/[^a-zA-Z0-9]/g, '')

    const newTag = {
      name: ResourceTagsBuiltInKeys.HASHTAG,
      value: cleanValue
    }

    localTags = [...localTags, newTag]
    await resourceManager.createResourceTag(resource.id, newTag.name, newTag.value)

    newTagValue = ''
    showAddTag = false

    setTimeout(() => {
      blockAdd = false
    }, 1000)
  }

  const handleNewTagKeyDown = async (event: KeyboardEvent) => {
    if (event.key === 'Enter') {
      await addNewTag()
    }
  }

  const handleOpenURL = (e: MouseEvent) => {
    e.preventDefault()
    dispatch('new-tab', {
      url: canonicalURL!.href,
      active: true,
      trigger: CreateTabEventTrigger.OasisItem
    })
  }

  const handleOpenSource = (e: MouseEvent) => {
    e.preventDefault()
    showSource = true
    dispatch('open-url', sourceURL!.href)
  }

  const handleOpenCanonical = (e: MouseEvent) => {
    e.preventDefault()
    showSource = false
    dispatch('open-url', canonicalURL!.href)
  }
</script>

<!-- svelte-ignore missing-declaration a11y-no-static-element-interactions -->
<div class="details-item">
  <div {draggable} on:dragstart class="details-preview">
    <slot />
  </div>

  <!-- {#if canonicalURL}
    <div class="source">
      <div class="source-button" use:tooltip={'Open Source in New Tab (⌘+Enter)'}>
        <Link
          url={canonicalURL.href}
          label="Open as New Tab"
          locked={true}
          on:click={handleOpenURL}
        />
      </div>
    </div>
  {/if} -->

  {#if sourceURL && sourceURL.hostname === 'news.ycombinator.com' && canonicalURL}
    <div class="source">
      <div class="source-button">
        {#if showSource}
          <Link url={canonicalURL.href} locked={true} hideArrow on:click={handleOpenCanonical}>
            <div class="flex items-center gap-2">
              <img
                class="favicon"
                src={`https://www.google.com/s2/favicons?domain=${canonicalURL.href}&sz=48`}
                alt={`favicon`}
                loading="lazy"
              />
              <p>View Posted Link</p>
            </div>
          </Link>
        {:else}
          <Link url={sourceURL.href} locked={true} hideArrow on:click={handleOpenSource}>
            <div class="flex items-center gap-2">
              <img
                class="favicon"
                src={`https://www.google.com/s2/favicons?domain=${sourceURL.href}&sz=48`}
                alt={`favicon`}
                loading="lazy"
              />
              <p>View Hacker News Post</p>
            </div>
          </Link>
        {/if}
      </div>
    </div>
  {:else if canonicalURL}
    <div class="source">
      <div class="source-button" use:tooltip={'Open Source in New Tab (⌘+Enter)'}>
        <Link
          url={canonicalURL.href}
          label="Open as New Tab"
          locked={true}
          on:click={handleOpenURL}
        />
      </div>
    </div>
  {/if}

  <div class="tags-wrapper">
    <div class="tags">
      {#if viewedByUser}
        <!-- svelte-ignore a11y-click-events-have-key-events -->
        <div class="tag" use:tooltip={'Click to unview'} on:click={handleUnView}>
          <Icon name="eye" />
          Viewed
        </div>
      {:else}
        <div class="tag unread" use:tooltip={"Hasn't been viewed"}>
          <Icon name="news" />
          Unread
        </div>
      {/if}

      {#if hashtags.length > 0}
        {#each hashtags as hashtag, idx (hashtag + idx)}
          <div class="tag hashtag">
            <Icon name="hash" />
            {hashtag}
          </div>
        {/each}
      {/if}

      {#if showAddTag}
        <div class="new-tag">
          <input
            placeholder="new tag"
            autofocus
            bind:value={newTagValue}
            on:blur={() => addNewTag()}
            on:keydown={handleNewTagKeyDown}
          />
        </div>
      {:else}
        <!-- svelte-ignore a11y-click-events-have-key-events -->
        <div class="new-tag-btn" on:click={() => (showAddTag = true)}>
          <Icon name="add" />
          Add Tag
        </div>
      {/if}
    </div>
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
    <div class="metadata">
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
    gap: 0;
    width: 100%;
    max-height: 100%;
    height: min-content;
    overflow-y: auto;
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

  .source {
    width: 100%;
    margin-top: -2rem;
    margin-bottom: 2rem;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 1rem 4rem;

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

  .favicon {
    width: 1.25rem;
    height: 1.25rem;
    border-radius: 4px;
    box-shadow:
      0px 0.425px 0px 0px rgba(65, 58, 86, 0.25),
      0px 0px 0.85px 0px rgba(0, 0, 0, 0.25);
  }

  .tags-wrapper {
    width: 100%;
    display: flex;
    gap: 1rem;
    padding: 1rem 4rem;
    border-top: 0.5px solid rgba(0, 0, 0, 0.15);

    .tags {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      flex-wrap: wrap;

      .tag {
        padding: 0.5rem 1rem;
        border-radius: 12px;
        background: #f0f0f0;
        color: #666;
        display: flex;
        align-items: center;
        gap: 0.25rem;
        cursor: pointer;
      }

      .hashtag {
        background: #f0f0f0;
        color: #666;
      }

      .unread {
        background: #f73b95;
        color: white;
      }

      .new-tag-btn {
        display: flex;
        align-items: center;
        gap: 0.25rem;
        padding: 0.5rem 1rem;
        border-radius: 12px;
        color: #666;
        cursor: pointer;
        transition: 240ms ease-out;

        &:hover {
          background: #e0e0e0;
        }
      }

      .new-tag {
        input {
          padding: 0.5rem 1rem;
          border-radius: 12px;
          border: 0.5px solid #ccc;
          font-family: inherit;
          font-size: 1rem;
          font-weight: 400;
          outline: none;
          transition: 240ms ease-out;
          width: 135px;
          &:focus {
            border: 0.5px solid #666;
          }
        }
      }
    }
  }
</style>
