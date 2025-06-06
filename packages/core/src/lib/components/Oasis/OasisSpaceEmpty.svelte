<script lang="ts">
  import { Icon } from '@horizon/icons'
</script>

<div class="empty-wrapper">
  <header>
    <Icon name="save" size="22px" />
    <h2>Add your first Items</h2>
    <p>You can drag and drop, paste links or save any tab.</p>
  </header>
</div>

<style lang="scss">
  :root {
    --primary-color: #3a53ff;
    --primary-hover: #426eff;
    --button-text-color: #ffffff;
    --heading-text-color: #111827;
    --paragraph-text-color: #4b5563;
    --heading-size: 1.5rem;
    --button-text-size: 13px;
    --button-radius: 0.65rem;
    --transition-speed: 0.5s;
    --shine-opacity: 0.3;
    --shadow-light: rgba(0, 0, 0, 0.05);
    --shadow-medium: rgba(0, 0, 0, 0.1);
  }

  h2 {
    font-size: var(--heading-size);
    margin: 0;
    font-weight: 600;
    color: var(--heading-text-color);
  }

  p {
    margin: 0;
    font-size: 0.95rem;
    color: var(--paragraph-text-color);
  }

  .empty-wrapper {
    position: relative;
    top: 12rem;
  }

  header {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
  }
</style>
