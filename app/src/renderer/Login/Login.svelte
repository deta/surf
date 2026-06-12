<script lang="ts">
  let mode = $state<'sign-in' | 'sign-up'>('sign-in')
  let email = $state('')
  let password = $state('')
  let displayName = $state('')
  let error = $state<string | null>(null)
  let loading = $state(false)
  let googleLoading = $state(false)

  const canSubmit = $derived(
    email.trim().length > 3 && password.length >= 6 && !loading && !googleLoading
  )

  async function submit(event: SubmitEvent) {
    event.preventDefault()
    if (!canSubmit) return

    error = null
    loading = true
    try {
      const result =
        mode === 'sign-in'
          ? await window.api.acosta.signIn(email.trim(), password)
          : await window.api.acosta.signUp(email.trim(), password, displayName.trim() || undefined)

      if (result && !result.ok) {
        error = result.error
      }
      // On success the main process swaps this window to the browser UI.
    } catch {
      error = 'Something went wrong. Please try again.'
    } finally {
      loading = false
    }
  }

  async function signInWithGoogle() {
    if (loading || googleLoading) return
    error = null
    googleLoading = true
    try {
      const result = await window.api.acosta.signInWithGoogle()
      if (result && !result.ok) {
        error = result.error
      }
    } catch {
      error = 'Google sign-in failed. Please try again.'
    } finally {
      googleLoading = false
    }
  }

  function toggleMode() {
    mode = mode === 'sign-in' ? 'sign-up' : 'sign-in'
    error = null
  }
</script>

<div class="acosta-page login-screen">
  <main class="login-panel">
    <div class="acosta-logomark" style="width: 64px; height: 64px; font-size: 36px">A</div>

    <h1>Acosta Browse</h1>
    <p class="tagline">Your study browser, built for NSW students.</p>

    <form onsubmit={submit}>
      {#if mode === 'sign-up'}
        <input
          class="acosta-input"
          type="text"
          placeholder="Your name"
          autocomplete="name"
          bind:value={displayName}
        />
      {/if}

      <input
        class="acosta-input"
        type="email"
        placeholder="Email"
        autocomplete="email"
        required
        bind:value={email}
      />

      <input
        class="acosta-input"
        type="password"
        placeholder="Password"
        autocomplete={mode === 'sign-in' ? 'current-password' : 'new-password'}
        required
        bind:value={password}
      />

      {#if error}
        <p class="error" role="alert">{error}</p>
      {/if}

      <button class="acosta-button" type="submit" disabled={!canSubmit}>
        {#if loading}
          {mode === 'sign-in' ? 'Signing in…' : 'Creating account…'}
        {:else}
          {mode === 'sign-in' ? 'Sign in' : 'Create account'}
        {/if}
      </button>
    </form>

    <div class="divider"><span>or</span></div>

    <button
      class="acosta-button acosta-button-secondary google-button"
      onclick={signInWithGoogle}
      disabled={loading || googleLoading}
    >
      <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
        <path
          fill="#FFC107"
          d="M43.6 20.1H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3l5.7-5.7C34 6.1 29.3 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.6-.4-3.9z"
        />
        <path
          fill="#FF3D00"
          d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"
        />
        <path
          fill="#4CAF50"
          d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2c-2 1.5-4.5 2.4-7.2 2.4-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.6 39.6 16.2 44 24 44z"
        />
        <path
          fill="#1976D2"
          d="M43.6 20.1H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C41.4 35.1 44 30 44 24c0-1.3-.1-2.6-.4-3.9z"
        />
      </svg>
      {googleLoading ? 'Waiting for Google…' : 'Continue with Google'}
    </button>

    <button class="mode-toggle" onclick={toggleMode}>
      {mode === 'sign-in'
        ? "Don't have an account? Create one"
        : 'Already have an account? Sign in'}
    </button>
  </main>
</div>

<style>
  .login-screen {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100vh;
    /* Make the frameless window draggable from the empty areas */
    -webkit-app-region: drag;
  }

  .login-panel {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.75rem;
    width: 360px;
    -webkit-app-region: no-drag;
  }

  h1 {
    font-size: 2rem;
    font-weight: 700;
    margin: 0.75rem 0 0;
  }

  .tagline {
    color: var(--acosta-text-muted);
    margin: 0 0 1.25rem;
  }

  form {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    width: 100%;
  }

  form .acosta-button {
    margin-top: 0.25rem;
  }

  .error {
    color: var(--acosta-danger);
    font-size: 0.875rem;
    margin: 0;
  }

  .divider {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    width: 100%;
    color: var(--acosta-text-faint);
    font-size: 0.8rem;
    margin: 0.5rem 0;
  }

  .divider::before,
  .divider::after {
    content: '';
    flex: 1;
    height: 1px;
    background: var(--acosta-border);
  }

  .google-button {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.6rem;
    width: 100%;
  }

  .mode-toggle {
    background: none;
    border: none;
    color: var(--acosta-teal);
    font-size: 0.875rem;
    cursor: pointer;
    margin-top: 1rem;
    font-family: var(--acosta-font-body);
  }

  .mode-toggle:hover {
    color: var(--acosta-teal-hover);
  }
</style>
