import type { Config } from 'tailwindcss'
import plugin from 'tailwindcss/plugin'

const config: Config = {
  jit: true,
  content: [
    './src/**/*.{html,js,svelte,ts}',
    '../editor/src/**/*.{html,js,svelte,ts}',
    '../../app/src/renderer/**/*.{html,js,svelte,ts}'
  ],
  plugins: [
    require('@tailwindcss/typography'),
    plugin(({ addVariant }) => {
      addVariant(
        'prose-inline-code',
        '&.prose :where(:not(pre)>code):not(:where([class~="not-prose"] *))'
      )
    })
  ],
  darkMode: 'class',
  theme: {
    container: {
      center: true,
      padding: '2rem',
      screens: {
        '2xl': '1400px'
      }
    },
    extend: {
      fontFamily: {
        gambarino: ['Gambarino-Display', 'serif'],
        sn: ['SN Pro', 'sans-serif']
      },
      typography: ({ theme }) => ({
        DEFAULT: {
          css: {
            code: {
              backgroundColor: theme('colors.slate.100'),
              borderRadius: theme('borderRadius.sm'),
              paddingTop: theme('padding[1]'),
              paddingRight: theme('padding[1.5]'),
              paddingBottom: theme('padding[1]'),
              paddingLeft: theme('padding[1.5]')
            },
            'code::before': {
              content: 'normal'
            },
            'code::after': {
              content: 'normal'
            },
            // remove all styles from pre tag since our syntax highlighter will take care of it
            pre: {
              backgroundColor: 'transparent',
              padding: '0 !important',
              paddingInline: '0 !important',
              margin: '0 !important',
              border: '0'
            },
            'pre code': {
              padding: '1.5em !important'
            },
            blockquote: {
              fontWeight: false,
              fontStyle: false,
              color: 'var(--tw-prose-quotes)',
              borderInlineStartWidth: '0.25rem',
              borderInlineStartColor: 'var(--tw-prose-quote-borders)',
              quotes: '"\\201C""\\201D""\\2018""\\2019"'
            },
            'blockquote p:first-of-type::before': false,
            'blockquote p:last-of-type::after': false
          }
        }
      }),
      keyframes: {
        'border-width': {
          from: {
            width: '36px',
            opacity: '0',
            transform: 'scale(0.8)',
            filter: 'blur(4px)'
          },
          to: {
            width: '124px',
            opacity: '1',
            transform: 'scale(1)',
            filter: 'blur(0px)'
          }
        },
        tilt: {
          '0%, 50%, 100%': { transform: 'rotate(0deg)' },
          '25%': { transform: 'rotate(0.5deg)' },
          '75%': { transform: 'rotate(-0.5deg)' }
        },
        flash: {
          '0%': { opacity: '0.2' },
          '20%': { opacity: '1' },
          '100%': { opacity: '0.2' }
        },
        shimmer: {
          from: { backgroundPosition: '200% 0' },
          to: { backgroundPosition: '-200% 0' }
        },
        'text-shimmer': {
          from: { backgroundPosition: '0 0' },
          to: { backgroundPosition: '-200% 0' }
        },
        swing: {
          '15%': { transform: 'translateX(5px)' },
          '30%': { transform: 'translateX(-5px)' },
          '50%': { transform: 'translateX(3px)' },
          '80%': { transform: 'translateX(2px)' },
          '100%': { transform: 'translateX(0)' }
        }
      },
      animation: {
        tilt: 'tilt 10s infinite linear',
        flash: 'flash 1.4s infinite linear',
        shimmer: 'shimmer 8s ease-in-out infinite',
        'text-shimmer': 'text-shimmer 2.5s ease-out infinite alternate',
        swing: 'swing 1s ease 1'
      }
    }
  }
}

export default config
