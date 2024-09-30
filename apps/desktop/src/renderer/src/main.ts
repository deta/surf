import './assets/style.css'
import App from './App.svelte'

/*
import * as Sentry from '@sentry/electron/renderer'
import { init as svelteInit } from '@sentry/svelte'

const sentryDSN = import.meta.env.R_VITE_SENTRY_DSN
if (sentryDSN) {
  Sentry.init(
    {
      dsn: sentryDSN,
      enableTracing: true,
      autoSessionTracking: false
    },
    svelteInit
  )
}
*/

const app = new App({
  target: document.getElementById('app')
})

export default app
