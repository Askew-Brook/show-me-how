import hljs from 'highlight.js/lib/core'
import bash from 'highlight.js/lib/languages/bash'
import css from 'highlight.js/lib/languages/css'
import diff from 'highlight.js/lib/languages/diff'
import javascript from 'highlight.js/lib/languages/javascript'
import json from 'highlight.js/lib/languages/json'
import markdown from 'highlight.js/lib/languages/markdown'
import php from 'highlight.js/lib/languages/php'
import plaintext from 'highlight.js/lib/languages/plaintext'
import python from 'highlight.js/lib/languages/python'
import sql from 'highlight.js/lib/languages/sql'
import typescript from 'highlight.js/lib/languages/typescript'
import xml from 'highlight.js/lib/languages/xml'
import yaml from 'highlight.js/lib/languages/yaml'

hljs.registerLanguage('bash', bash)
hljs.registerLanguage('shell', bash)
hljs.registerLanguage('css', css)
hljs.registerLanguage('diff', diff)
hljs.registerLanguage('javascript', javascript)
hljs.registerLanguage('js', javascript)
hljs.registerLanguage('json', json)
hljs.registerLanguage('markdown', markdown)
hljs.registerLanguage('md', markdown)
hljs.registerLanguage('php', php)
hljs.registerLanguage('plaintext', plaintext)
hljs.registerLanguage('python', python)
hljs.registerLanguage('py', python)
hljs.registerLanguage('sql', sql)
hljs.registerLanguage('typescript', typescript)
hljs.registerLanguage('ts', typescript)
hljs.registerLanguage('html', xml)
hljs.registerLanguage('xml', xml)
hljs.registerLanguage('yaml', yaml)
hljs.registerLanguage('yml', yaml)

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
}

export function languageFromPath(filePath?: string) {
  if (!filePath) return 'plaintext'
  const ext = filePath.split('.').pop()?.toLowerCase()

  switch (ext) {
    case 'php':
      return 'php'
    case 'js':
    case 'mjs':
    case 'cjs':
      return 'javascript'
    case 'ts':
    case 'tsx':
      return 'typescript'
    case 'json':
      return 'json'
    case 'html':
    case 'blade.php':
    case 'xml':
    case 'svg':
      return 'html'
    case 'css':
    case 'scss':
    case 'sass':
      return 'css'
    case 'md':
      return 'markdown'
    case 'sh':
    case 'bash':
    case 'zsh':
      return 'bash'
    case 'yml':
    case 'yaml':
      return 'yaml'
    case 'sql':
      return 'sql'
    case 'py':
      return 'python'
    case 'diff':
    case 'patch':
      return 'diff'
    default:
      return 'plaintext'
  }
}

export function highlightLine(line: string, language: string) {
  if (!line) return ' '

  try {
    if (language === 'plaintext') {
      return escapeHtml(line)
    }

    return hljs.highlight(line, { language, ignoreIllegals: true }).value || escapeHtml(line)
  } catch {
    return escapeHtml(line)
  }
}
