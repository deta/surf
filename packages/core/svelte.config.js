import { vitePreprocess } from '@sveltejs/vite-plugin-svelte'

export default {
  // Consult https://svelte.dev/docs#compile-time-svelte-preprocess
  // for more information about preprocessors
  preprocess: vitePreprocess({
    postCss: true
  }),

  onwarn: (warning, handler) => {
    if (warning.code.toLowerCase().includes('a11y')) return
    handler(warning)
  }
}
