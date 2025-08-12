import '@pdfslick/core/dist/pdf_viewer.css'
import '../assets/style.css'
import '../../../output.css'
import 'iconify-icon'
import PDF from './components/PDF.svelte'
import { mount } from 'svelte'

const app = mount(PDF, {
  target: document.getElementById('app')
})

export default app
