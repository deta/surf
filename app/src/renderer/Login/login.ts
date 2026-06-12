import '../assets/acosta.css'
import Login from './Login.svelte'
import { mount } from 'svelte'

const app = mount(Login, {
  target: document.getElementById('app')!
})

export default app
