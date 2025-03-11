<script lang="ts">
  import { createEventDispatcher } from 'svelte'
  import type { Readable } from 'svelte/store'
  import icon from '../../assets/icon_512.png'
  import Button from './Button.svelte'

  const dispatch = createEventDispatcher()

  export let emailStore: Readable<string>

  let showCodeInput = false
  let allowResend = false
  let resentEmail = false
  let loading = false
  let error = ''
  let inviteCode = ''

  export const submitInviteCode = (code: string) => {
    inviteCode = code
    showCodeInput = false
    handleSubmitInvite()
  }

  const sanitize = (input: string): string => {
    return input.trim()
  }

  const resendVerificationEmail = async () => {
    try {
      // TODO: send email to backend
      /*
      loading = true
      const res = await window.api.resendVerificationEmail(email)
      if (!res.ok) {
        error = 'Sorry, we could not resend the verification email.'
        return
      }
      */
      resentEmail = true
    } catch (e) {
      console.error(e)
      error = `Sorry, we countered an error: ${e}`
    } finally {
      loading = false
    }
  }

  const handleSubmitInvite = async () => {
    try {
      loading = true

      const res = await window.api.activateAppUsingKey(sanitize(inviteCode), true)
      if (!res.ok) {
        error = 'Sorry, the invite code is invalid.'
        switch (res.status) {
          case 409:
            error = 'Sorry, the invite code has already been used.'
            allowResend = true
            break
          default:
            error = 'Sorry, the invite code is invalid.'
            break
        }
        return
      }
      dispatch('viewChange', 'persona')
    } catch (e) {
      console.error(e)
      error = `Sorry, we countered an error: ${e}`
    } finally {
      loading = false
    }
  }

  const toggleShowCodeInput = () => {
    showCodeInput = !showCodeInput
  }
</script>

<div class="container">
  <div class="content">
    <img class="surf-logo" src={icon} alt="Surf icon" />
    <h1 class="title">Welcome to Surf!</h1>

    {#if error}
      <p class="error">{error}</p>
      <p class="info">Send us an email (<i>hello@deta.surf</i>) if the issue persists.</p>
    {/if}

    {#if !error}
      <p class="info">
        Open the link in your email ({$emailStore}) to verify your email address.
      </p>
    {/if}

    <div class="links">
      {#if !resentEmail}
        <a href="#" on:click|preventDefault={resendVerificationEmail} class="apply-link">
          Resend verification email
        </a>
      {:else}
        <p class="success">Verification email resent!</p>
      {/if}

      {#if !showCodeInput}
        <a href="#" on:click|preventDefault={toggleShowCodeInput} class="apply-link">
          Enter activation code manually
        </a>
      {/if}
    </div>

    {#if showCodeInput}
      <form on:submit|preventDefault={handleSubmitInvite}>
        <input
          bind:value={inviteCode}
          class="invite-input"
          placeholder="Enter your Invite Code"
          required
        />

        <div class="bottom">
          <div class="button-warpper">
            <Button type="submit" disabled={loading}>
              {loading ? 'Checking Invite…' : 'Get Started'}
            </Button>
          </div>
        </div>
      </form>
    {/if}
  </div>
</div>

<style lang="scss">
  .container {
    display: flex;
    justify-content: center;
    align-items: center;
    width: 100%;
  }

  .content {
    padding: 0 9rem 9rem 9rem;
    text-align: center;
    width: 100%;
    max-width: 52rem;
    margin: 0 auto;
  }

  .surf-logo {
    width: 15rem;
    height: 15rem;
    margin-bottom: 1rem;
  }

  .title {
    font-family: 'Gambarino-Display', sans-serif;
    font-size: 2rem;
    font-weight: 400;
    margin-bottom: 2rem;
  }

  .invite-input {
    width: 100%;
    padding: 0.75rem;
    border: 1px solid #e0e0e0;
    border-radius: 8px;
    font-size: 16px;
    margin-bottom: 1rem;
    text-align: center;
    font-family: monospace;
    letter-spacing: 0.05em;

    &::placeholder {
      text-align: center;
      font-family: 'Inter', sans-serif;
      letter-spacing: 0;
    }

    &:focus {
      outline: 4px solid rgba(36, 159, 252, 0.5);
      outline-offset: 0;
    }
  }

  .button-wrapper {
    display: flex;
    justify-content: center;
  }

  .info {
    font-size: 1rem;
    font-family: 'Inter', sans-serif;
    color: rgba(0, 0, 0, 0.5);
    margin-bottom: 1rem;
    padding: 0 4rem;
    text-align: center;
  }

  .links {
    font-size: 1rem;
    font-family: 'Inter', sans-serif;
    color: rgba(0, 0, 0, 0.5);
    padding: 1rem;
    text-align: center;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .apply-link {
    color: inherit;
    text-decoration: underline;
  }

  .bottom {
    position: fixed;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    bottom: 3rem;
    left: 50%;
    transform: translateX(-50%);
  }

  .terms-info {
    color: rgba(0, 0, 0, 0.5);
  }

  .terms-checkbox {
    display: flex;
    align-items: center;
    margin-bottom: 1rem;

    input {
      margin-right: 0.5rem;
    }

    a {
      color: inherit;
      text-decoration: underline;
    }
  }

  .error {
    font-size: 1rem;
    font-family: 'Inter', sans-serif;
    color: red;
    margin-bottom: 1rem;
    padding: 0 4rem;
    text-align: center;
  }

  .success {
    font-size: 1rem;
    font-family: 'Inter', sans-serif;
    color: green;
    padding: 0 4rem;
    margin-bottom: 0;
    text-align: center;
  }

  .submit-button {
    width: 100%;
    padding: 0.75rem;
    background-color: #007bff;
    color: white;
    border: none;
    border-radius: 8px;
    font-size: 16px;

    &:disabled {
      background-color: #ccc;
      cursor: not-allowed;
    }
  }
</style>
