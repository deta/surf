<script lang="ts">
  import { getResourcePreview, Resource, isGeneratedResource } from '@deta/services/resources'
  import { ResourceTypes } from '@deta/types'
  import ReadOnlyRichText from '@deta/editor/src/lib/components/ReadOnlyRichText.svelte'
  import { DynamicIcon, Icon } from '@deta/icons'
  import { onMount } from 'svelte'
  import { getFileType, getFileKind, truncate } from '@deta/utils'

  // TODO: Decouple this rendering from the Resource?
  let {
    resource,
    sourceNotebookId,
    text = false,
    onlyCard = false,
    showSaved = false,
    interactive = true,
    permanentlyTilted = false,
    onDeleteResource,
    onclick,
    ...props
    //title,
    //subtitle,
    //coverImage,
    //faviconImage
  }: {
    resource: Resource
    sourceNotebookId?: string
    text?: boolean
    onlyCard?: boolean
    showSaved?: boolean
    interactive?: boolean
    permanentlyTilted?: boolean
    onDeleteResource?: (resource: Resource) => void
    onclick?: (e: MouseEvent) => void
    //title?: string
    //subtitle?: string
    //coverImage?: string
    //faviconImage?: string
  } = $props()

  let data = $state(null)
  let faviconUrl = $derived(
    data.source.imageUrl || data.url
      ? `https://www.google.com/s2/favicons?domain=${encodeURIComponent(data.url)}&sz=48`
      : null
  )
  let imageError = $state(false)
  let faviconError = $state(false)

  const handleClick = (e: MouseEvent) => {
    onclick?.(e)
  }

  const handleAuxClick = (e: MouseEvent) => {
    if (e.button !== 1) return
    handleClick(e)
  }

  const handleImageError = () => {
    imageError = true
  }

  const handleFaviconError = () => {
    faviconError = true
  }

  onMount(async () => {
    getResourcePreview(resource, {}).then((v) => (data = v))
  })
</script>

