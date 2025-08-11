<script lang="ts">
  import { createEventDispatcher } from 'svelte'
  import type { Readable } from 'svelte/store'
  import icon from '../../assets/icon_512.png'
  import Button from './Button.svelte'
  import { isDev } from '@deta/utils'

  const dispatch = createEventDispatcher()

  export let emailStore: Readable<string>

  let resentEmail = false
  let requestedNewCode = false
  let loading = false
  let error = ''
  let inviteCode = ''
  let showManualEntry = false
  let showEmailEntry = false
  let requestEmail = ''

  export const submitInviteCode = (code: string) => {
    inviteCode = code
    handleSubmitInvite()
  }

  const sanitize = (input: string): string => {
    return input.trim()
  }

  const resendVerificationEmail = async () => {
    try {
      loading = true
      error = ''
      const res = await window.api.signup($emailStore)
      if (!res.ok) {
        error = 'Sorry, we could not resend the verification email.'
        return
      }
      resentEmail = true
      requestedNewCode = false
    } catch (e) {
      console.error(e)
      error = `Sorry, we encountered an error: ${e}`
    } finally {
      loading = false
    }
  }

  const requestNewActivationCode = async () => {
    try {
      loading = true
      error = ''
      const res = await window.api.resendInviteCode(sanitize(requestEmail))
      if (!res.ok) {
        error = 'Sorry, we could not generate a new activation code.'
        return
      }
      requestedNewCode = true
      resentEmail = false
    } catch (e) {
      console.error(e)
      error = `Sorry, we encountered an error: ${e}`
    } finally {
      loading = false
    }
  }

  const handleSubmitInvite = async () => {
    try {
      loading = true
      error = ''

      if (isDev) {
        dispatch('viewChange', 'persona')
        return
      }

      const res = await window.api.activateAppUsingKey(sanitize(inviteCode), true)
      if (!res.ok) {
        error = 'Sorry, the verification code is invalid.'
        switch (res.status) {
          case 409:
            error = 'Sorry, the verification code has already been used.'
            break
          default:
            break
        }

        if (!isDev) {
          return
        }
      }
      dispatch('viewChange', 'persona')
    } catch (e) {
      console.error(e)
      error = `Sorry, we encountered an error: ${e}`
    } finally {
      loading = false
    }
  }

  const toggleManualEntry = () => {
    showManualEntry = !showManualEntry
    if (!showManualEntry) {
      inviteCode = ''
      error = ''
    }
  }

  const toggleEmailEntry = () => {
    showEmailEntry = !showEmailEntry
    if (!showEmailEntry) {
      requestEmail = ''
      error = ''
    }
  }
</script>

