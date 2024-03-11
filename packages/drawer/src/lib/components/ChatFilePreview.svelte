<script lang="ts">
  import { createEventDispatcher } from 'svelte'
  import { Icon } from '@horizon/icons'
  import ImageView from '@horizon/core/src/lib/components/Cards/File/ImageView.svelte'
  import { type WebMetadata } from '@horizon/web-parser'
  export let metadata: any
  export let data: any

  const dispatch = createEventDispatcher()

  $: console.log('metadata', metadata)
  $: console.log('data', data)

  // Function to generate a random rotation between -0.6 and 0.6 degrees
  const generateRandomRotation = () => -0.6 + Math.random() * (0.6 - -0.6)

  // Reactive statement to generate a random rotation each time the component is instantiated
  $: randomRotation = generateRandomRotation()

  const handleRemove = () => {
    console.log(metadata)
    dispatch('remove', metadata.sourceURI)
  }
</script>

<!-- svelte-ignore a11y-no-static-element-interactions a11y-click-events-have-key-events -->
{#if data.type === 'image/png' || data.type === 'image/jpeg' || data.type === 'image/svg' || data.type === 'image/webp'}
  <div class="image-wrapper" style="transform: rotate({randomRotation}deg);">
    <div class="file-metadata-wrapper">
      <div class="preview">
        <ImageView blob={data} />
      </div>
    </div>
    <div class="remove" on:click={handleRemove}>
      <Icon name="close" color="#AAA7B1" />
    </div>
  </div>
{:else}
  <div class="file-wrapper" style="transform: rotate({randomRotation}deg);">
    <div class="file-metadata-wrapper">
      <div class="details">
        <div class="title">
          {metadata.name ? metadata.name : `Cannot resolve filename from type ${data.type}`}
        </div>
        {#if metadata.path}<div class="subtitle">{metadata.path}</div>{/if}
      </div>
    </div>
    <div class="remove" on:click={handleRemove}>
      <Icon name="close" color="#AAA7B1" />
    </div>
  </div>
{/if}

<style lang="scss">
  .file-wrapper,
  .image-wrapper {
    display: flex;
    align-items: center;
    padding: 0.5rem 0.75rem;
    overflow: hidden;

    .file-metadata-wrapper {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      flex-grow: 1;
      flex-shrink: 1;
      flex-basis: auto;
      overflow: hidden;
      .preview {
        margin: 0.25rem;
        width: 128px;
        background: white;
        height: 128px;
        flex-shrink: 0;
        border-radius: 5.1px;
        border: 0.5px solid rgba(0, 0, 0, 0.15);
        box-shadow:
          0px 0.425px 0px 0px rgba(65, 58, 86, 0.25),
          0px 0px 0.85px 0px rgba(0, 0, 0, 0.25);
      }
      .details {
        flex-grow: 1;
        flex-shrink: 1;
        flex-basis: auto;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        margin-right: 0.5rem;
        // Adding a max-width can also help control the width explicitly
        max-width: calc(100% - 3rem);
        .title,
        .subtitle {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
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
  }

  .file-wrapper {
    .remove {
      flex-shrink: 0;
      margin-left: 0.5rem;
    }
  }

  .image-wrapper {
    position: relative;
    display: inline-block;
    width: fit-content;
    &:hover {
      .remove {
        opacity: 1;
      }
    }
    .remove {
      position: absolute;
      display: flex;
      justify-content: center;
      align-items: center;
      width: 2rem;
      height: 2rem;
      top: 0;
      right: 0;
      opacity: 0;
      flex-shrink: 0;
      margin-left: 0.5rem;
      background: white;
      border-radius: 50%;
      border: 0.5px solid rgba(0, 0, 0, 0.15);
      cursor: default;
    }
  }
</style>
