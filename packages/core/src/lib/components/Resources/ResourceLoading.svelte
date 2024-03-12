<script>
  import LoadingBox from '../Atoms/LoadingBox.svelte'
  import ResourceBasic from './ResourceBasic.svelte'

  export let title = ''
</script>

<div class="resource-preview">
  <div class="preview">
    <ResourceBasic {title} />
  </div>

  <div class="details">
    <div class="type">Saving Resource...</div>
  </div>
</div>

<style lang="scss">
  .resource-preview {
    position: relative;
    display: flex;
    gap: 8px;
    flex-direction: column;
    border-radius: 8px;
    overflow: hidden;
    cursor: default;

    &:hover {
      .remove {
        animation: fade-in 120ms forwards;
        animation-iteration-count: 1;
        animation-delay: 860ms;
      }
    }
  }

  .preview {
    border-radius: 6px;
    border: 1px solid rgba(228, 228, 228, 0.75);
    box-shadow:
      0px 1px 0px 0px rgba(65, 58, 86, 0.25),
      0px 0px 1px 0px rgba(0, 0, 0, 0.25);
    background: rgba(255, 255, 255, 0.75);
    transition: 60ms ease-out;
  }

  .details {
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    align-items: center;
    padding: 0.25rem 0.5rem 0.75rem 0.5rem;
    gap: 0.5rem;
    color: var(--color-text-muted);
  }

  .type {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 1rem;
    font-weight: 500;
    color: #281b53;
  }
</style>
