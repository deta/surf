<script lang="ts">
  import { openDialog } from '@deta/ui'
  import { getResourcePreview, Resource, useResourceManager } from '@deta/services/resources'
  import { contextMenu, type CtxItem } from '@deta/ui'
  import { getFileKind, truncate } from '../../../../../packages/utils/dist'
  import { ResourceTypes } from '@deta/types'
  import ReadOnlyRichText from '@deta/editor/src/lib/components/ReadOnlyRichText.svelte'
  import { DynamicIcon } from '@deta/icons'
  import { onMount } from 'svelte'
  import { useNotebookManager } from '@deta/services/notebooks'
  import { handleResourceClick, openResource } from '../handlers/notebookOpenHandlers'

  // TODO: Decouple this rendering from the Resource?
  let {
    resource,
    resourceId,
    text = false,
    onlyCard = false,
    onDeleteResource
    //title,
    //subtitle,
    //coverImage,
    //faviconImage
  }: {
    resource: Resource
    resourceId?: string
    text?: boolean
    onlyCard?: boolean
    onDeleteResource?: (resource: Resource) => void
    //title?: string
    //subtitle?: string
    //coverImage?: string
    //faviconImage?: string
  } = $props()

  const notebookManager = useNotebookManager()
  const resourceManager = useResourceManager()

  let data = $state(null)
  let _resource = $state(null)
  let faviconUrl = $derived(
    data.url
      ? `https://www.google.com/s2/favicons?domain=${encodeURIComponent(data.url)}&sz=48`
      : null
  )

  const handleClick = (e: MouseEvent) => {
    handleResourceClick(resourceId ?? _resource.id, e)
  }

  const handleDeleteResource = async () => {
    if (_resource) {
      onDeleteResource?.(_resource)
    }
  }

  onMount(async () => {
    if (!resourceId && resource) getResourcePreview(resource, {}).then((v) => (data = v))
    else if (resourceId) {
      resourceManager.getResource(resourceId, { includeAnnotations: false }).then((resource) => {
        _resource = resource
        getResourcePreview(resource, {}).then((v) => (data = v))
      })
    }
  })
</script>

{#if !data}
  <article loading>
    <div class="card">
      <div class="content">
        <div class="cover fallback">
          <DynamicIcon name="file;;document" width="1em" height="1em" />
        </div>
      </div>
    </div>
  </article>
{:else}
  <article
    onclick={handleClick}
    role="none"
    {@attach contextMenu({
      canOpen: true,
      items: [
        {
          type: 'action',
          text: 'Pin',
          icon: 'pin',
          action: () => {}
        },
        {
          type: 'action',
          text: 'View Offline',
          icon: 'save',
          action: () => {
            openResource(resourceId ?? _resource.id, { offline: true, target: 'tab' })
          }
        },
        {
          type: 'action',
          kind: 'danger',
          text: 'Delete',
          icon: 'trash',
          action: handleDeleteResource
        }
      ]
    })}
    data-resource-id={_resource.id}
  >
    <div class="card">
      <div class="content">
        {#if data.image}
          <img
            class="cover"
            src={data.image}
            alt={data?.title || data?.metadata?.text}
            decoding="async"
            loading="eager"
            ondragstart={(e) => e.preventDefault()}
          />
        {:else if _resource.type === ResourceTypes.DOCUMENT_SPACE_NOTE}
          <ReadOnlyRichText content={truncate(data.content, 2000)} />
        {:else}
          <div class="cover fallback">
            <DynamicIcon name={`file;;${getFileKind(_resource.type)}`} width="1em" height="1em" />
          </div>
        {/if}

        {#if faviconUrl && faviconUrl.length > 0}
          <div class="favicon">
            <img src={faviconUrl} alt="" />
          </div>
        {/if}
      </div>
    </div>

    {#if !onlyCard}
      {#if text || data.title || data.metadata?.sourceURI}
        <div class="metadata">
          {#if data.title && data.title.length > 0}
            <span class="title typo-title-sm">{data.title}</span>
          {:else if data.metadata?.text}
            <span class="subtitle typo-title-sm" style="opacity: 0.3;">{data.metadata.text}</span>
          {/if}
          {#if data.url}
            <span class="subtitle typo-title-sm" style="opacity: 0.3;"
              >{new URL(data.url)?.host}</span
            >
          {:else if data.metadata?.text}
            <span class="subtitle typo-title-sm" style="opacity: 0.3;">{data.metadata.text}</span>
          {/if}
        </div>
      {/if}
    {/if}
  </article>
{/if}

<style lang="scss">
  article[loading] {
    @keyframes breath {
      0% {
        opacity: 0.15;
      }
      50% {
        opacity: 0.75;
      }
      100% {
        opacity: 0.15;
      }
    }
    .cover.fallback {
      opacity: 0.15;
      animation: breath 2s ease-in-out infinite;
    }
  }
  article {
    display: flex;
    gap: 1rem;
    align-items: center;
    perspective: 200px;
    max-width: var(--max-width, inherit);

    .card {
      flex-shrink: 0;
      --padding: 4px;
      --corner-radius: 16px;

      padding: var(--padding);
      background: #fff;
      outline: 1px solid rgba(0, 0, 0, 0.075);
      border-radius: var(--corner-radius);

      width: var(--width, 100%);
      aspect-ratio: 3.1 / 4;
      //height: var(--height, auto);
      content-visibility: auto;

      box-shadow: rgba(99, 99, 99, 0.15) 0px 2px 8px 0px;

      transition:
        transform 123ms ease-out,
        box-shadow 123ms ease-out;

      > .content {
        position: relative;
        border-radius: calc(var(--corner-radius) - var(--padding));
        overflow: hidden;
        height: 100%;
        background: rgba(0, 0, 0, 0.03);

        .cover {
          position: absolute;
          inset: 0;
          z-index: 0;
          height: 100%;
          object-fit: cover;

          &.fallback {
            display: flex;
            justify-content: center;
            align-items: center;
            font-size: 1.15rem;
            color: rgba(0, 0, 0, 0.25);
          }
        }
        .favicon {
          position: absolute;
          bottom: 0;
          right: 0;
          background: white;
          width: 1.6rem;
          aspect-ratio: 1 / 1;
          //padding: calc(var(--padding) - 2px);

          padding-top: calc(var(--padding) + 0.5px);
          padding-left: calc(var(--padding) + 0.5px);

          border-top-left-radius: 11px;

          overflow: hidden;
          > img {
            border-radius: 6px;
            width: 100%;
            height: 100%;
          }
        }
      }
    }

    .metadata {
      display: flex;
      flex-direction: column;
      transition: opacity 123ms ease-out;
      overflow: hidden;

      .title {
        text-wrap: pretty;
        overflow: hidden;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
      }
    }

    &:hover {
      .card {
        transform: scale(1.025) rotate3d(1, 2, 4, 1.5deg);
        // NOTE: We shouldnt animate this succer, use ::pseudo element and just animate its opacity instead
        box-shadow: rgba(99, 99, 99, 0.2) 0px 4px 12px 0px;
      }
      .metadata {
        opacity: 0.5;
      }
    }
    &:active {
      .card {
        transform: scale(0.98) rotate3d(1, 2, 4, 1.5deg);
        // NOTE: We shouldnt animate this succer, use ::pseudo element and just animate its opacity instead

        box-shadow: rgba(99, 99, 99, 0.07) 0px 4px 12px 0px;
      }
    }
  }
</style>
