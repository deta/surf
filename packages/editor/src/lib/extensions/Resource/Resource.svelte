<script lang="ts">
  export let id: string
  export let type: string
</script>

<div class="content">
  <div>{id}</div>
  <div>{type}</div>
</div>

<style>
  .content {
    display: flex;
    align-items: center;
    gap: 8px;
  }
</style>
