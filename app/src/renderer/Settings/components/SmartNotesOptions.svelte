<script lang="ts">
  import { Switch } from '@deta/ui/legacy'
  import SettingsOption from './SettingsOption.svelte'
  import type { UserSettings } from '@deta/types'
  import { Icon } from '@deta/icons'
  import { createEventDispatcher } from 'svelte'
  import { openDialog } from '@deta/ui'

  export let userConfigSettings: UserSettings

  const dispatch = createEventDispatcher<{ update: boolean }>()

  let expanded = false
  let localUseSidebar = userConfigSettings.experimental_notes_chat_sidebar

  const handleToggleNotesSidebar = async (e: CustomEvent<boolean>) => {
    const value = e.detail

    const { closeType: confirmed } = await openDialog({
      icon: 'sidebar.right',
      title: value ? 'Enable Notes Sidebar' : 'Disable Notes Sidebar',
      message: value
        ? 'To use the experimental notes sidebar Surf needs to restart.'
        : 'To use the chat sidebar again Surf needs to restart.',
      actions: [
        { title: 'Cancel', type: 'reset' },
        {
          title: value ? 'Enable and Restart' : 'Disable and Restart',
          type: 'submit',
          kind: value ? 'submit' : 'danger'
        }
      ]
    })

    if (confirmed) {
      localUseSidebar = value
      userConfigSettings.experimental_notes_chat_sidebar = value
      dispatch('update', value)
    } else {
      localUseSidebar = userConfigSettings.experimental_notes_chat_sidebar
    }
  }

  $: localUseSidebar = userConfigSettings.experimental_notes_chat_sidebar
</script>

<SettingsOption icon="file-text-ai" title="Surf Notes" on:update>
  <p slot="description">
    Access context-aware Surf AI features like auto completion, citation generation, and more from
    within your Surf notes. <a
      href="https://deta.notion.site/Smart-Notes-17da5244a717805c8525eec0d42f7598"
      target="_blank">More information</a
    >
  </p>

  <section class="section big-section">
    <div class="info">
      <div class="title">
        <Icon name="sidebar.right" size="20px" stroke-width="2" />
        <h3>Notes Sidebar</h3>
      </div>
      <p>Create and view Surf notes in the sidebar replacing the old chat interface.</p>
    </div>

    <Switch color="#ff4eed" bind:checked={localUseSidebar} on:update={handleToggleNotesSidebar} />
  </section>

  {#if userConfigSettings.experimental_notes_chat_sidebar}
    <section class="section big-section">
      <div class="info">
        <div class="title">
          <Icon name="chat" size="20px" stroke-width="2" />
          <h3>Sidebar Chat Input (experimental)</h3>
        </div>
        <p>Show a traditional chat input in the notes sidebar.</p>
      </div>

      <Switch
        color="#ff4eed"
        bind:checked={userConfigSettings.experimental_notes_chat_input}
        on:update
      />
    </section>
  {/if}
</SettingsOption>

<style lang="scss">
  .big-section {
    margin-top: 0.25rem;
    margin-bottom: 0.75rem;
  }
  .title {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  h3 {
    font-size: 1.1rem;
    color: var(--color-text);
    font-weight: 500;
  }
</style>
