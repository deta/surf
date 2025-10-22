import { sveltekit } from '@sveltejs/kit/vite'
import { plugin as Markdown, Mode } from 'vite-plugin-markdown'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [Markdown({ mode: [Mode.MARKDOWN, Mode.HTML] }), sveltekit()]
})
