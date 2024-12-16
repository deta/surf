<script lang="ts">
  import { createEventDispatcher } from 'svelte'
  import icon from '../../assets/icon_512.png'
  import Button from './Button.svelte'

  const dispatch = createEventDispatcher()

  const REQUEST_INVITE_URL = 'https://deta.surf/'
  const TERMS_URL = 'https://deta.surf/terms'
  const PRIVACY_URL = 'https://deta.surf/privacy'

  let inviteCode = ''
  let acceptedTerms = false
  let loading = false
  let error = ''

  const handleSubmit = async () => {
    try {
      loading = true

      const data = await window.api.activateAppUsingKey(inviteCode, acceptedTerms)

      if (!data) {
        error = 'Invalid invite code.'
        return
      }
      dispatch('viewChange', 'persona')
    } catch (e) {
      console.error(e)
      error = 'Failed to check invite code, please try again.'
    } finally {
      loading = false
    }
  }
</script>

<div class="container">
  <div class="content">
    <img class="surf-logo" src={icon} alt="Surf icon" />
    <h1 class="title">Welcome to Surf!</h1>

    <form on:submit|preventDefault={handleSubmit}>
      <input
        bind:value={inviteCode}
        class="invite-input"
        placeholder="Enter your Invite Code"
        required
      />

      <p class="info">
        Surf is under active development — you need to be part of our early access program to use
        it. No invite code? <a href={REQUEST_INVITE_URL} class="apply-link">Apply here</a>.
      </p>

      <div class="bottom">
        <label class="terms-checkbox">
          <input bind:checked={acceptedTerms} type="checkbox" required />
          <span class="terms-info">
            I agree to the <a href={TERMS_URL} target="_blank">Terms and Conditions</a> and
            <a href={PRIVACY_URL} target="_blank">Privacy Policy</a>.
          </span>
        </label>

        {#if error}
          <p class="error">{error}</p>
        {/if}

        <div class="button-warpper">
          <Button type="submit" disabled={loading}>
            {loading ? 'Checking Invite…' : 'Get Started'}
          </Button>
        </div>
      </div>
    </form>
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
    color: red;
    font-size: 14px;
    margin-bottom: 1rem;
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
