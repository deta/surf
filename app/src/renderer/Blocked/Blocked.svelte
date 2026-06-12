<script lang="ts">
  const params = new URLSearchParams(window.location.search)
  const blockedUrl = params.get('url') ?? ''
  const reason = params.get('reason') ?? 'This site is not available on Acosta Browse.'
  const source = params.get('source') ?? 'blocklist'

  const isFocusBlock = source === 'focus-mode'

  let host = ''
  try {
    host = blockedUrl ? new URL(blockedUrl).hostname.replace(/^www\./, '') : ''
  } catch {
    host = blockedUrl
  }

  let requestState = $state<'idle' | 'sending' | 'sent' | 'failed'>('idle')
  let requestError = $state<string | null>(null)

  const SUGGESTED_RESOURCES = [
    { label: 'NSW Education Standards (NESA)', url: 'https://educationstandards.nsw.edu.au' },
    { label: 'Khan Academy', url: 'https://www.khanacademy.org' },
    { label: 'ABC Education', url: 'https://www.abc.net.au/education' },
    { label: 'State Library of NSW', url: 'https://www.sl.nsw.gov.au' }
  ]

  async function requestAccess() {
    if (requestState === 'sending' || requestState === 'sent') return
    requestState = 'sending'
    requestError = null

    try {
      const result = await window.acostaPage?.requestAccess(blockedUrl, reason)
      if (result?.ok) {
        requestState = 'sent'
      } else {
        requestState = 'failed'
        requestError = result?.error ?? 'Could not send the request.'
      }
    } catch {
      requestState = 'failed'
      requestError = 'Could not send the request.'
    }
  }

  function goBack() {
    history.back()
  }
</script>

<div class="acosta-page blocked-screen">
  <main class="acosta-card panel">
    <div class="acosta-logomark" style="width: 48px; height: 48px; font-size: 26px">A</div>

    {#if isFocusBlock}
      <h1>Stay focused 🌱</h1>
    {:else}
      <h1>This site is blocked</h1>
    {/if}

    {#if host}
      <p class="host">{host}</p>
    {/if}

    <p class="reason">{reason}</p>

    <div class="actions">
      <button class="acosta-button acosta-button-secondary" onclick={goBack}>Go back</button>

      {#if !isFocusBlock}
        <button
          class="acosta-button"
          onclick={requestAccess}
          disabled={requestState === 'sending' || requestState === 'sent'}
        >
          {#if requestState === 'sending'}Sending…{:else if requestState === 'sent'}Request sent ✓{:else}Request
            access{/if}
        </button>
      {/if}
    </div>

    {#if requestState === 'sent'}
      <p class="request-note">
        Your request was sent to your teacher or parent. They'll review it soon.
      </p>
    {:else if requestState === 'failed' && requestError}
      <p class="request-note error">{requestError}</p>
    {/if}

    {#if !isFocusBlock}
      <div class="suggestions">
        <h2>Try these instead</h2>
        <ul>
          {#each SUGGESTED_RESOURCES as resource}
            <li><a href={resource.url}>{resource.label}</a></li>
          {/each}
        </ul>
      </div>
    {/if}
  </main>
</div>

<style>
  .blocked-screen {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100vh;
    padding: 2rem;
    box-sizing: border-box;
  }

  .panel {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: 0.5rem;
    max-width: 480px;
    width: 100%;
    padding: 2.5rem 2rem;
  }

  h1 {
    font-size: 1.6rem;
    font-weight: 700;
    margin: 1rem 0 0;
  }

  .host {
    color: var(--acosta-teal);
    font-weight: 600;
    margin: 0;
    word-break: break-all;
  }

  .reason {
    color: var(--acosta-text-muted);
    margin: 0.5rem 0 1rem;
    line-height: 1.5;
  }

  .actions {
    display: flex;
    gap: 0.75rem;
    margin-bottom: 0.5rem;
  }

  .request-note {
    font-size: 0.85rem;
    color: var(--acosta-text-muted);
    margin: 0;
  }

  .request-note.error {
    color: var(--acosta-danger);
  }

  .suggestions {
    margin-top: 1.5rem;
    padding-top: 1.25rem;
    border-top: 1px solid var(--acosta-border);
    width: 100%;
  }

  .suggestions h2 {
    font-size: 0.95rem;
    font-weight: 600;
    color: var(--acosta-text-muted);
    margin: 0 0 0.5rem;
  }

  .suggestions ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }

  .suggestions a {
    color: var(--acosta-teal);
    text-decoration: none;
    font-size: 0.9rem;
  }

  .suggestions a:hover {
    text-decoration: underline;
  }
</style>
