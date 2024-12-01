<script lang="ts">
  import Switch from '@horizon/core/src/lib/components/Atoms/Switch.svelte'
  import SettingsOption from './SettingsOption.svelte'
  import { createEventDispatcher } from 'svelte'
  export let userConfigSettings: any
  const dispatch = createEventDispatcher<{
    'reset-background-image': void
  }>()
</script>

<SettingsOption
  icon="home"
  title="Homescreen"
  description="Pin resources and spaces onto your personalizable homescreen."
  on:update
>
  <section>
    <button on:click={() => dispatch('reset-background-image')} style="padding: 0.5em 0.75em;"
      >Reset Background Image</button
    >
  </section>
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
