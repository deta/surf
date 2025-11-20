<script lang="ts">
</script>

<div class="sidecar">
  <slot />
</div>

<style lang="scss">
  .sidecar {
    position: relative;
    margin-bottom: 2rem !important;
    width: 100%;
    border: 1px solid light-dark(rgba(0, 0, 0, 0.1), rgba(71, 85, 105, 0.3));
    border-radius: 12px;
    padding: 0.75rem 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    opacity: 0.5;
    transition: opacity 223ms ease-out;
    color: light-dark(rgba(0, 0, 0, 0.75), rgba(255, 255, 255, 0.8));

    &:hover {
      opacity: 1;
    }

    :global(li) {
      max-width: 430px;
      max-height: 4rem;
    }
  }
</style>
