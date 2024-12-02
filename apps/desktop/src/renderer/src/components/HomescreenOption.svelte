<script lang="ts">
  import Switch from '@horizon/core/src/lib/components/Atoms/Switch.svelte'
  import SettingsOption from './SettingsOption.svelte'
  export let userConfigSettings: any
</script>

<SettingsOption
  icon="home"
  title="Homescreen"
  description="Pin resources and spaces onto your personalizable homescreen."
  on:update
>
  <section>
    <div class="info">
      <div class="title">
        <h4 style="margin-bottom:0.35em;">Link Command Menu and Homescreen</h4>
      </div>
      <p>Open the Homescreen automatically when toggling the Command Menu for quick access.</p>
    </div>

    <Switch color="#ff4eed" bind:checked={userConfigSettings.homescreen_link_cmdt} on:update />
  </section>
</SettingsOption>
