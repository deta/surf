import './assets/style.css'
import './assets/fonts/Bayshore.woff2'
import './assets/fonts/Bayshore.woff'
import './assets/fonts/Gambarino-Regular.woff'
import './assets/fonts/Gambarino-Regular.woff2'
import '../../output.css'
import '../../../../../packages/core/src/output.css'
import '../../../../../packages/core/src/lib/components/index.scss'
import Overlay from './Overlay.svelte'

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

const app = new Overlay({
  target: document.getElementById('app')
})

export default app
