import './assets/style.css'
import Updates from './Updates.svelte'
import { mount } from 'svelte'

const app = mount(Updates, {
  target: document.getElementById('app')
})

export default app
