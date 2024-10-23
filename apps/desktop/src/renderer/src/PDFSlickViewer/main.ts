import '@pdfslick/core/dist/pdf_viewer.css'
import '../assets/style.css'
import '../../../output.css'
import 'iconify-icon'
import PDF from './components/PDF.svelte'

const app = new PDF({
  target: document.getElementById('app')
})

export default app
