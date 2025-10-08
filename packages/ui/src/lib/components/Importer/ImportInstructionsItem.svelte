<script lang="ts">
  import { Icon, type Icons } from '@deta/icons'

  export let label: string
  export let icon: Icons
  export let shortcut: string[] = []
</script>

<div class="instructions-item">
  <div class="instructions-label">
    <Icon name={icon} size="22px" />
    <div class="instructions-name">{label}</div>
  </div>

  <ShortcutVisualizer {shortcut} size="small" interactive={true} />
</div>

<style lang="scss">
  .instructions-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1rem;
    border-radius: 12px;
    background-color: #f3f4f6;
    color: #000000;

    .instructions-label {
      display: flex;
      align-items: center;
      gap: 1rem;

      .instructions-name {
        font-size: 1.2rem;
        font-weight: 500;
      }
    }

    :global(.shortcut-container) {
      --squircle-fill: rgb(225 225 225);
    }

    :global(.shortcut-container .key-wrapper:not(.active):not(.success) .key-cap) {
      --fill: #fff;
    }

    :global(.dark) & {
      color: #e5e5e5;
      background-color: #383838;

      :global(.shortcut-container) {
        --squircle-fill: rgb(43 43 43);
      }
    }
  }
</style>
