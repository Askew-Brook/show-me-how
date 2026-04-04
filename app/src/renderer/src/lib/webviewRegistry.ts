export type WebviewLike = HTMLElement & {
  src: string
  canGoBack?: () => boolean
  canGoForward?: () => boolean
  goBack?: () => void
  goForward?: () => void
  reload?: () => void
  executeJavaScript: <T = unknown>(code: string, userGesture?: boolean) => Promise<T>
  addEventListener: (type: string, listener: EventListenerOrEventListenerObject) => void
  removeEventListener: (type: string, listener: EventListenerOrEventListenerObject) => void
}

const registry = new Map<string, WebviewLike>()

export function registerWebview(panelId: string, element: WebviewLike) {
  registry.set(panelId, element)
}

export function unregisterWebview(panelId: string) {
  registry.delete(panelId)
}

export function getWebview(panelId: string) {
  return registry.get(panelId)
}
