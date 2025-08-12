<script lang="ts">
  import { onMount } from 'svelte'

  import { Icon } from '@deta/icons'
  import { wait } from '@deta/utils'

  import type { BrowserExtension } from '@horizon/core/src/lib/service/ipc/events'
  import { openDialog } from '@horizon/core/src/lib/components/Core/Dialog/Dialog.svelte'

  let extensions: BrowserExtension[] = []
  let noExtensions: boolean = true

  const CHROME_WEB_STORE_URL = 'https://chrome.google.com/webstore/category/extensions'
  const fetchExtensions = async () => {
    // @ts-ignore
    const list = await window.api.listExtensions()
    extensions = list
    noExtensions = extensions.length === 0
  }

  const uninstallExtension = async (extension: BrowserExtension) => {
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

<article class="general">
  <div class="box">
    <div class="box-icon">
      <Icon name="info" size="25px" />
    </div>
    <div class="box-content">
      {#if noExtensions}
        <h2>You don't have any extensions yet.</h2>
      {/if}
      <p>
        Surf comes with experimental extension support, currently limited to most popular password
        managers.
      </p>
    </div>
  </div>
  <div class="default-wrapper">
    {#if noExtensions}
      <p>Install your favorite password manager from the Chrome Web Store.</p>
    {/if}
    <button on:click={() => window.api.openURL(CHROME_WEB_STORE_URL, true)}>
      Open Chrome Web Store
    </button>
  </div>
  {#if !noExtensions}
    <div class="extensions-section">
      <h3>Installed Extensions</h3>
      <div class="extensions-list">
        {#each extensions as extension (extension.id)}
          <div class="extension-item">
            <div class="extension-info">
              <div class="extension-name">{extension.name}</div>
              <div class="extension-version">Version: <span>{extension.version}</span></div>
            </div>
            <button class="uninstall-btn" on:click={() => uninstallExtension(extension)}>
              <Icon name="trash" size="16px" />
              Uninstall
            </button>
          </div>
        {/each}
      </div>
    </div>
  {/if}
</article>

<style lang="scss">
  .general {
    height: fit-content;
    width: 100%;
    max-width: 45rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    align-items: center;
  }

  .box {
    display: flex;
    align-items: flex-start;
    justify-content: center;
    gap: 1rem;
    padding: 1rem;
    border-radius: 0.5rem;
    color: var(--color-text);
    text-align: left;
    margin-bottom: 1rem;
    width: 100%;

    .box-icon {
      flex-shrink: 0;
      margin-top: 0.25rem;
    }

    .box-content {
      flex: 1;

      h2 {
        margin: 0 0 0.5rem 0;
        font-size: 1.2rem;
        font-weight: 600;
        color: var(--color-text);
      }

      p {
        margin: 0;
        font-size: 1.1rem;
        color: var(--color-text-muted);
        line-height: 1.5;
      }
    }
  }

  .default-wrapper {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 1rem 1.25rem;
    text-align: center;
    gap: 1rem;
    margin-bottom: 1.5rem;

    button {
      padding: 8px 16px;
      color: var(--color-text-light);
      border: none;
      border-radius: 0.75rem;
      font-size: 0.9rem;
      font-weight: 500;
      cursor: pointer;

      transition: all 0.3s ease;
      background: radial-gradient(
        circle at 50% -50%,
        rgba(215, 143, 215, 1) 0%,
        rgba(45, 150, 205, 1) 35%,
        rgba(74, 144, 226, 1) 100%
      );
      box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
      text-transform: uppercase;
      letter-spacing: 1px;
      position: relative;
      overflow: hidden;

      &::before {
        content: '';
        position: absolute;
        top: 0;
        left: -100%;
        width: 100%;
        height: 100%;
        background: linear-gradient(120deg, transparent, rgba(255, 255, 255, 0.3), transparent);
        transition: all 0.5s;
      }

      &:hover {
        box-shadow: 0 6px 20px rgba(0, 0, 0, 0.15);
        color: rgb(237, 237, 237);

        &::before {
          left: 100%;
        }
      }

      &:active {
        transform: translateY(1px);
      }
    }
  }

  .extensions-section {
    width: 100%;

    h3 {
      margin: 0 0 1rem 0;
      font-size: 1.5rem;
      font-weight: 600;
      color: var(--color-text);
      text-align: center;
    }
  }

  .extensions-list {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    width: 100%;
  }

  .extension-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    background-color: var(--color-background-light);
    border: 1px solid var(--color-border);
    border-radius: 1rem;
    padding: 1rem 1.25rem;
    transition: all 0.2s ease;

    &:hover {
      border-color: var(--color-border-dark);
      background-color: var(--color-background);
    }

    .extension-info {
      flex: 1;

      .extension-name {
        font-size: 1.1rem;
        font-weight: 500;
        color: var(--color-text);
        margin-bottom: 0.25rem;
      }

      .extension-version {
        font-size: 0.95rem;
        color: var(--color-text-muted);

        span {
          font-style: italic;
        }
      }
    }

    .uninstall-btn {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.5rem 1rem;
      border: 1px solid #fecaca;
      border-radius: 0.5rem;
      background-color: #fef2f2;
      color: #dc2626;
      font-size: 0.9rem;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s ease;

      &:hover {
        background-color: #fee2e2;
        border-color: #fca5a5;
      }

      &:active {
        transform: translateY(1px);
      }
    }
  }
</style>
