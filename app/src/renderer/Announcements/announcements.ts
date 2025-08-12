import '../assets/style.css'
import '../assets/fonts/Bayshore.woff2'
import '../assets/fonts/Bayshore.woff'
import '../assets/fonts/Gambarino-Regular.woff'
import '../assets/fonts/Gambarino-Regular.woff2'
import '@deta/ui/src/output.css'
import '@deta/ui/src/app.css'
import Announcements from './Announcements.svelte'
import { mount } from 'svelte'

const app = mount(Announcements, {
  target: document.getElementById('app')
})

export default app
