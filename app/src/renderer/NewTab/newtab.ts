import '../assets/acosta.css'
import NewTab from './NewTab.svelte'
import { mount } from 'svelte'

const app = mount(NewTab, {
  target: document.getElementById('app')!
})

export default app
