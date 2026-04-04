import { getWebview } from './webviewRegistry'

function requireWebview(panelId: string) {
  const webview = getWebview(panelId)
  if (!webview) {
    throw new Error(`Browser panel not mounted: ${panelId}`)
  }
  return webview
}

function waitForEvent(panelId: string, eventName: string, timeoutMs: number) {
  const webview = requireWebview(panelId)

  return new Promise<void>((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      cleanup()
      reject(new Error(`${eventName} timed out after ${timeoutMs}ms`))
    }, timeoutMs)

    const handler = () => {
      cleanup()
      resolve()
    }

    const cleanup = () => {
      window.clearTimeout(timeout)
      webview.removeEventListener(eventName, handler)
    }

    webview.addEventListener(eventName, handler)
  })
}

export async function waitForLoad(panelId: string, timeoutMs: number) {
  const webview = requireWebview(panelId)
  const src = webview.src
  if (!src) return
  await waitForEvent(panelId, 'did-finish-load', timeoutMs)
}

export async function waitForText(panelId: string, text: string, timeoutMs: number) {
  const webview = requireWebview(panelId)
  const start = Date.now()

  while (Date.now() - start < timeoutMs) {
    const found = await webview.executeJavaScript<boolean>(`
      (() => {
        const text = ${JSON.stringify(text)}
        const body = document.body?.innerText || ''
        return body.includes(text)
      })()
    `)

    if (found) {
      return
    }

    await new Promise((resolve) => window.setTimeout(resolve, 150))
  }

  throw new Error(`Timed out waiting for text: ${text}`)
}

export async function clickText(panelId: string, text: string) {
  const webview = requireWebview(panelId)

  const result = await webview.executeJavaScript<{ ok: boolean; error?: string; clickedText?: string }>(`
    (() => {
      const target = ${JSON.stringify(text)}
      const normalize = (value) => (value || '').replace(/\s+/g, ' ').trim()
      const visible = (el) => {
        const rect = el.getBoundingClientRect()
        const style = window.getComputedStyle(el)
        return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden'
      }
      const getText = (el) => {
        if (el instanceof HTMLInputElement) {
          return el.value || el.getAttribute('aria-label') || ''
        }
        return el.innerText || el.textContent || ''
      }
      const candidates = Array.from(document.querySelectorAll('button, a, input[type="button"], input[type="submit"], [role="button"]')).filter((el) => visible(el))
      const normalizedTarget = normalize(target)
      const exact = candidates.filter((el) => normalize(getText(el)) === normalizedTarget)
      const ci = candidates.filter((el) => normalize(getText(el)).toLowerCase() === normalizedTarget.toLowerCase())
      const partial = candidates.filter((el) => normalize(getText(el)).toLowerCase().includes(normalizedTarget.toLowerCase()))
      const matches = exact.length ? exact : ci.length ? ci : partial.length === 1 ? partial : []
      if (matches.length !== 1) {
        return { ok: false, error: matches.length === 0 ? 'No matching clickable element found' : 'Ambiguous clickable text match' }
      }
      const match = matches[0]
      match.click()
      return { ok: true, clickedText: normalize(getText(match)) }
    })()
  `)

  if (!result.ok) {
    throw new Error(result.error || `Failed to click text: ${text}`)
  }

  return result.clickedText ?? text
}

export async function typeText(panelId: string, targetText: string, value: string) {
  const webview = requireWebview(panelId)

  const result = await webview.executeJavaScript<{ ok: boolean; error?: string }>(`
    (() => {
      const targetText = ${JSON.stringify(targetText)}
      const value = ${JSON.stringify(value)}
      const normalize = (v) => (v || '').replace(/\s+/g, ' ').trim().toLowerCase()
      const findByLabel = () => {
        const labels = Array.from(document.querySelectorAll('label'))
        for (const label of labels) {
          const text = normalize(label.innerText || label.textContent || '')
          if (!text.includes(normalize(targetText))) continue
          const htmlFor = label.getAttribute('for')
          if (htmlFor) {
            const byFor = document.getElementById(htmlFor)
            if (byFor instanceof HTMLInputElement || byFor instanceof HTMLTextAreaElement) return byFor
          }
          const nested = label.querySelector('input, textarea')
          if (nested instanceof HTMLInputElement || nested instanceof HTMLTextAreaElement) return nested
        }
        return null
      }
      const findByAttrs = () => {
        const fields = Array.from(document.querySelectorAll('input, textarea'))
        return fields.find((field) => {
          const values = [
            field.getAttribute('aria-label') || '',
            field.getAttribute('placeholder') || '',
            field.getAttribute('name') || ''
          ]
          return values.some((candidate) => normalize(candidate).includes(normalize(targetText)))
        }) || null
      }
      const input = findByLabel() || findByAttrs()
      if (!(input instanceof HTMLInputElement || input instanceof HTMLTextAreaElement)) {
        return { ok: false, error: 'No matching input found' }
      }
      input.focus()
      input.value = value
      input.dispatchEvent(new Event('input', { bubbles: true }))
      input.dispatchEvent(new Event('change', { bubbles: true }))
      return { ok: true }
    })()
  `)

  if (!result.ok) {
    throw new Error(result.error || `Failed to type into: ${targetText}`)
  }
}

export async function pressKey(panelId: string, key: string) {
  const webview = requireWebview(panelId)
  await webview.executeJavaScript(`
    (() => {
      const key = ${JSON.stringify(key)}
      const target = document.activeElement || document.body
      target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }))
      target.dispatchEvent(new KeyboardEvent('keyup', { key, bubbles: true }))
    })()
  `)
}

export async function highlightText(panelId: string, text: string) {
  const webview = requireWebview(panelId)
  await webview.executeJavaScript(`
    (() => {
      const target = ${JSON.stringify(text)}
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
      let node = null
      while ((node = walker.nextNode())) {
        if ((node.textContent || '').includes(target)) {
          const parent = node.parentElement
          if (!parent) return
          const previousOutline = parent.style.outline
          const previousOffset = parent.style.outlineOffset
          parent.style.outline = '2px solid #f59e0b'
          parent.style.outlineOffset = '2px'
          setTimeout(() => {
            parent.style.outline = previousOutline
            parent.style.outlineOffset = previousOffset
          }, 1200)
          return
        }
      }
    })()
  `)
}

export async function browserBack(panelId: string) {
  const webview = requireWebview(panelId)
  if (webview.canGoBack?.()) {
    webview.goBack?.()
  }
}

export async function browserForward(panelId: string) {
  const webview = requireWebview(panelId)
  if (webview.canGoForward?.()) {
    webview.goForward?.()
  }
}

export async function browserReload(panelId: string) {
  const webview = requireWebview(panelId)
  webview.reload?.()
}
