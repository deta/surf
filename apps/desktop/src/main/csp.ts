const CSP_BACKEND_API = import.meta.env.P_VITE_API_BASE ?? 'https://deta.space'
const CSP_OPEN_AI = import.meta.env.P_VITE_OPEN_AI_API_ENDPOINT ?? 'https://api.openai.com'

const CSP_DIRECTIVES = [
  // Only allow resources to be loaded from the same origin (domain)
  "default-src 'self'",

  // Allow scripts from same origin, inline scripts, eval(), and blob: URLs
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' blob:",

  // Allow styles from same origin and inline styles
  "style-src 'self' 'unsafe-inline'",

  // Allow images from same origin, data: URLs, and any HTTPS source (needed for tab favicons and resource previews)
  "img-src 'self' surf: data: blob: https:",

  // Allow object-src from same origin and blob: URLs (needed for PDF previews)
  "object-src 'self' blob:",

  // Allow frames from same origin and blob: URLs (needed for PDF previews)
  "frame-src 'self' blob:",

  // Allow media content from same origin and blob: URLs (needed for video previews)
  "media-src 'self' blob:",

  // Allow connections to same origin, localhost (HTTP/WS), and specific APIs
  `connect-src 'self' surf: http://localhost:* ws://localhost:* https://*.sentry.io https://*.amplitude.com ${CSP_BACKEND_API} ${CSP_OPEN_AI}`,

  // Allow web workers from same origin and blob: URLs
  "worker-src 'self' blob:"
]

export const applyCSPToSession = (session: Electron.Session) => {
  session.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [CSP_DIRECTIVES.join('; ')]
      }
    })
  })
}
