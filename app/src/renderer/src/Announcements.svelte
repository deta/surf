<script lang="ts">
  import { onMount } from 'svelte'
  import appIcon from './assets/icon_512.png'
  import MarkdownRenderer from '@deta/editor/src/lib/components/MarkdownRenderer.svelte'
  import type { Announcement } from '@deta/types'
  import { getFormattedDate } from '@deta/utils'
  import { Icon } from '@horizon/icons'

  let announcements: Announcement[] = []

  onMount(async () => {
    announcements = await window.announcementsAPI.getAnnouncements()

    // TODO: should we send ipc for opening in surf itself?
    document.addEventListener('click', (event) => {
      const target = event.target as HTMLElement
      const link = target.closest('a')

      if (link) {
        event.preventDefault()
        const url = link.getAttribute('href')
        if (url) {
          window.electron.openUrl(url)
        }
      }
    })
  })
</script>

<main class="main-container drag">
  <div class="content-wrapper">
    <div class="icon-container">
      <img src={appIcon} alt="App Icon" />
    </div>

    <div class="announcements-container">
      {#each announcements as announcement (announcement.id)}
        <div class="announcement-card no-drag" data-type={announcement.type}>
          <div class="announcement-header">
            <div class="announcement-type">
              {#if announcement.type === 'security'}
                <Icon name="alert-triangle" size="20px" />
              {:else if announcement.type === 'info'}
                <Icon name="info" size="20px" />
              {:else if announcement.type === 'update'}
                <Icon name="sparkles" size="20px" />
              {/if}

              <div class="type-label">
                {#if announcement.type === 'security'}
                  Security
                {:else if announcement.type === 'info'}
                  Announcement
                {:else if announcement.type === 'update'}
                  New Release
                {:else}
                  {announcement.type}
                {/if}
              </div>
            </div>

            <div class="announcement-date">
              {#if announcement.updatedAt !== announcement.createdAt}
                Updated {getFormattedDate(announcement.updatedAt)}
              {:else}
                Published {getFormattedDate(announcement.createdAt)}
              {/if}
            </div>
          </div>

          <div class="announcement-content">
            <MarkdownRenderer content={announcement.content} size="sm" />
          </div>
        </div>
      {/each}
    </div>
  </div>
</main>

<style lang="scss">
  * {
    box-sizing: border-box;
  }

  .drag {
    -webkit-app-region: drag;
  }

  .no-drag {
    -webkit-app-region: no-drag;
  }

  img {
    width: 100px;
    height: 100px;
    user-select: none;
    pointer-events: none;
  }

  .main-container {
    min-height: 100vh;
    width: 100vw;
    display: flex;
    justify-content: center;
    align-items: flex-start;
    padding-top: 2rem;
    background-color: #f5f5f5;
    overflow-y: auto;
  }

  .content-wrapper {
    display: flex;
    flex-direction: column;
    gap: 2rem;
    width: min(600px, 90%);
    height: 100%;
  }

  .icon-container {
    flex-shrink: 0;
    display: flex;
    justify-content: center;
  }

  .announcements-container {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 1rem;
    padding: 1rem;
    padding-bottom: 3rem;
  }

  .announcement-card {
    background: white;
    border-radius: 15px;
    padding: 2rem;
    border: 1px solid rgb(229 231 235);

    &[data-type='security'] .announcement-type {
      color: #f6b26e;
    }

    &[data-type='info'] .announcement-type {
      color: #6b7280;
    }

    &[data-type='update'] .announcement-type {
      color: #4a76d5;
    }
  }

  .announcement-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    margin-bottom: 1rem;
  }

  .announcement-type {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .type-label {
    font-weight: 500;
    font-size: 0.9rem;
  }

  .announcement-date {
    font-size: 0.875rem;
    color: #6b7280;
  }

  .announcement-content {
    font-size: 1rem;
    line-height: 1.5;

    :global(p) {
      margin: 0;
    }

    :global(p + p) {
      margin-top: 1rem;
    }
    :global(ul),
    :global(ol) {
      margin: 1rem 0;
      padding-left: 2rem;
    }

    :global(li) {
      margin: 0.25rem 0;
    }
  }
</style>
