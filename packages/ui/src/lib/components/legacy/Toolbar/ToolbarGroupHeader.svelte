<script lang="ts">
  export let title: string
</script>

<div class="toolbar-group-header">
  {title}
</div>

<style lang="scss">
  .toolbar-group-header {
    font-size: 14px;
    padding: 8px 0.5rem 8px 0.5rem;
    opacity: 0.6;
    border-bottom: 1px solid rgba(0, 0, 0, 0.12);
  }
</style>
