import type { Config } from 'tailwindcss'

const config: Config = {
  jit: true,
  content: ['./src/**/*.{html,js,svelte,ts}'],
  theme: {
    container: {
      center: true,
      padding: '2rem',
      screens: {
        '2xl': '1400px'
      }
    },
    extend: {
      keyframes: {
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
