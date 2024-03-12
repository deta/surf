<script lang="ts">
  import { Icon } from '@horizon/icons'
</script>

<div class="saving">
  <Icon name="spinner" />

  <div class="state">Saving…</div>
</div>

<style lang="scss">
  .saving {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0 1rem;
  }

  .state {
    font-size: 1rem;
    font-weight: 500;
  }
</style>
