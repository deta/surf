<script lang="ts">
  import { Icon } from '@horizon/icons'

  export let title: string

  const MAX_TITLE_LENGTH = 50

  const truncate = (text: string, length: number) => {
    return text.length > length ? text.slice(0, length) + '...' : text
  }

  $: truncatedTitle = truncate(title, MAX_TITLE_LENGTH)
</script>

<div class="link-card">
  <!-- <a href={document?.url} target="_blank" class="link-card"> -->
  <div class="details">
    <div class="title">{truncatedTitle}</div>
    <div class="status">
      <Icon name="spinner" />
      <div class="from">Processing…</div>
    </div>
  </div>
</div>

<style lang="scss">
  .link-card {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 2rem;
    color: inherit;
    text-decoration: none;
    user-select: none;
    -webkit-user-drag: none;
  }

  .details {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    flex-grow: 1;
    color: #8a8a8a;
  }

  .googleDocs {
    .title,
    .document-metadata > .from {
      color: #ffffff;
    }
  }

  .favicon {
    width: 1.5rem;
    height: 1.5rem;
    border-radius: 5.1px;
    box-shadow:
      0px 0.425px 0px 0px rgba(65, 58, 86, 0.25),
      0px 0px 0.85px 0px rgba(0, 0, 0, 0.25);
  }

  .title {
    font-size: 1.25rem;
    line-height: 1.775rem;
    letter-spacing: 0.02rem;
    color: #281b53;
    font-weight: 500;
    flex-shrink: 0;
    margin-top: 1rem;
    max-width: 95%;
  }
  .status {
    display: flex;
    align-items: center;
    padding: 0.5rem 0;
    gap: 0.5rem;
    .from {
      font-size: 1rem;
      font-weight: 500;
      text-decoration: none;
      color: #281b53;
      opacity: 0.65;
    }
  }
</style>
