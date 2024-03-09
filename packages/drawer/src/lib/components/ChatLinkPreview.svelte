<script lang="ts">
  import { createEventDispatcher } from 'svelte'
  import { Icon } from '@horizon/icons'

  import { type WebMetadata } from '@horizon/web-parser'
  export let metadata: WebMetadata

  const dispatch = createEventDispatcher()
  let nodeRef: HTMLElement

  const handleRemove = () => {
    nodeRef.parentNode?.removeChild(nodeRef)
  }
</script>

<!-- svelte-ignore a11y-no-static-element-interactions a11y-click-events-have-key-events -->
<div class="link-wrapper" bind:this={nodeRef}>
  <div class="link-metadata-wrapper">
    {#if metadata.image}
      <img
        class="preview"
        src={metadata.image}
        alt={metadata.description}
        width="35px"
        height="35px"
      />
    {/if}
    <div class="details">
      <div class="title">
        {metadata.title ? metadata.title : `Link added from  ${metadata.provider}`}
      </div>
      {#if metadata.description}<div class="subtitle">{metadata.description}</div>{/if}
    </div>
  </div>
  <div class="remove" on:click={handleRemove}>
    <Icon name="close" color="#AAA7B1" />
  </div>
</div>

<style lang="scss">
  .link-wrapper {
    display: flex;
    align-items: center;
    padding: 0.5rem 0.75rem;
    overflow: hidden;

    .link-metadata-wrapper {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      flex-grow: 1;
      flex-shrink: 1;
      flex-basis: auto;
      overflow: hidden;
      .preview {
        flex-shrink: 0;
        border-radius: 5.1px;
        box-shadow:
          0px 0.425px 0px 0px rgba(65, 58, 86, 0.25),
          0px 0px 0.85px 0px rgba(0, 0, 0, 0.25);
      }
      .details {
        flex-grow: 1;
        flex-shrink: 1;
        flex-basis: auto; // Change this to 'auto' or a specific value that represents the base width
        min-width: 0; // This can help prevent overflow issues in some cases
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        margin-right: 0.5rem;
        // Adding a max-width can also help control the width explicitly
        max-width: calc(100% - 3rem);
        .title,
        .subtitle {
          overflow: hidden; // Ensure text overflow is handled
          text-overflow: ellipsis; // Use ellipsis for text that overflows its box
          white-space: nowrap; // Keep the text on a single line to ensure ellipsis works
        }

        .title {
          overflow: hidden;
          color: #281b53;
          letter-spacing: 0.02rem;
          font-feature-settings:
            'clig' off,
            'liga' off;
          text-overflow: ellipsis;
          text-shadow: 0px 6.8px 20.4px rgba(0, 0, 0, 0.12);
          font-size: 1rem;
          font-style: normal;
          font-weight: 600;
          letter-spacing: -0.068px;
        }

        .subtitle {
          overflow: hidden;
          color: #4d4b4d;
          font-feature-settings:
            'clig' off,
            'liga' off;
          text-overflow: ellipsis;
          white-space: nowrap;
          text-shadow: 0px 6.8px 20.4px rgba(0, 0, 0, 0.12);
          font-size: 0.85rem;
          font-style: normal;
          font-weight: 510;
          letter-spacing: -0.068px;
          opacity: 0.6;
        }
      }
    }

    .remove {
      flex-shrink: 0;
      margin-left: 0.5rem;
    }
  }
</style>
