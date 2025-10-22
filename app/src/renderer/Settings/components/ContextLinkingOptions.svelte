<script lang="ts">
  import SettingsOption from './SettingsOption.svelte'
  import type { UserSettings } from '@deta/types'

  export let userConfigSettings: UserSettings

  let expanded = false
</script>

<SettingsOption
  icon="link"
  title="Linked Contexts"
  description="Link contexts to each other to easily navigate between them."
  bind:value={userConfigSettings.experimental_context_linking}
  on:update
>
  <!-- <Exandable title="Advanced" {expanded}>
    <section class="section">
      <div class="info">
        <div class="title">
          <h4>Show linked contexts in the stuff overlay sidebar.</h4>
        </div>
      </div>

      <Switch
        color="#ff4eed"
        bind:checked={userConfigSettings.experimental_context_linking_sidebar}
        on:update
      />
    </section>
  </Exandable> -->
</SettingsOption>

<style lang="scss">
  h4 {
    font-size: 1.1rem;
    color: var(--color-text);
    margin-bottom: 0.35em;
  }
</style>
