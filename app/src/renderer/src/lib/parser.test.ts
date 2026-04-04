import { describe, expect, it } from 'vitest'
import { createSampleScript, parseDocument } from './parser'

describe('parser', () => {
  it('parses a valid script into actions and meta', () => {
    const source = `meta({ title: "Demo", startLayout: "two-column" })
new_panel("code1", "code")
open_code("code1", "README.md", 1)
pause(1)
`

    const result = parseDocument(source)

    expect(result.diagnostics).toHaveLength(0)
    expect(result.meta.title).toBe('Demo')
    expect(result.actions.map((action) => action.command)).toEqual(['new_panel', 'open_code', 'pause'])
  })

  it('reports diagnostics for duplicate panels and missing panels', () => {
    const source = `new_panel("code1", "code")
new_panel("code1", "code")
open_code("web1", "README.md")
`

    const result = parseDocument(source)
    const messages = result.diagnostics.map((diagnostic) => diagnostic.message)

    expect(messages).toContain('Duplicate panel id: code1')
    expect(messages).toContain('Panel must exist before use: web1')
  })

  it('creates a richer eyj authentication walkthrough script', () => {
    const source = createSampleScript({
      name: 'eyj',
      rootPath: '/Users/spriggs/Documents/Projects/eyj'
    })

    expect(source).toContain('"EYJ Authentication Walkthrough"')
    expect(source).toContain('open_code("code1", "routes/web.php", 40)')
    expect(source).toContain('open_code("code2", "app/Http/Controllers/LoginCodeController.php", 14)')
    expect(source).toContain('select_code_line("code2", 22, 8)')
    expect(source).toContain('open_code("code1", "vendor/laravel/framework/src/Illuminate/Routing/Redirector.php", 95)')
    expect(source).not.toContain('open_browser(')
  })

  it('flags browser commands as disabled in the current prototype', () => {
    const source = `new_panel("web1", "browser")
open_browser("web1", "https://example.com")
`

    const result = parseDocument(source)
    const messages = result.diagnostics.map((diagnostic) => diagnostic.message)

    expect(messages).toContain('Browser panels are disabled in the current prototype')
    expect(messages).toContain('Browser action disabled in current prototype: open_browser')
  })
})
