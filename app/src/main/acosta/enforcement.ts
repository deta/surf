import { app, session, type WebContents } from 'electron'
import { useLogScope } from '@deta/utils'
import { getWebRequestManager } from '../webRequestManager'
import { useAcostaContentFilter, buildBlockPageURL } from './contentFilter'
import { useAcostaFocusMode } from './focusMode'
import { enforceSafeSearch } from './safeSearch'

const log = useLogScope('AcostaEnforcement')

/** The session partition that hosts all student-visible web content. */
export const WEB_CONTENT_PARTITION = 'persist:horizon'

/**
 * Wires content filtering and safe search into the web content session.
 *
 * Three layers:
 * 1. onBeforeRequest — synchronous blocklist verdicts. Main frames get
 *    redirected to the branded block page; subresources are cancelled.
 * 2. did-start-navigation — asynchronous AI URL screening
 *    (api.acosta.ai/content-check). If the verdict comes back unsafe the view
 *    is redirected to the block page. Fails open when the endpoint is
 *    unreachable, leaving layer 1 as the safety net.
 * 3. Safe search enforcement (see safeSearch.ts).
 */
export function setupAcostaEnforcement(): void {
  const contentFilter = useAcostaContentFilter()
  const focusMode = useAcostaFocusMode()
  const webRequestManager = getWebRequestManager()
  const webSession = session.fromPartition(WEB_CONTENT_PARTITION)

  webRequestManager.addBeforeRequest(webSession, (details, callback) => {
    const verdict = contentFilter.checkUrlSync(details.url)
    if (!verdict.blocked) return callback({})

    if (details.resourceType === 'mainFrame') {
      callback({
        redirectURL: buildBlockPageURL({
          url: details.url,
          reason: verdict.reason ?? 'This site is not available on Acosta Browse.',
          source: verdict.source ?? 'blocklist',
          category: verdict.category
        })
      })
    } else {
      callback({ cancel: true })
    }
  })

  enforceSafeSearch(WEB_CONTENT_PARTITION)

  // Layer 2: AI screening + focus session stats, attached per web contents
  app.on('web-contents-created', (_event, webContents) => {
    // Only screen actual web content, not browser chrome or internal pages
    if (webContents.session !== webSession) return
    attachNavigationScreening(webContents)
  })

  contentFilter.initialize().catch((err) => log.error('Content filter init failed:', err))
  void focusMode // instantiated so session state survives even with no renderer attached
}

function attachNavigationScreening(webContents: WebContents): void {
  const contentFilter = useAcostaContentFilter()
  const focusMode = useAcostaFocusMode()

  webContents.on('did-start-navigation', (details) => {
    if (!details.isMainFrame || details.isSameDocument) return

    const url = details.url
    if (!url.startsWith('http')) return

    contentFilter
      .checkUrl(url)
      .then((verdict) => {
        if (!verdict.blocked || webContents.isDestroyed()) return
        // Verdict may arrive after the page started rendering; pull the view
        // away to the block page either way.
        log.log(`Blocking navigation to ${url}: ${verdict.reason}`)
        webContents
          .loadURL(
            buildBlockPageURL({
              url,
              reason: verdict.reason ?? 'This site is not available on Acosta Browse.',
              source: verdict.source ?? 'ai',
              category: verdict.category
            })
          )
          .catch(() => {})
      })
      .catch((err) => log.warn('Navigation screening failed (allowing):', err))
  })

  webContents.on('did-navigate', (_event, url) => {
    if (url.startsWith('http')) focusMode.recordPageVisit()
  })
}
