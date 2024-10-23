import '@pdfslick/core/dist/pdf_viewer.css'
import PDF from './PDF.svelte'

const app = new PDF({
  target: document.getElementById('app')
})

export default app
