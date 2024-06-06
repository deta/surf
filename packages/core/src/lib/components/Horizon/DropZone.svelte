<script lang="ts">
  import { writable } from 'svelte/store'
  import { processDrop, processFile, type MediaParserResult } from '../../service/mediaImporter'
  import { Icon } from '@horizon/icons'
  import { DrawerChat, AlreadyDroppedTooltip } from '@horizon/drawer'
  import { fly } from 'svelte/transition'

  export let horizon
  export let resourceManager

  const droppedInputElements = writable<MediaParserResult[]>([])
  const showDropZone = writable(false)
  const alreadyDropped = writable(false)
  const isSaving = writable(false)

  let receivedDrop = false
  let dragCount = 0

  const handleDropForwarded = async (e: any) => {
    const event = e.detail
    const parsed = await processDrop(event)

    const containsResource = parsed.some((item) => item.type === 'resource')
    alreadyDropped.set(containsResource)

    const filteredParsed = parsed.filter((item) => item.type !== 'resource')
    receivedDrop = true
    droppedInputElements.update((items) => {
      filteredParsed.forEach((parsedItem) => items.push(parsedItem))
      return items
    })

    setTimeout(() => alreadyDropped.set(false), 4000)
  }

  const handleFileUpload = async (e: any) => {
    const files = e.detail
    let parsed: MediaParserResult[] = []
    for (const file of files) {
      parsed.push(await processFile(file))
    }

    droppedInputElements.update((items) => {
      parsed.forEach((parsedItem) => items.push(parsedItem))
      return items
    })
  }

  const handleChat = async (payload: any) => {
    try {
      isSaving.set(true)
      const userGeneratedText = payload.detail.$inputText
      const links = payload.detail.$parsedURLs as ParsedMetadata[]
      const mediaItems = $droppedInputElements

      // Handle creation of resources based on parsed URLs and media items...
      // Implementation would be similar to what's in the DrawerWrapper
    } catch (err) {
      console.error('Error creating resources from chat input', err)
    } finally {
      isSaving.set(false)
      showDropZone.set(false)
    }
  }

  const handleDropZoneClickOutside = () => {
    showDropZone.set(false)
    receivedDrop = false
    droppedInputElements.set([])
  }

  const handleWindowDragEnter = (e: DragEvent) => {
    dragCount++
    if (dragCount > 0) {
      showDropZone.set(true)
    }
  }

  const handleWindowDragEnd = (e: DragEvent) => {
    if (!receivedDrop) {
      showDropZone.set(false)
    }
    dragCount = 0
    receivedDrop = false
  }
</script>

<svelte:window
  on:dragenter={handleWindowDragEnter}
  on:dragend={handleWindowDragEnd}
  on:drop={handleWindowDragEnd}
/>

{#if $showDropZone}
  <div class="drop-zone">
    {#if $alreadyDropped}
      <div
        class="already-dropped-wrapper"
        in:fly={{ y: 30, duration: 120 }}
        out:fly={{ y: 30, duration: 320 }}
      >
        <AlreadyDroppedTooltip />
      </div>
    {/if}
    <DrawerChat
      on:chatSend={handleChat}
      on:dropForwarded={handleDropForwarded}
      on:dropFileUpload={handleFileUpload}
      forceOpen={true}
      {droppedInputElements}
    />
    <div class="drop-zone-close" on:click={handleDropZoneClickOutside}>
      <Icon name="close" size="15px" />
    </div>
  </div>
{/if}

<style lang="scss">
  .drop-zone {
    position: fixed;
    bottom: 0.5rem;
    left: 0.5rem;
    z-index: 1000;
    width: 305px;
  }

  .already-dropped-wrapper {
    position: absolute;
    top: 0;
    width: 100%;
  }

  .drop-zone-close {
    position: absolute;
    top: -0.75rem;
    left: -0.5rem;
    z-index: 1000;
    background: white;
    border-radius: 50%;
    cursor: pointer;
    border: 1px solid rgba(0, 0, 0, 0.12);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0.15rem;
  }
</style>
