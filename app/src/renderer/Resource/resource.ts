import '../assets/style.css'
import '../assets/fonts/Bayshore.woff2'
import '../assets/fonts/Bayshore.woff'
import '../assets/fonts/Gambarino-Regular.woff'
import '../assets/fonts/Gambarino-Regular.woff2'
import '@deta/ui/src/output.css'
import '@deta/ui/src/app.css'
import Resource from './Resource.svelte'
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

const app = mount(Resource, {
  target: document.getElementById('app')
})

export default app
