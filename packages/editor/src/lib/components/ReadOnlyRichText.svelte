<script lang="ts">
  /**
   * ReadOnlyContent component for displaying HTML content performantly.
   * This component efficiently renders HTML content with proper sanitization.
   */
  import DOMPurify from 'dompurify'

  export let content = ''

  // Reactive statement to sanitize content
  $: sanitizedContent = DOMPurify.sanitize(content, { USE_PROFILES: { html: true } })
</script>

<div class="readonly-content">
  {@html sanitizedContent}
</div>

<style>
  .readonly-content {
    width: 100%;
    height: 100%;
    overflow: auto;
    font-family: inherit;
    line-height: 1.5;
    color: inherit;
  }

  /* Ensure links are styled properly */
  :global(.readonly-content a) {
    color: var(--link-color, #0366d6);
    text-decoration: none;
  }

  :global(.readonly-content a:hover) {
    text-decoration: underline;
  }

  /* Basic styling for common elements */
  :global(
      .readonly-content h1,
      .readonly-content h2,
      .readonly-content h3,
      .readonly-content h4,
      .readonly-content h5,
      .readonly-content h6
    ) {
    margin-top: 1em;
    margin-bottom: 0.5em;
    font-weight: 600;
    line-height: 1.25;
  }

  :global(.readonly-content p, .readonly-content ul, .readonly-content ol) {
    margin-top: 0;
    margin-bottom: 1em;
  }

  :global(.readonly-content img) {
    max-width: 100%;
    height: auto;
  }

  :global(.readonly-content pre, .readonly-content code) {
    font-family: monospace;
    background-color: var(--code-bg, rgba(0, 0, 0, 0.05));
    border-radius: 3px;
    padding: 0.2em 0.4em;
  }

  :global(.readonly-content pre) {
    padding: 1em;
    overflow: auto;
  }
</style>
