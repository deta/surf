<script lang="ts">
  import Switch from '@horizon/core/src/lib/components/Atoms/Switch.svelte'
  import SettingsOption from './SettingsOption.svelte'
  import type { UserSettings } from '@horizon/types'
  import Exandable from './Exandable.svelte'

  export let userConfigSettings: UserSettings

  let expanded = false
</script>

<SettingsOption
  icon="file-text-ai"
  title="Smart Notes"
  bind:value={userConfigSettings.experimental_smart_notes}
  on:update
>
  <p slot="description">
    Access context-aware Surf AI features like auto completion, citation generation, and more from
    within your Surf notes. <a
      href="https://deta.notion.site/Smart-Notes-17da5244a717805c8525eec0d42f7598"
      target="_blank">More information</a
    >
  </p>

  {#if userConfigSettings.experimental_smart_notes}
    <Exandable title="Advanced (more unstable)" {expanded}>
      <section class="section">
        <div class="info">
          <div class="title">
            <h4>Use Wikipedia as a context for your note by mentioning <code>@wikipedia</code></h4>
          </div>
        </div>

        <Switch
          color="#ff4eed"
          bind:checked={userConfigSettings.experimental_chat_web_search}
          on:update
        />
      </section>

      <section class="section">
        <div class="info">
          <div class="title">
            <h4>Automatically search for similar sources on text selection</h4>
          </div>
        </div>

        <Switch
          color="#ff4eed"
          bind:checked={userConfigSettings.auto_note_similarity_search}
          on:update
        />
      </section>

      <section class="section">
        <div class="info">
          <div class="title">
            <h4>Select text in your note and let Surf AI rewrite it for you</h4>
          </div>
        </div>

        <Switch
          color="#ff4eed"
          bind:checked={userConfigSettings.experimental_note_inline_rewrite}
          on:update
        />
      </section>
    </Exandable>
  {/if}
</SettingsOption>

<style lang="scss">
  h4 {
    font-size: 1.1rem;
    color: var(--color-text);
    margin-bottom: 0.35em;
  }
</style>