<svelte:boundary>
  {#snippet failed(error, reset)}
    {console.error(error)}
    failed
    <article
      role="none"
      data-resource-id={resource.id}
      class:interactive
      class:permanently-tilted={permanentlyTilted}
    >
      <div class="card">
        <div class="content">
          {#if data.image && !imageError}
            <img
              class="cover"
              src={data.image}
              alt={data?.title || data?.metadata?.text}
              decoding="async"
              loading="eager"
              ondragstart={(e) => e.preventDefault()}
              onerror={handleImageError}
            />
          {:else if resource.type === ResourceTypes.DOCUMENT_SPACE_NOTE}
            <ReadOnlyRichText content={truncate(data.content, 2000)} />
          {:else if data.source.icon}
            <div class="cover fallback">
              <DynamicIcon name={data.source.icon} width="1em" height="1em" />
            </div>
          {:else}
            <div class="cover fallback">
              <DynamicIcon name={`file;;${getFileKind(resource.type)}`} width="1em" height="1em" />
            </div>
          {/if}
        </div>
      </div>
    </article>
  {/snippet}

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
      onauxclick={handleAuxClick}
      role="none"
      data-resource-id={resource.id}
      {...props}
    >
      <div class="card">
        <div class="content">
          {#if data.image && !imageError}
            <img
              class="cover"
              src={data.image}
              alt={data?.title || data?.metadata?.text}
              decoding="async"
              loading="eager"
              ondragstart={(e) => e.preventDefault()}
              onerror={handleImageError}
            />
          {:else if resource.type === ResourceTypes.DOCUMENT_SPACE_NOTE}
            <ReadOnlyRichText content={truncate(data.content, 2000)} />
          {:else if data.source.icon}
            <div class="cover fallback">
              <DynamicIcon name={data.source.icon} width="1em" height="1em" />
            </div>
          {:else if faviconUrl && !faviconError}
            <img
              class="cover"
              src={faviconUrl}
              alt={data?.title || data?.metadata?.text}
              decoding="async"
              loading="eager"
              ondragstart={(e) => e.preventDefault()}
              onerror={handleFaviconError}
            />
          {/if}

          <!--
          {#if faviconUrl && faviconUrl.length > 0}
            <div class="favicon">
            </div>
          {/if}
          -->
        </div>
      </div>

      {#if !onlyCard}
        {#if text || data.title || data.metadata?.sourceURI || data.source}
          <div class="metadata">
            {#if data.title && data.title.length > 0}
              <span class="title typo-title-sm">{data.title}</span>
            {:else if data.metadata?.text}
              <span class="subtitle typo-title-sm" style="opacity: 0.3;">{data.metadata.text}</span>
            {:else if data.content}
              <span class="title typo-title-sm">{data.content}</span>
            {:else if data.source.text}
              <span class="title typo-title-sm">{data.source.text}</span>
            {/if}

            {#if isGeneratedResource(resource)}
              <span class="subtitle typo-title-sm" style="opacity: 0.3;">Surflet</span>
            {:else if data.url}
              <span class="subtitle typo-title-sm" style="opacity: 0.3;"
                >{new URL(data.url)?.host}</span
              >
            {:else if data.metadata?.text}
              <span class="subtitle typo-title-sm" style="opacity: 0.3;">{data.metadata.text}</span>
            {:else if resource}
              <span class="subtitle typo-title-sm" style="opacity: 0.3;"
                >{getFileType(resource.type)}</span
              >
            {/if}

            {#if showSaved}
              <div class="saved-info">
                <Icon name="check" size="17px" color="rgb(6, 158, 54)" />
                <span class="subtitle typo-title-sm">Added to Surf</span>
              </div>
            {/if}
          </div>
        {/if}
      {/if}
    </article>
  {/if}
</svelte:boundary>

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
    padding: 0.5em 0.5em;

    .card {
      flex-shrink: 0;
      --padding: 4px;
      --corner-radius: 6px;

      padding: var(--padding);
      background: light-dark(#fff, #1a2438);
      outline: 1px solid light-dark(rgba(0, 0, 0, 0.075), rgba(71, 85, 105, 0.3));
      border-radius: var(--corner-radius);

      width: var(--width, 100%);
      height: var(--height, auto);
      aspect-ratio: 3.1 / 4;
      content-visibility: auto;

      box-shadow: light-dark(rgba(99, 99, 99, 0.15), rgba(0, 0, 0, 0.3)) 0px 2px 8px 0px;

      transition:
        transform 123ms ease-out,
        box-shadow 123ms ease-out;

      > .content {
        position: relative;
        border-radius: calc(var(--corner-radius) - var(--padding));
        overflow: hidden;
        height: 100%;
        background: light-dark(rgba(0, 0, 0, 0.03), rgba(255, 255, 255, 0.05));

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
            color: light-dark(rgba(0, 0, 0, 0.25), rgba(255, 255, 255, 0.25));
          }
        }
        .favicon {
          position: absolute;
          bottom: 0;
          right: 0;
          background: light-dark(white, #283549);
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
        opacity: 0.7;
        color: light-dark(rgba(0, 0, 0, 0.9), rgba(255, 255, 255, 0.9));
      }

      .subtitle {
        color: light-dark(rgba(0, 0, 0, 0.5), rgba(255, 255, 255, 0.5));
      }
    }

    &.interactive:hover,
    &:global([data-context-menu-anchor]) {
      .card {
        transform: scale(1.025) rotate3d(1, 2, 4, 1.5deg);
        // NOTE: We shouldnt animate this succer, use ::pseudo element and just animate its opacity instead
        box-shadow: light-dark(rgba(99, 99, 99, 0.2), rgba(0, 0, 0, 0.4)) 0px 4px 12px 0px;
      }
      .metadata {
        opacity: 0.5;
      }
    }

    &:hover,
    &.permanently-tilted {
      .card {
        transform: scale(1.025) rotate3d(1, 2, 4, 1.5deg);
      }
    }

    &.interactive:active {
      .card {
        transform: scale(0.98) rotate3d(1, 2, 4, 1.5deg);
        // NOTE: We shouldnt animate this succer, use ::pseudo element and just animate its opacity instead

        box-shadow: light-dark(rgba(99, 99, 99, 0.07), rgba(0, 0, 0, 0.2)) 0px 4px 12px 0px;
      }
    }
  }

  .saved-info {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    font-size: 0.8rem;
    color: light-dark(rgba(0, 0, 0, 0.5), rgba(255, 255, 255, 0.5));
    margin-top: 0.3rem;
  }
</style>
