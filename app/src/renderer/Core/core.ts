import '../assets/style.css'
import '../../app.css'
import App from './Core.svelte'
import { mount } from 'svelte'

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

const app = mount(App, {
  target: document.getElementById('app')
})

export default app
