import './assets/style.css'
import './assets/fonts/Bayshore.woff2'
import './assets/fonts/Bayshore.woff'
import './assets/fonts/Gambarino-Regular.woff'
import './assets/fonts/Gambarino-Regular.woff2'
import '../../output.css'
import '../../../../../packages/core/src/output.css'
import Announcements from './Announcements.svelte'
import { mount } from 'svelte'

const app = mount(Announcements, {
  target: document.getElementById('app')
})

export default app
