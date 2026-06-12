import '../assets/acosta.css'
import Blocked from './Blocked.svelte'
import { mount } from 'svelte'

const app = mount(Blocked, {
  target: document.getElementById('app')!
})

export default app
