<script lang="ts">
  import { createEventDispatcher } from 'svelte'
  import icon from '../../assets/icon_512.png'
  import Button from './Button.svelte'

  const dispatch = createEventDispatcher()

  const REQUEST_INVITE_URL = 'https://deta.surf'
  const TERMS_URL = 'https://deta.surf/terms'
  const PRIVACY_URL = 'https://deta.surf/privacy'

  let state = 'invite'
  let inviteCode = ''
  let resendInviteEmail = ''
  let resentEmail = false
  let acceptedTerms = false
  let loading = false
  let error = ''
  let highlightRequestNewCode = false

  const sanitize = (input: string): string => {
    return input.trim()
  }

  const toggleResendState = () => {
    state = state === 'invite' ? 'resend' : 'invite'
    error = ''
    resentEmail = false
    loading = false
    resendInviteEmail = ''
    highlightRequestNewCode = false
  }

  const handleSubmitInvite = async () => {
    try {
      loading = true

      const res = await window.api.activateAppUsingKey(sanitize(inviteCode), acceptedTerms)
      if (!res.ok) {
        highlightRequestNewCode = true
        error = 'Sorry, the invite code is invalid.'
        switch (res.status) {
          case 409:
            error = 'Sorry, the invite code has already been used.'
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

  const handleSubmitResend = async () => {
    try {
      loading = true
      const res = await window.api.resendInviteCode(sanitize(resendInviteEmail))
      if (!res.ok) {
        const detail = res.data.detail || 'unexpected error'
        error = `Sorry, we countered an error: ${detail}`
        return
      }
      resentEmail = true
    } catch (e) {
      console.error(e)
      error = `Sorry, we countered an error: ${e}`
    } finally {
      loading = false
    }
  }
</script>

<div class="container">
  <div class="content">
    <img class="surf-logo" src={icon} alt="Surf icon" />
    <h1 class="title">
      {#if state === 'invite'}
        Welcome to Surf!
      {:else}
        Request Invite Code
      {/if}
    </h1>

    {#if error}
      <p class="error">
        {error}
        <a href="#" on:click|preventDefault={toggleResendState}> Request for a new code.</a>
      </p>
      <p class="info">Send us an email (<i>hello@deta.surf</i>) if the issue persists.</p>
    {/if}

    {#if state === 'invite'}
      <form on:submit|preventDefault={handleSubmitInvite}>
        <input
          bind:value={inviteCode}
          class="invite-input"
          placeholder="Enter your Invite Code"
          required
        />

        <p class="info">
          Surf is under active development — you need to be part of our early access program to use
          it.
        </p>

        <p class="code-links">
          <a
            href="#"
            on:click|preventDefault={toggleResendState}
            class={`apply-link ${highlightRequestNewCode ? 'highlight' : ''}`}
          >
            Request for a new code
          </a>
          <br />
          <a href={REQUEST_INVITE_URL} target="_blank" class="apply-link"
            >Apply for our early access program</a
          >
        </p>

        <div class="bottom">
          <label class="terms-checkbox">
            <input bind:checked={acceptedTerms} type="checkbox" required />
            <span class="terms-info">
              I agree to the <a href={TERMS_URL} target="_blank">Terms and Conditions</a> and
              <a href={PRIVACY_URL} target="_blank">Privacy Policy</a>.
            </span>
          </label>

          <div class="button-warpper">
            <Button type="submit" disabled={loading}>
              {loading ? 'Checking Invite…' : 'Get Started'}
            </Button>
          </div>
        </div>
      </form>
    {:else}
      <form on:submit|preventDefault={handleSubmitResend}>
        <p class="info">Please enter your email address you used for Surf's waitlist.</p>
        <input
          type="email"
          bind:value={resendInviteEmail}
          class="invite-input"
          placeholder="Enter your email"
          disabled={resentEmail}
          required
        />
        {#if resentEmail}
          <p class="info" style="color: green">
            Thank you, you will receive an email from us shortly (if you have access).
          </p>
          <p class="info">
            Please send us an email (<i>hello@deta.surf</i>) for any issues.
          </p>
          <p class="info">
            <a href="#" on:click|preventDefault={toggleResendState} class="apply-link">Go back</a>
          </p>
        {/if}

        <div class="bottom">
          <div class="button-warpper">
            <Button type="submit" disabled={loading || resentEmail}>
              {loading ? 'Requesting...' : 'Request Invite Code'}
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

  .code-links {
    font-size: 1.1rem;
    font-family: 'Inter', sans-serif;
    color: rgba(0, 0, 0, 0.5);
    margin-bottom: 1rem;
    padding: 0 4rem;
    text-align: center;
  }

  .apply-link {
    color: #1995f5;
  }

  .apply-link:hover {
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

    a {
      color: inherit;
      text-decoration: underline;
    }
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

  .highlight {
    padding: 0.25rem 0.5rem;
    background-color: #ffcdd2;
    border-radius: 4px;
  }
</style>
