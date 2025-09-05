<script lang="ts">
  import { createEventDispatcher } from 'svelte'
  import icon from '../../assets/icon_512.png'
  import Button from './Button.svelte'

  const TERMS_URL = 'https://deta.surf/terms'
  const PRIVACY_URL = 'https://deta.surf/privacy'

  let error = ''
  let email = ''
  let acceptedTerms = false

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
</script>

<div class="container">
  <div class="content">
    <img class="surf-logo" src={icon} alt="Surf icon" />
    <h1 class="title">Welcome to Surf!</h1>

    {#if error}
      <p class="error">{error}</p>
    {/if}

    <form on:submit|preventDefault={handleSubmitEmail}>
      <input
        bind:value={email}
        class="invite-input"
        type="email"
        placeholder="Your Email"
        required
      />

      <div class="details">
        <p class="info text-md">
          We need to verify your email address to provide you the best experience with Surf.
        </p>
      </div>

      <div class="skip-link">
        <p class="info">
          <a href="#" on:click|preventDefault={() => dispatch('viewChange', 'invite')}>
            Already verified your email?
          </a>
        </p>
      </div>

      <div class="bottom">
        <label class="terms-checkbox">
          <input bind:checked={acceptedTerms} type="checkbox" required />
          <span class="terms-info">
            I agree to the <a href={TERMS_URL} target="_blank">Terms and Conditions</a> and
            <a href={PRIVACY_URL} target="_blank">Privacy Policy</a>.
          </span>
        </label>

        <div class="button-warpper">
          <Button type="submit">Request Verification</Button>
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
    font-size: 1rem;
    font-family: 'Inter', sans-serif;
    color: red;
    margin-bottom: 1rem;
    padding: 0 4rem;
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

  .skip-link {
    color: #1995f5;
  }

  .skip-link:hover {
    text-decoration: underline;
  }
</style>
