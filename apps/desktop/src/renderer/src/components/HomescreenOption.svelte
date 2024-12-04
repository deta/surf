<script lang="ts">
  import Switch from '@horizon/core/src/lib/components/Atoms/Switch.svelte'
  import SettingsOption from './SettingsOption.svelte'
  export let userConfigSettings: any
</script>

<SettingsOption
  icon="home"
  title="Desktop"
  description="Pin web pages, images and files from your Stuff onto your context's desktops."
  on:update
>
  <section>
    <div class="info">
      <div class="title">
        <h4 style="margin-bottom:0.35em;">Link New Tab Menu and Desktop</h4>
      </div>
      <p>Open the Desktop automatically when toggling the New Tab Menu for quick access.</p>
    </div>

    <Switch color="#ff4eed" bind:checked={userConfigSettings.homescreen_link_cmdt} on:update />
  </section>
</SettingsOption>
