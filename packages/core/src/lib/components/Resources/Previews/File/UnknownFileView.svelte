<script lang="ts">
  import { Icon } from '@horizon/icons'
  import type { Resource } from '../../../../service/resources'
  import {
    generateRandomPastelColor,
    getFileKind,
    getFileType,
    isMac,
    toHumanFileSize
  } from '@horizon/utils'
  import FileIcon from './FileIcon.svelte'
  import { createEventDispatcher, onMount } from 'svelte'

  export let resource: Resource
  export let blob: Blob | undefined = undefined
  export let preview = true

  const dispatch = createEventDispatcher<{ load: void }>()

  const isMacOs = isMac()

  $: name = resource?.metadata?.name || 'Unknown File'
  $: kind = getFileKind(resource.type)
  $: type = getFileType(resource.type)

  const openFile = () => {
    window.api.openResourceLocally({
      id: resource.id,
      metadata: resource.metadata,
      type: resource.type,
      path: resource.path,
      deleted: resource.deleted,
      createdAt: resource.createdAt,
      updatedAt: resource.updatedAt
    })
  }

  onMount(() => {
    dispatch('load')
  })
</script>

<div class="wrapper">
  <div class="background">
    <div
      style="height: 100%; width: 100%; background-color: {generateRandomPastelColor(
        resource.id
      )}; opacity: 0.75;"
    ></div>
  </div>

  <div class="details">
    <div class="icon" style="color: {generateRandomPastelColor(resource.id, 0.2)}">
      <FileIcon {kind} width="35px" height="35px" />
      <!-- <Icon name="file" size="25px" /> -->
    </div>

    {#if !preview}
      <h1 class="title">
        {name || 'Untitled'}
      </h1>

      {#if blob}
        <div class="info">
          <div class="size">
            {toHumanFileSize(blob.size)}
          </div>

          -

          <div class="type">
            {getFileType(resource.type)}
          </div>
        </div>
      {/if}

      <div class="mt-6 flex items-center justify-center">
        <button
          on:click={openFile}
          class="flex items-center gap-2 px-4 py-3 bg-sky-300/60 hover:bg-sky-200 transition-colors duration-200 rounded-xl text-sky-1000 cursor-pointer"
        >
          <Icon name="download" size="22px" />
          {isMacOs ? 'Reveal in System Downloads' : 'Open in File Explorer'}
        </button>
      </div>
    {/if}
  </div>
</div>

<style lang="scss">
  .wrapper {
    position: relative;
    height: 100%;
    min-height: 200px;
    width: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    overflow: hidden;
  }

  .background {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: var(--background);
    z-index: -1;
  }

  .details {
    padding: 1.25rem;
    overflow: hidden;
    border-radius: 0.75rem;
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 0.25rem;
    width: 100%;
    max-width: 800px;
    text-align: center;

    &.row {
      flex-direction: row;
      align-items: center;
      justify-content: space-between;
    }
  }

  .info {
    display: flex;
    align-items: center;
    justify-content: center;
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

  .size,
  .type {
    font-size: 1.2rem;
    color: var(--color-text-muted);
    overflow: hidden;
    font-weight: 500;
  }

  .bottom {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
  }

  .title {
    margin: 0;
    font-size: 1.5rem;
    font-weight: 600;
    letter-spacing: 0.02rem;
    color: #282f4b;
    flex-grow: 1;
    overflow: hidden;
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 1;
  }
</style>
