import '../assets/style.css'
import '../assets/fonts/Bayshore.woff2'
import '../assets/fonts/Bayshore.woff'
import '../assets/fonts/Gambarino-Regular.woff'
import '../assets/fonts/Gambarino-Regular.woff2'
import '@deta/ui/src/output.css'
import '@deta/ui/src/app.css'
import '@horizon/core/src/output.css'
import '@horizon/core/src/lib/components/index.scss'
import Setup from './Setup.svelte'
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

const app = mount(Setup, {
  target: document.getElementById('app')
})

export default app
