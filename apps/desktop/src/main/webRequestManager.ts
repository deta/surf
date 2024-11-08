let webRequestManager: WebRequestManager | null = null

export function getWebRequestManager(): WebRequestManager {
  if (!webRequestManager) webRequestManager = new WebRequestManager()
  return webRequestManager
}

type BeforeRequestCallback = (
  details: Electron.OnBeforeRequestListenerDetails,
  callback: (response: Electron.CallbackResponse) => void
) => void

type BeforeSendHeadersCallback = (
  details: Electron.OnBeforeSendHeadersListenerDetails,
  callback: (response: Electron.BeforeSendResponse) => void
) => void

type HeadersReceivedCallback = (
  details: Electron.OnHeadersReceivedListenerDetails,
  callback: (response: Electron.HeadersReceivedResponse) => void
) => void

class WebRequestManager {
  private beforeRequest = new Map<Electron.Session, BeforeRequestCallback[]>()
  private beforeSendHeaders = new Map<Electron.Session, BeforeSendHeadersCallback[]>()
  private headersReceived = new Map<Electron.Session, HeadersReceivedCallback[]>()

  register(session: Electron.Session) {
    if (this.beforeRequest.has(session)) return

    this.beforeRequest.set(session, [])
    this.beforeSendHeaders.set(session, [])
    this.headersReceived.set(session, [])

    session.webRequest.onBeforeRequest((details, callback) => {
      const handlers = this.beforeRequest.get(session)!
      if (handlers.length === 0) return callback({})

      let response = {}
      for (const handler of handlers) {
        handler(details, (res) => {
          response = { ...response, ...res }
          if (res.cancel || res.redirectURL) return
        })
      }
      callback(response)
    })

    session.webRequest.onBeforeSendHeaders((details, callback) => {
      const handlers = this.beforeSendHeaders.get(session)!
      if (handlers.length === 0) return callback({})

      const currentDetails = { ...details }
      const response: Electron.BeforeSendResponse = {
        requestHeaders: details.requestHeaders ? { ...details.requestHeaders } : {}
      }

      for (const handler of handlers) {
        handler(currentDetails, (res) => {
          if (res.requestHeaders) {
            response.requestHeaders = { ...response.requestHeaders, ...res.requestHeaders }
          }
          response.cancel = res.cancel || response.cancel
          if (currentDetails.requestHeaders && response.requestHeaders) {
            currentDetails.requestHeaders = Object.fromEntries(
              Object.entries(response.requestHeaders).map(([k, v]) => [k, [v].flat().join(' ')])
            )
          }
        })
        if (response.cancel) break
      }
      callback(response)
    })

    session.webRequest.onHeadersReceived((details, callback) => {
      const handlers = this.headersReceived.get(session)!
      if (handlers.length === 0) return callback({})

      const currentDetails = { ...details }
      const response: Electron.HeadersReceivedResponse = {
        responseHeaders: details.responseHeaders ? { ...details.responseHeaders } : {}
      }

      for (const handler of handlers) {
        handler(currentDetails, (res) => {
          if (res.responseHeaders) {
            response.responseHeaders = { ...response.responseHeaders, ...res.responseHeaders }
          }
          response.statusLine = res.statusLine || response.statusLine
          response.cancel = res.cancel || response.cancel
          if (currentDetails.responseHeaders && response.responseHeaders) {
            currentDetails.responseHeaders = Object.fromEntries(
              Object.entries(response.responseHeaders).map(([k, v]) => [k, [v].flat()])
            )
          }
          if (response.statusLine) {
            currentDetails.statusLine = response.statusLine
          }
        })
        if (response.cancel) break
      }
      callback(response)
    })
  }

  addBeforeRequest(session: Electron.Session, handler: BeforeRequestCallback) {
    this.register(session)
    this.beforeRequest.get(session)!.push(handler)
    return () => this.removeBeforeRequest(session, handler)
  }

  addBeforeSendHeaders(session: Electron.Session, handler: BeforeSendHeadersCallback) {
    this.register(session)
    this.beforeSendHeaders.get(session)!.push(handler)
    return () => this.removeBeforeSendHeaders(session, handler)
  }

  addHeadersReceived(session: Electron.Session, handler: HeadersReceivedCallback) {
    this.register(session)
    this.headersReceived.get(session)!.push(handler)
    return () => this.removeHeadersReceived(session, handler)
  }

  private removeBeforeRequest(session: Electron.Session, handler: BeforeRequestCallback) {
    const handlers = this.beforeRequest.get(session)
    if (handlers) {
      const index = handlers.indexOf(handler)
      if (index !== -1) handlers.splice(index, 1)
    }
  }

  private removeBeforeSendHeaders(session: Electron.Session, handler: BeforeSendHeadersCallback) {
    const handlers = this.beforeSendHeaders.get(session)
    if (handlers) {
      const index = handlers.indexOf(handler)
      if (index !== -1) handlers.splice(index, 1)
    }
  }

  private removeHeadersReceived(session: Electron.Session, handler: HeadersReceivedCallback) {
    const handlers = this.headersReceived.get(session)
    if (handlers) {
      const index = handlers.indexOf(handler)
      if (index !== -1) handlers.splice(index, 1)
    }
  }
}
