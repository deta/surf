<script lang="ts">
  import { createEventDispatcher } from 'svelte'
  import icon from '../../assets/icon_512.png'
  import Button from './Button.svelte'

  const TERMS_URL = 'https://deta.surf/terms'
  const PRIVACY_URL = 'https://deta.surf/privacy'

  let error = ''
  let email = ''
  let acceptedTerms = false
  let showSkipConfirmation = false

  const dispatch = createEventDispatcher()

  // TODO: send email to backend
  const handleSubmitEmail = async () => {
    try {
      // @ts-ignore
      const res = await window.api.signup(email, 'beta-signup')
      if (!res.ok) {
        error = 'Sorry, we could not send the verification email.'
        console.error('could not send the verification email, res status: ', res.status)
        return
      }
      dispatch('setUserEmail', email)
    } catch (e) {
      console.error(e)
      error = `Sorry, we countered an error: ${e}`
    }
  }

  const handleSkip = () => {
    showSkipConfirmation = true
  }

  const confirmSkip = () => {
    dispatch('viewChange', 'persona')
  }

  const cancelSkip = () => {
    showSkipConfirmation = false
  }
</script>

<div class="container">
  <div class="content">
    <img class="surf-logo" src={icon} alt="Surf icon" />
    <h1 class="title">Welcome to Surf!</h1>

    {#if error}
      <p class="error">{error}</p>
    {/if}

    {#if showSkipConfirmation}
      <div class="confirmation-modal">
        <div class="modal-content">
          <h2 class="modal-title">Skip Email Verification?</h2>
          <p class="modal-message">
            If you skip verification, you'll need to set up your own AI provider to use AI features
            in Surf.
          </p>
          <div class="modal-links">
            <a on:click={cancelSkip}>Go Back</a>
            <a on:click={confirmSkip}>Continue Without Email</a>
          </div>
        </div>
      </div>
    {/if}

    <div class="info-section">
      <p class="info">
        Verify your email to get the best experience, or continue and set up your own API key for AI
        features.
      </p>
    </div>

    <form on:submit|preventDefault={handleSubmitEmail}>
      <input
        bind:value={email}
        class="invite-input"
        type="email"
        placeholder="Your Email (Optional)"
      />

      <div class="button-group">
        <div class="verify-button" class:centered={email}>
          <Button type="submit" disabled={!email || !acceptedTerms}>Verify Email</Button>
        </div>
        <div class="skip-button" class:fade-out={email}>
          <Button type="button" on:click={handleSkip}>Skip</Button>
        </div>
      </div>

      <div class="bottom">
        <label class="terms-checkbox">
          <input bind:checked={acceptedTerms} type="checkbox" required />
          <span class="terms-info">
            I agree to the <a href={TERMS_URL} target="_blank">Terms and Conditions</a> and
            <a href={PRIVACY_URL} target="_blank">Privacy Policy</a>.
          </span>
        </label>
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
    display: flex;
    flex-direction: column;
    align-items: center;
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

  .info-section {
    margin-bottom: 2rem;
  }

  .info {
    font-size: 1rem;
    font-family: 'Inter', sans-serif;
    color: rgba(0, 0, 0, 0.6);
    padding: 0 2rem;
    text-align: center;
    line-height: 1.5;
  }

  .invite-input {
    width: 100%;
    padding: 0.75rem;
    border: 1px solid #e0e0e0;
    border-radius: 8px;
    font-size: 16px;
    margin-bottom: 1.5rem;
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

  .button-group {
    display: flex;
    gap: 1rem;
    width: 100%;
    margin-bottom: 2rem;
    position: relative;
  }

  .verify-button {
    flex: 1;
    transition:
      transform 0.3s ease,
      flex 0.3s ease;

    &.centered {
      flex: 0 0 calc(50% - 0.5rem);
      transform: translateX(calc(50% + 0.5rem));
    }

    :global(button) {
      width: 100%;
    }
  }

  .skip-button {
    flex: 1;
    opacity: 1;
    transition:
      opacity 0.3s ease,
      transform 0.3s ease;

    :global(button) {
      width: 100%;
    }

    &.fade-out {
      opacity: 0;
      transform: scale(0.95);
      pointer-events: none;
    }
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

  .confirmation-modal {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  }

  .modal-content {
    background: white;
    border-radius: 12px;
    padding: 2rem;
    max-width: 28rem;
    width: 90%;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  }

  .modal-title {
    font-family: 'Gambarino-Display', sans-serif;
    font-size: 1.5rem;
    font-weight: 400;
    margin-bottom: 1rem;
    text-align: center;
  }

  .modal-message {
    font-family: 'Inter', sans-serif;
    font-size: 1rem;
    color: rgba(0, 0, 0, 0.7);
    line-height: 1.5;
    margin-bottom: 1.5rem;
    text-align: center;
  }

  .modal-links {
    display: flex;
    gap: 1rem;
    justify-content: center;

    :global(button) {
      flex: 1;
    }
  }
</style>