<div class="container">
  <div class="content">
    <img class="surf-logo" src={icon} alt="Surf icon" />

    {#if $emailStore}
      <h1 class="title">Check Your Email</h1>
      <p class="main-message">
        We've sent a verification email to <strong>{$emailStore}</strong>.
      </p>
      <p class="main-message">Click the verification link in your email.</p>
      {#if !resentEmail}
        <p class="info">
          Didn't receive the email? <a
            class="apply-link"
            href="#"
            on:click|preventDefault={resendVerificationEmail}>Resend</a
          >.
        </p>
      {:else}
        <p class="success-inline">✓ Verification email resent! Check your inbox.</p>
      {/if}
    {:else}
      <h1 class="title">Welcome to Surf!</h1>
    {/if}

    {#if error}
      <p class="error">
        {error}
      </p>
      <p class="info">Send us an email (<i>hello@deta.surf</i>) if the issue persists.</p>
    {/if}

    <div class="actions-wrapper">
      <div class="main-actions">
        <div class="action-section">
          <p class="action-text">Have an activation code?</p>

          {#if !showManualEntry}
            <Button on:click={toggleManualEntry}>Enter Code Here</Button>
          {:else}
            <form on:submit|preventDefault={handleSubmitInvite} class="manual-form">
              <div class="code-input-wrapper">
                <input
                  bind:value={inviteCode}
                  class="invite-input"
                  placeholder="Enter your activation code"
                  required
                  autofocus
                />
                <button
                  type="button"
                  class="cancel-btn"
                  on:click={toggleManualEntry}
                  aria-label="Cancel code entry"
                >
                  ×
                </button>
              </div>

              <Button type="submit" disabled={loading || !inviteCode.trim()}>
                {loading ? 'Verifying...' : 'Activate Surf'}
              </Button>
            </form>
          {/if}
        </div>

        {#if !$emailStore}
          <div class="action-section">
            {#if !requestedNewCode}
              <p class="action-text">Need a new activation code?</p>

              {#if !showEmailEntry}
                <Button on:click={toggleEmailEntry}>Request New Code</Button>
              {:else}
                <form on:submit|preventDefault={requestNewActivationCode} class="manual-form">
                  <div class="code-input-wrapper">
                    <input
                      bind:value={requestEmail}
                      class="invite-input email-input"
                      type="email"
                      placeholder="Enter Your Email"
                      required
                      autofocus
                    />
                    <button
                      type="button"
                      class="cancel-btn"
                      on:click={toggleEmailEntry}
                      aria-label="Cancel email entry"
                    >
                      ×
                    </button>
                  </div>

                  <Button type="submit" disabled={loading || !requestEmail.trim()}>
                    {loading ? 'Generating...' : 'Request Activation Code'}
                  </Button>
                </form>
              {/if}
            {:else}
              <p class="success-inline">✓ Check your email.</p>
            {/if}
          </div>
        {/if}
      </div>

      <div class="links">
        {#if !$emailStore}
          <a
            href="#"
            on:click|preventDefault={() => dispatch('viewChange', 'email')}
            class="apply-link"
          >
            ← Go Back
          </a>
        {/if}
      </div>
    </div>
  </div>
</div>

<style lang="scss">
  .container {
    display: flex;
    justify-content: center;
    align-items: center;
    width: 100%;
    min-height: 100vh;
  }

  .content {
    padding: 2rem;
    text-align: center;
    width: 100%;
    max-width: 52rem;
    margin: 0 auto;
  }

  .surf-logo {
    width: 12rem;
    height: 12rem;
    margin-bottom: 1rem;
    display: inline;
  }

  .title {
    font-family: 'Gambarino-Display', sans-serif;
    font-size: 2.5rem;
    font-weight: 400;
    margin-bottom: 1rem;
    color: #333;
  }

  .main-message {
    text-align: center;
    font-size: 1.1rem;
    font-family: 'Inter', sans-serif;
    color: #333;
    margin-bottom: 0.5rem;

    strong {
      color: #1995f5;
    }
  }

  .info {
    font-size: 1rem;
    font-family: 'Inter', sans-serif;
    color: rgba(0, 0, 0, 0.6);
    margin-bottom: 2rem;
    line-height: 1.5;
    text-align: center;
  }

  .actions-wrapper {
    max-width: 400px;
    margin: 0 auto;
  }

  .main-actions {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    margin-bottom: 2rem;
  }

  .action-section {
    text-align: center;
    padding: 1.5rem;
    background: white;
    border-radius: 16px;
    border: 2px solid #f1f3f4;
    transition: all 0.3s ease;

    &:hover {
      border-color: #e8f0fe;
      box-shadow: 0 2px 8px rgba(25, 149, 245, 0.08);
    }
  }

  .action-text {
    font-family: 'Inter', sans-serif;
    font-size: 1.05rem;
    color: #5f6368;
    margin: 0 0 1rem 0;
    text-align: center;
    font-weight: 500;
  }

  .action-btn {
    background: transparent;
    border: 2px solid #1995f5;
    color: #1995f5;
    padding: 0.85rem 1.75rem;
    border-radius: 24px;
    font-family: 'Inter', sans-serif;
    font-size: 1rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;

    &:hover:not(:disabled) {
      background: #1995f5;
      color: white;
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(25, 149, 245, 0.2);
    }

    &:active:not(:disabled) {
      transform: translateY(0);
    }

    &:disabled {
      border-color: #9aa0a6;
      color: #9aa0a6;
      cursor: not-allowed;
      transform: none;
      box-shadow: none;
    }

    &:focus {
      outline: none;
      box-shadow: 0 0 0 3px rgba(25, 149, 245, 0.2);
    }
  }

  .manual-form {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    animation: slideIn 0.3s ease-out;
  }

  @keyframes slideIn {
    from {
      opacity: 0;
      transform: translateY(-10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .code-input-wrapper {
    position: relative;
    display: flex;
    align-items: center;
  }

  .invite-input {
    width: 100%;
    padding: 1rem 3rem 1rem 1rem;
    border: 2px solid #e8eaed;
    border-radius: 12px;
    font-size: 16px;
    font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Roboto Mono', monospace;
    letter-spacing: 0.1em;
    text-align: center;
    background: #fafbfc;
    transition: all 0.2s ease;

    &.email-input {
      font-family: 'Inter', sans-serif;
      letter-spacing: 0;
    }

    &::placeholder {
      text-align: center;
      font-family: 'Inter', sans-serif;
      letter-spacing: 0;
      color: #9aa0a6;
      font-size: 14px;
    }

    &:focus {
      outline: none;
      border-color: #1995f5;
      background: white;
      box-shadow: 0 0 0 4px rgba(25, 149, 245, 0.1);
    }
  }

  .cancel-btn {
    position: absolute;
    right: 8px;
    top: 50%;
    transform: translateY(-50%);
    background: none;
    border: none;
    color: #9aa0a6;
    font-size: 24px;
    cursor: pointer;
    padding: 4px;
    border-radius: 50%;
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;

    &:hover {
      background: #f1f3f4;
      color: #5f6368;
    }

    &:focus {
      outline: none;
      background: #e8f0fe;
      color: #1995f5;
    }
  }

  .success-inline {
    font-family: 'Inter', sans-serif;
    color: #28a745;
    margin: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
  }

  .links {
    margin-top: 2rem;
    padding-top: 1rem;
    border-top: 1px solid #f0f0f0;
  }

  .apply-link {
    color: #1995f5;
    text-decoration: none;
    font-family: 'Inter', sans-serif;

    &:hover {
      text-decoration: underline;
    }
  }

  .error {
    font-size: 1rem;
    font-family: 'Inter', sans-serif;
    color: #dc3545;
    margin-bottom: 1rem;
    padding: 1rem;
    background-color: #fee;
    border: 1px solid #fcc;
    border-radius: 8px;
    text-align: center;

    a {
      color: inherit;
      text-decoration: underline;
    }
  }

  .success {
    font-size: 1rem;
    font-family: 'Inter', sans-serif;
    color: #28a745;
    padding: 1rem;
    background-color: #efe;
    border: 1px solid #cfc;
    border-radius: 8px;
    margin-bottom: 1rem;
    text-align: center;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
  }
</style>
