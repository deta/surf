<script lang="ts">
  import { onMount } from 'svelte'

  const QUICK_LINKS = [
    {
      label: 'Study Plan',
      description: 'Your week, planned out',
      url: 'https://platform.acosta-ai.com/study-plan'
    },
    {
      label: 'Exam Simulator',
      description: 'Practise under real conditions',
      url: 'https://platform.acosta-ai.com/exam-simulator'
    }
  ]

  const FALLBACK_QUOTES = [
    'Small steps every day add up to big results.',
    'You don’t have to be perfect — you just have to keep going.',
    'Revision today is confidence tomorrow.',
    'Hard things become easy things with practice.',
    'Future you is watching. Make them proud.'
  ]

  let firstName = $state<string | null>(null)
  let focusSubject = $state<string | null>(null)
  let quote = $state<string>(FALLBACK_QUOTES[Math.floor(Math.random() * FALLBACK_QUOTES.length)])

  const hour = new Date().getHours()
  const timeGreeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'

  onMount(async () => {
    try {
      const auth = await window.acostaPage?.getAuthState()
      if (auth?.status === 'signed-in' && auth.user.displayName) {
        firstName = auth.user.displayName.split(' ')[0]
      }
    } catch {
      // greeting falls back to the plain version
    }

    try {
      const config = await window.acostaPage?.getUserConfig()
      focusSubject = config?.settings?.acosta?.todays_focus_subject ?? null
    } catch {
      focusSubject = null
    }

    void loadQuote()
  })

  /** One AI-generated quote per day, cached locally; falls back to built-ins. */
  async function loadQuote() {
    const today = new Date().toISOString().slice(0, 10)
    const cached = localStorage.getItem('acosta-daily-quote')
    if (cached) {
      try {
        const parsed = JSON.parse(cached) as { date: string; quote: string }
        if (parsed.date === today && parsed.quote) {
          quote = parsed.quote
          return
        }
      } catch {
        // bad cache — regenerate
      }
    }

    try {
      const response = await window.acostaPage?.apiRequest('POST', '/v1/chat/completions', {
        model: 'claude',
        messages: [
          {
            role: 'user',
            content:
              'Write one short, original motivational sentence for an Australian high school student about to start studying. No quotes around it, no attribution, under 20 words.'
          }
        ],
        max_tokens: 60
      })

      const data = response?.data as { choices?: { message?: { content?: string } }[] } | undefined
      const generated = data?.choices?.[0]?.message?.content?.trim()

      if (response?.ok && generated) {
        quote = generated
        localStorage.setItem('acosta-daily-quote', JSON.stringify({ date: today, quote }))
      }
    } catch {
      // fallback quote already set
    }
  }
</script>

<div class="acosta-page newtab-screen">
  <main class="content">
    <header>
      <div class="acosta-logomark" style="width: 44px; height: 44px; font-size: 24px">A</div>
      <h1>
        {timeGreeting}{firstName ? `, ${firstName}` : ''}
      </h1>
      {#if focusSubject}
        <p class="focus-subject">
          Today's focus: <strong>{focusSubject}</strong>
        </p>
      {/if}
    </header>

    <section class="quick-links">
      {#each QUICK_LINKS as link}
        <a class="acosta-card quick-link" href={link.url}>
          <span class="label">{link.label}</span>
          <span class="description">{link.description}</span>
        </a>
      {/each}
    </section>

    <footer>
      <p class="quote">“{quote}”</p>
      <p class="quote-attribution">— Acosta AI</p>
    </footer>
  </main>
</div>

<style>
  .newtab-screen {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100vh;
  }

  .content {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2.5rem;
    max-width: 560px;
    width: 100%;
    padding: 2rem;
  }

  header {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.75rem;
    text-align: center;
  }

  h1 {
    font-size: 2.2rem;
    font-weight: 700;
    margin: 0;
  }

  .focus-subject {
    color: var(--acosta-text-muted);
    margin: 0;
  }

  .focus-subject strong {
    color: var(--acosta-teal);
  }

  .quick-links {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
    width: 100%;
  }

  .quick-link {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    padding: 1.25rem 1.5rem;
    text-decoration: none;
    color: var(--acosta-text);
    transition:
      border-color 120ms ease,
      transform 120ms ease;
  }

  .quick-link:hover {
    border-color: var(--acosta-teal);
    transform: translateY(-2px);
  }

  .quick-link .label {
    font-family: var(--acosta-font-heading);
    font-weight: 600;
    font-size: 1.1rem;
  }

  .quick-link .description {
    color: var(--acosta-text-muted);
    font-size: 0.875rem;
  }

  footer {
    text-align: center;
  }

  .quote {
    font-family: var(--acosta-font-heading);
    font-size: 1.05rem;
    color: var(--acosta-text-muted);
    margin: 0;
    font-style: italic;
  }

  .quote-attribution {
    color: var(--acosta-text-faint);
    font-size: 0.8rem;
    margin: 0.4rem 0 0;
  }
</style>
