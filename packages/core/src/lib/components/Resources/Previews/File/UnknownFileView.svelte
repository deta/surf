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

<div class="wrapper" style:--background={generateRandomPastelColor(resource.id)}>
  <div class="details">
    <div class="icon" style="color: {generateRandomPastelColor(resource.id, 0.2)}">
      <FileIcon {kind} width="3em" height="3em" />
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
          class="flex items-center gap-2 px-4 py-3 bg-sky-300/60 hover:bg-sky-200 transition-colors duration-200 rounded-xl text-sky-1000"
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
    min-height: 14em;
    width: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    overflow: hidden;

    &::before {
      content: '';
      position: absolute;
      z-index: 2;
      inset: 0;
      background: var(--background);
      opacity: 0.35;
    }
  }

  .details {
    position: relative;
    z-index: 2;
    padding: 1.25em;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 0.25em;
    width: 100%;
    max-width: 800px;
    text-align: center;
  }

  .info {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5em;
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
    font-size: 1.2em;
    color: var(--color-text-muted);
    overflow: hidden;
    font-weight: 500;
  }

  .title {
    margin: 0;
    font-size: 1.5em;
    font-weight: 600;
    letter-spacing: 0.02em;
    color: #282f4b;
    flex-grow: 1;
    overflow: hidden;
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 1;
  }
</style>
