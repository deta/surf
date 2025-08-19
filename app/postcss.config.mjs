import tailwindcss from 'tailwindcss'
import autoprefixer from 'autoprefixer'
import electronCornerSmoothing from '../packages/ui/postcss-plugins/electron-corner-smoothing.mjs'

export default {
  plugins: [
    tailwindcss(),
    autoprefixer(),
    electronCornerSmoothing({ value: '60%' })
  ]
}
