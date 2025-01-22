<script lang="ts">
  import { Icon } from '@horizon/icons'

  export let text: string = 'Thinking…'
</script>

<div class="loading">
  <Icon name="spinner" size="16px" />
  <span>{text}</span>
</div>

<style>
  .loading {
    width: fit-content;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    font-size: 1rem;
    opacity: 0.75;
  }
</style>
