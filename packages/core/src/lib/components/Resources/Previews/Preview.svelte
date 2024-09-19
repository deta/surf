<script lang="ts" context="module">
  export type Source = {
    text: string
    imageUrl?: string
  }

  export type Author = {
    text: string
    imageUrl?: string
  }
</script>

<script lang="ts">
  import { useLogScope } from '@horizon/utils'
  import type { Resource } from '@horizon/core/src/lib/service/resources'
  import Link from '../../Atoms/Link.svelte'

  export let resource: Resource

  export let title: string
  export let image: string
  export let content: string
  export let url: string
  export let source: Source
  export let author: Author | undefined
  export let theme: [string, string] | undefined

  export let mode: 'full' | 'media' | 'content' | 'compact' | 'tiny' = 'full'

  const log = useLogScope('PostPreview')

  let error = ''

  const MAX_TITLE_LENGTH = 300

  const truncate = (text: string, length: number) => {
    return text.length > length ? text.slice(0, length) + '...' : text
  }
</script>

<div
  class="preview"
  class:themed={!!theme}
  style="--color1: {theme && theme[0]}; --color2: {theme && theme[1]}"
>
  <div class="preview-card">
    <div class="inner">
      {#if error}
        <div class="title">{error}</div>
        <div class="subtitle">{url}</div>
      {:else}
        {#if image}
          <div class="image">
            <img src={image} alt={title} />
          </div>
        {/if}

        <div class="details">
          <div class="source">
            <img class="favicon" src={source.imageUrl} alt={source.text} />

            <div class="from">
              {source.text}
            </div>
          </div>

          <div class="title">
            {title}
          </div>

          {#if content}
            <div class="content">
              {content}
            </div>
          {/if}

          <div class="metadata">
            {#if author}
              <div class="author">
                {#if author.imageUrl}
                  <img class="favicon" src={author.imageUrl} alt={author.text} />
                {/if}

                <div class="from">
                  {author.text}
                </div>
              </div>
            {/if}

            <!-- {#if author}
              <div class="author">
                {#if author.imageUrl}
                  <img
                    class="favicon"
                    src={author.imageUrl}
                    alt={author.text}
                  />
                {/if}

                <div class="from">
                  {author.text}
                </div>
              </div>
            {/if} -->
          </div>
        </div>
      {/if}
    </div>
  </div>
</div>

<style lang="scss">
  .preview {
    width: 100%;
    border-radius: 16px;
    border: 1px solid rgba(228, 228, 228, 0.75);
    box-shadow:
      0px 1px 0px 0px rgba(65, 58, 86, 0.25),
      0px 0px 1px 0px rgba(0, 0, 0, 0.25);
    background: rgba(255, 255, 255, 0.75);
    transition: 60ms ease-out;
    position: relative;

    &:hover {
      outline: 3px solid rgba(0, 0, 0, 0.15);
    }

    &.themed {
      border: 1px solid rgba(255, 255, 255, 0.2);
      background: radial-gradient(100% 100% at 50% 0%, var(--color1) 0%, var(--color2) 100%);
    }
  }

  .preview-card {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 0.65rem;
    color: inherit;
    text-decoration: none;
    user-select: none;
    -webkit-user-drag: none;

    &.loading {
      padding: 0 !important;
    }
  }

  .inner {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    width: 100%;
    flex-shrink: 1;
    flex-grow: 1;
  }

  .details {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    width: 100%;
    flex-shrink: 1;
    flex-grow: 1;
    padding: 1rem;
  }

  .themed {
    .title,
    .content,
    .source > .from,
    .author > .from {
      color: #ffffff;
      opacity: 1;
    }
  }

  .favicon {
    width: 1.25rem;
    height: 1.25rem;
    border-radius: 5.1px;
    box-shadow:
      0px 0.425px 0px 0px rgba(65, 58, 86, 0.25),
      0px 0px 0.85px 0px rgba(0, 0, 0, 0.25);
  }

  .source .favicon {
    width: 1.35rem;
    height: 1.35rem;
  }

  .source,
  .author {
    display: flex;
    align-items: center;
    gap: 0.5rem;

    .from {
      font-size: 1rem;
      font-weight: 500;
      text-decoration: none;
      color: #281b53;
      opacity: 0.65;
    }
  }

  .author .from {
    font-size: 0.85rem;
  }

  .image {
    width: 100%;
    position: relative;
    overflow: hidden;
    margin-bottom: -1rem;
    border-radius: 0.5rem;
    box-shadow:
      0px 0.425px 0px 0px rgba(65, 58, 86, 0.25),
      0px 0px 0.85px 0px rgba(0, 0, 0, 0.25);

    img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
  }

  .title {
    font-size: 1.25rem;
    line-height: 1.775rem;
    letter-spacing: 0.02rem;
    color: #281b53;
    font-weight: 500;
    flex-shrink: 0;
  }

  .content {
    font-size: 1rem;
    line-height: 1.5rem;
    color: #281b53;
    letter-spacing: 0.02rem;
    font-weight: 400;
    flex-shrink: 0;
    max-width: 95%;
    overflow-wrap: break-word;
    hyphens: auto;
  }

  .metadata {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
  }
</style>
