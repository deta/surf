<script lang="ts">
  import { Icon } from '@horizon/icons'
  import type { Resource } from '../../../service/resources'
  import { getFileKind, getFileType, toHumanFileSize } from '../../../utils/files'
  import FileIcon from './FileIcon.svelte'

  export let resource: Resource
  export let blob: Blob
  export let hideType = false

  $: name = resource?.metadata?.name
  $: kind = getFileKind(blob.type)
  $: type = getFileType(blob.type)

  // const openFile = () => {
  //     window.open(`file://${resource.path}`, "_blank")
  // }
</script>

<div class="wrapper">
  <!-- <div class="background">
        <div style="height: 100%; width: 100%; background-color: {generateRandomPastelColor(resource.id)}; opacity: 0.5;"></div>
    </div> -->

  <div class="details" class:row={hideType}>
    <h1 class="title">
      {name || 'Untitled'}
    </h1>

    <div class="bottom">
      {#if !hideType}
        <div class="type-info">
          <div class="icon">
            <FileIcon {kind} width="25px" height="25px" />
            <!-- <Icon name="file" size="25px" /> -->
          </div>

          <div class="type">
            {type}
          </div>
        </div>
      {/if}

      <div class="info">
        <div class="size">
          {toHumanFileSize(blob.size)}
        </div>

        <!-- <button on:click={openFile} class="action">
                    Open
                </button> -->
      </div>
    </div>
  </div>
</div>

<style lang="scss">
  .wrapper {
    position: relative;
    height: 100%;
    width: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    cursor: pointer;
  }

  // .background {
  //     position: absolute;
  //     top: 0;
  //     left: 0;
  //     right: 0;
  //     bottom: 0;
  //     background: var(--background);
  //     z-index: -1;
  // }

  .details {
    padding: 1.25rem;
    overflow: hidden;
    border-radius: 0.75rem;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    width: 100%;
    max-width: 800px;

    &.row {
      flex-direction: row;
      align-items: center;
      justify-content: space-between;
    }
  }

  .info {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .type-info {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    overflow: hidden;
    color: var(--color-text-muted);
  }

  .icon {
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 5px;
    overflow: hidden;
    flex-shrink: 0;
  }

  .type {
    margin: 0;
    font-size: 1rem;
    color: var(--color-text-muted);
    font-weight: 500;
  }

  .size {
    font-size: 1rem;
    color: var(--color-text-muted);
    overflow: hidden;
    font-weight: 500;
  }

  .bottom {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: space-between;
    overflow: hidden;
  }

  .title {
    margin: 0;
    font-size: 1.2rem;
    font-weight: 500;
    letter-spacing: 0.02rem;
    color: var(--color-text);
    flex-grow: 1;
    overflow: hidden;
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 1;
  }

  // .action {
  //     appearance: none;
  //     background: none;
  //     outline: none;
  //     border: none;
  //     padding: 0.5rem 1rem;
  //     border-radius: 0.5rem;
  //     background: var(--background-menu-muted);
  //     color: var(--color-menu);
  //     font-size: 1rem;
  //     font-weight: 500;
  //     cursor: pointer;
  //     margin: 0;
  // }
</style>
