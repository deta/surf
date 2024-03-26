import './assets/style.css'
import Setup from './Setup.svelte'

import * as Sentry from '@sentry/svelte'

if (import.meta.env.PROD) {
  Sentry.init({
    dsn: 'https://d6ab0c4c00ed18d67a871936fae6f80a@us.sentry.io/4506695995490304',
    integrations: [
      new Sentry.BrowserTracing(),
      Sentry.replayIntegration({
        maskAllText: false,
        blockAllMedia: false
      })
    ],
    // Performance Monitoring
    tracesSampleRate: 1.0, //  Capture 100% of the transactions
    // Session Replay
    replaysSessionSampleRate: 0.1, // This sets the sample rate at 10%, change to 1 in development if needed
    replaysOnErrorSampleRate: 1.0 // If you're not already sampling the entire session, change the sample rate to 100% when sampling sessions where errors occur.
  })
}

const app = new Setup({
  target: document.getElementById('app')
})

export default app
