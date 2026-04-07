import { describe, expect, it } from 'vitest'
import { parseDocument } from './parser'
import { buildReviewExportMarkdown, extractReviewReferences } from './review'

describe('review helpers', () => {
  it('extracts referenced files and ranges from code actions', () => {
    const source = `new_panel("code1", "code")
open_code("code1", "app/Http/Controllers/LoginCodeController.php", 14)
highlight_lines("code1", 14, 24)
select_code_line("code1", 22, 8)
new_panel("code2", "code")
open_code("code2", "routes/web.php", 40)
highlight_lines("code2", 40, 41)
`

    const result = parseDocument(source)
    const references = extractReviewReferences(result.actions)

    expect(references).toEqual([
      {
        relativePath: 'app/Http/Controllers/LoginCodeController.php',
        ranges: [
          { command: 'open_code', sourceLine: 2, startLine: 14, endLine: 14 },
          { command: 'highlight_lines', sourceLine: 3, startLine: 14, endLine: 24 },
          { command: 'select_code_line', sourceLine: 4, startLine: 22, endLine: 22 }
        ]
      },
      {
        relativePath: 'routes/web.php',
        ranges: [
          { command: 'open_code', sourceLine: 6, startLine: 40, endLine: 40 },
          { command: 'highlight_lines', sourceLine: 7, startLine: 40, endLine: 41 }
        ]
      }
    ])
  })

  it('formats markdown review export for single-line and range comments', () => {
    const markdown = buildReviewExportMarkdown({
      title: 'EYJ Authentication Walkthrough',
      projectName: 'EYJ',
      exportedAt: '7 April 2026, 14:00',
      comments: [
        {
          id: 'comment-1',
          panelId: 'code1',
          absolutePath: '/tmp/routes/web.php',
          relativePath: 'routes/web.php',
          startLine: 40,
          endLine: 40,
          body: 'Public login route entry point.',
          createdAt: 1,
          updatedAt: 1
        },
        {
          id: 'comment-2',
          panelId: 'code2',
          absolutePath: '/tmp/app/Http/Middleware/PasscodeLocked.php',
          relativePath: 'app/Http/Middleware/PasscodeLocked.php',
          startLine: 21,
          endLine: 35,
          body: 'This whole guard branch decides who bypasses the passcode.',
          createdAt: 2,
          updatedAt: 2
        }
      ],
      references: [
        { relativePath: 'app/Http/Middleware/PasscodeLocked.php', ranges: [] },
        { relativePath: 'routes/web.php', ranges: [] }
      ]
    })

    expect(markdown).toContain('# EYJ Authentication Walkthrough')
    expect(markdown).toContain('Project: EYJ')
    expect(markdown).toContain('### `app/Http/Middleware/PasscodeLocked.php`')
    expect(markdown).toContain('- `app/Http/Middleware/PasscodeLocked.php:21-35`')
    expect(markdown).toContain('- `routes/web.php:40`')
    expect(markdown).toContain('## Referenced Files')
    expect(markdown).toContain('- `routes/web.php`')
  })
})
