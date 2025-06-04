<script lang="ts">
  import { onMount } from 'svelte'

  import { Icon } from '@horizon/icons'
  import { wait } from '@horizon/utils'

  import type { BrowserExtension } from '@horizon/core/src/lib/service/ipc/events'
  import { openDialog } from '@horizon/core/src/lib/components/Core/Dialog/Dialog.svelte'

  let extensions: BrowserExtension[] = []

  const fetchExtensions = async () => {
    // @ts-ignore
    const list = await window.api.listExtensions()
    console.log('extensions', list)

    extensions = list
  }

  const uninstallExtension = async (extension: BrowserExtension) => {
    console.log('uninstalling extension', extension)

    const { closeType: confirmed } = await openDialog({
      title: 'Uninstall Extension',
      message: `Are you sure you want to uninstall "${extension.name}"?`,
      actions: [
        { title: 'Cancel', type: 'reset' },
        { title: 'Uninstall', type: 'submit' }
      ]
    })

    if (!confirmed) return

    // @ts-ignore
    window.api.removeExtension(extension.id)

    await wait(500)
    fetchExtensions()
  }

  onMount(() => {
    fetchExtensions()
  })
</script>

<svelte:window on:focus={() => fetchExtensions()} />

<div class="wrapper">
  <div class="extensions">
    {#each extensions as extension (extension.id)}
      <div class="extension">
        <div class="meta">
          <div class="name">{extension.name}</div>
          <div>{extension.version}</div>
        </div>
        <button on:click={() => uninstallExtension(extension)}>
          <Icon name="trash" />
          Uninstall
        </button>
      </div>
    {/each}
  </div>
</div>

<style lang="scss">
  .wrapper {
    .extensions {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
      gap: 20px;

      .extension {
        padding: 0.75rem;
        border: 1px solid #ccc;
        border-radius: 12px;
        display: flex;
        flex-direction: column;
        justify-content: space-between;

        .meta {
          display: flex;
          justify-content: space-between;
          margin-bottom: 10px;
        }

        .name {
          font-weight: 500;
          font-size: 1.1em;
        }

        button {
          width: fit-content;
          display: flex;
          align-items: center;
          gap: 5px;
          padding: 5px 10px;
          border: 1px solid #ccc;
          border-radius: 5px;
          background-color: #f5f5f5;
          cursor: pointer;
        }
      }
    }
  }
</style>
