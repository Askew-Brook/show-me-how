import type * as Monaco from 'monaco-editor'

const COMMANDS = [
  {
    name: 'meta',
    signature: 'meta({ ... })',
    detail: 'Document metadata',
    documentation:
      'Sets presentation metadata such as `title`, `startLayout`, `voice`, `defaultPauseAfterTts`, and `rate`.',
    snippet: 'meta({\n  title: "$1",\n  startLayout: "two-column",\n  rate: 1\n})'
  },
  {
    name: 'layout',
    signature: 'layout(mode)',
    detail: 'Set the active layout',
    documentation: 'Sets the active layout to `single`, `two-column`, or `grid`.',
    snippet: 'layout("$1")'
  },
  {
    name: 'new_panel',
    signature: 'new_panel(id, type)',
    detail: 'Create a panel',
    documentation: 'Creates a new panel. Panel type is currently `code` or `browser`.',
    snippet: 'new_panel("$1", "$2")'
  },
  {
    name: 'close_panel',
    signature: 'close_panel(id)',
    detail: 'Close a panel',
    documentation: 'Closes an existing panel by id.',
    snippet: 'close_panel("$1")'
  },
  {
    name: 'focus_panel',
    signature: 'focus_panel(id)',
    detail: 'Focus a panel',
    documentation: 'Moves focus to a panel before further actions.',
    snippet: 'focus_panel("$1")'
  },
  {
    name: 'open_code',
    signature: 'open_code(panelId, path, line?)',
    detail: 'Open a code file',
    documentation: 'Opens a file in a code panel, optionally starting at a line number.',
    snippet: 'open_code("$1", "$2", $3)'
  },
  {
    name: 'scroll_code',
    signature: 'scroll_code(panelId, line)',
    detail: 'Scroll code',
    documentation: 'Scrolls a code panel to a given line.',
    snippet: 'scroll_code("$1", $2)'
  },
  {
    name: 'select_code',
    signature: 'select_code(panelId, line, startCol, endCol)',
    detail: 'Select a code range',
    documentation: 'Selects a range on a single line.',
    snippet: 'select_code("$1", $2, $3, $4)'
  },
  {
    name: 'select_code_line',
    signature: 'select_code_line(panelId, line, startCol?)',
    detail: 'Select from a column to line end',
    documentation: 'Selects from the given column to the end of the line.',
    snippet: 'select_code_line("$1", $2, $3)'
  },
  {
    name: 'highlight_lines',
    signature: 'highlight_lines(panelId, startLine, endLine)',
    detail: 'Highlight a line range',
    documentation: 'Highlights a line range in a code panel.',
    snippet: 'highlight_lines("$1", $2, $3)'
  },
  {
    name: 'clear_code_selection',
    signature: 'clear_code_selection(panelId)',
    detail: 'Clear selection',
    documentation: 'Clears any active code selection in a panel.',
    snippet: 'clear_code_selection("$1")'
  },
  {
    name: 'open_browser',
    signature: 'open_browser(panelId, url)',
    detail: 'Open a browser panel',
    documentation: 'Loads a URL into a browser panel.',
    snippet: 'open_browser("$1", "$2")'
  },
  {
    name: 'click_text',
    signature: 'click_text(panelId, text)',
    detail: 'Click UI text',
    documentation: 'Clicks visible text inside a browser panel.',
    snippet: 'click_text("$1", "$2")'
  },
  {
    name: 'type_text',
    signature: 'type_text(panelId, label, value)',
    detail: 'Type into a field',
    documentation: 'Finds a field by label-like text and enters a value.',
    snippet: 'type_text("$1", "$2", "$3")'
  },
  {
    name: 'wait_for_text',
    signature: 'wait_for_text(panelId, text, timeoutMs?)',
    detail: 'Wait for visible text',
    documentation: 'Waits for text to appear in a browser panel.',
    snippet: 'wait_for_text("$1", "$2", $3)'
  },
  {
    name: 'wait_for_navigation',
    signature: 'wait_for_navigation(panelId, timeoutMs?)',
    detail: 'Wait for navigation',
    documentation: 'Waits for browser navigation to complete.',
    snippet: 'wait_for_navigation("$1", $2)'
  },
  {
    name: 'highlight_text',
    signature: 'highlight_text(panelId, text)',
    detail: 'Highlight browser text',
    documentation: 'Highlights matching text inside a browser panel.',
    snippet: 'highlight_text("$1", "$2")'
  },
  {
    name: 'press_key',
    signature: 'press_key(panelId, key)',
    detail: 'Press a key',
    documentation: 'Sends a keyboard key to the active browser panel.',
    snippet: 'press_key("$1", "$2")'
  },
  {
    name: 'browser_back',
    signature: 'browser_back(panelId)',
    detail: 'Browser back',
    documentation: 'Navigates backward in a browser panel.',
    snippet: 'browser_back("$1")'
  },
  {
    name: 'browser_forward',
    signature: 'browser_forward(panelId)',
    detail: 'Browser forward',
    documentation: 'Navigates forward in a browser panel.',
    snippet: 'browser_forward("$1")'
  },
  {
    name: 'browser_reload',
    signature: 'browser_reload(panelId)',
    detail: 'Browser reload',
    documentation: 'Reloads the current browser panel.',
    snippet: 'browser_reload("$1")'
  },
  {
    name: 'pause',
    signature: 'pause(seconds)',
    detail: 'Pause playback',
    documentation: 'Pauses the timeline for a number of seconds.',
    snippet: 'pause($1)'
  },
  {
    name: 'tts',
    signature: 'tts(text)',
    detail: 'Narration text',
    documentation: 'Speaks narration through TTS during playback.',
    snippet: 'tts("$1")'
  },
  {
    name: 'note',
    signature: 'note(text)',
    detail: 'Author note',
    documentation: 'Stores a non-executed note in the timeline.',
    snippet: 'note("$1")'
  }
] as const

const META_FIELDS = [
  {
    name: 'title',
    detail: 'Presentation title',
    documentation: 'Human-readable title shown in the app.',
    snippet: 'title: "$1"'
  },
  {
    name: 'startLayout',
    detail: 'Initial layout',
    documentation: 'Valid values: `single`, `two-column`, `grid`.',
    snippet: 'startLayout: "$1"'
  },
  {
    name: 'defaultPauseAfterTts',
    detail: 'Default pause after narration',
    documentation: 'Applies an automatic pause after each TTS step.',
    snippet: 'defaultPauseAfterTts: $1'
  },
  {
    name: 'voice',
    detail: 'TTS voice name',
    documentation: 'Optional macOS voice for narration.',
    snippet: 'voice: "$1"'
  },
  {
    name: 'rate',
    detail: 'Narration rate',
    documentation: 'Narration speed multiplier; must be greater than zero.',
    snippet: 'rate: $1'
  }
] as const

const VALUE_LITERALS = [
  { label: '"single"', detail: 'Layout value' },
  { label: '"two-column"', detail: 'Layout value' },
  { label: '"grid"', detail: 'Layout value' },
  { label: '"code"', detail: 'Panel type' },
  { label: '"browser"', detail: 'Panel type' },
  { label: 'true', detail: 'Boolean literal' },
  { label: 'false', detail: 'Boolean literal' }
] as const

let registered = false

function rangeForWord(model: Monaco.editor.ITextModel, position: Monaco.Position) {
  return model.getWordUntilPosition(position)
}

function insideMetaObject(model: Monaco.editor.ITextModel, position: Monaco.Position) {
  const text = model.getValueInRange({
    startLineNumber: 1,
    startColumn: 1,
    endLineNumber: position.lineNumber,
    endColumn: position.column
  })

  const metaIndex = text.lastIndexOf('meta(')
  if (metaIndex === -1) return false

  const openBraceIndex = text.indexOf('{', metaIndex)
  if (openBraceIndex === -1) return false

  let depth = 0
  let inString = false
  let escaped = false

  for (let index = openBraceIndex; index < text.length; index += 1) {
    const char = text[index]

    if (escaped) {
      escaped = false
      continue
    }

    if (char === '\\') {
      escaped = true
      continue
    }

    if (char === '"') {
      inString = !inString
      continue
    }

    if (inString) continue

    if (char === '{') depth += 1
    if (char === '}') {
      depth -= 1
      if (depth === 0 && index < text.length - 1) {
        return false
      }
    }
  }

  return depth > 0
}

export function registerSmhLanguage(monaco: typeof Monaco) {
  if (registered) return
  registered = true

  monaco.languages.register({ id: 'smh' })

  monaco.languages.setLanguageConfiguration('smh', {
    comments: {
      lineComment: '//'
    },
    brackets: [
      ['{', '}'],
      ['[', ']'],
      ['(', ')']
    ],
    autoClosingPairs: [
      { open: '{', close: '}' },
      { open: '[', close: ']' },
      { open: '(', close: ')' },
      { open: '"', close: '"', notIn: ['string', 'comment'] }
    ],
    surroundingPairs: [
      { open: '{', close: '}' },
      { open: '[', close: ']' },
      { open: '(', close: ')' },
      { open: '"', close: '"' }
    ],
    folding: {
      markers: {
        start: /^\s*meta\s*\(\s*\{/,
        end: /^\s*\}\s*\)\s*$/
      }
    }
  })

  monaco.languages.setMonarchTokensProvider('smh', {
    defaultToken: '',
    tokenPostfix: '.smh',
    brackets: [
      { open: '{', close: '}', token: 'delimiter.curly' },
      { open: '[', close: ']', token: 'delimiter.square' },
      { open: '(', close: ')', token: 'delimiter.parenthesis' }
    ],
    tokenizer: {
      root: [
        [/\/\/.*/, 'comment'],
        [/\b(true|false)\b/, 'constant.language.boolean'],
        [/\b-?\d+(?:\.\d+)?\b/, 'number'],
        [/"/, { token: 'string.quote', bracket: '@open', next: '@string' }],
        [/\b[a-z_][a-z0-9_]*\b(?=\s*\()/, 'keyword.command'],
        [/\b[A-Za-z_][A-Za-z0-9_]*\b(?=\s*:)/, 'variable.meta'],
        [/[{}\[\]()]/, '@brackets'],
        [/[,:]/, 'delimiter'],
        [/\s+/, 'white']
      ],
      string: [
        [/[^\\"]+/, 'string'],
        [/\\./, 'string.escape'],
        [/"/, { token: 'string.quote', bracket: '@close', next: '@pop' }]
      ]
    }
  })

  monaco.editor.defineTheme('smh-dark', {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: 'comment', foreground: '7f7a74' },
      { token: 'keyword.command', foreground: '8fc9a7', fontStyle: 'bold' },
      { token: 'variable.meta', foreground: 'd7c08d' },
      { token: 'string', foreground: 'efe9e1' },
      { token: 'string.escape', foreground: 'c8a7df' },
      { token: 'number', foreground: 'd9a58f' },
      { token: 'constant.language.boolean', foreground: 'c8a7df' },
      { token: 'delimiter', foreground: '8f877f' },
      { token: 'delimiter.curly', foreground: 'b4aca3' },
      { token: 'delimiter.parenthesis', foreground: 'b4aca3' },
      { token: 'delimiter.square', foreground: 'b4aca3' }
    ],
    colors: {
      'editor.background': '#1b1e22',
      'editor.foreground': '#eef1f4',
      'editorLineNumber.foreground': '#6f6861',
      'editorLineNumber.activeForeground': '#c9d0d7',
      'editorCursor.foreground': '#7b978a',
      'editor.selectionBackground': '#2f3c35',
      'editor.inactiveSelectionBackground': '#2b3530',
      'editor.lineHighlightBackground': '#23262a',
      'editorIndentGuide.background1': '#343036',
      'editorIndentGuide.activeBackground1': '#4b454d',
      'editorWhitespace.foreground': '#343036',
      'editorBracketMatch.background': '#252a33',
      'editorBracketMatch.border': '#627591',
      'editorGutter.background': '#1b1e22',
      'editorOverviewRuler.border': '#1b1e22',
      'scrollbarSlider.background': '#454048aa',
      'scrollbarSlider.hoverBackground': '#5a555daa',
      'scrollbarSlider.activeBackground': '#6a656daa'
    }
  })

  monaco.languages.registerCompletionItemProvider('smh', {
    triggerCharacters: ['(', '"', ':'],
    provideCompletionItems(model, position) {
      const word = rangeForWord(model, position)
      const range = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: word.startColumn,
        endColumn: word.endColumn
      }

      const suggestions: Monaco.languages.CompletionItem[] = []

      for (const command of COMMANDS) {
        suggestions.push({
          label: command.name,
          kind: monaco.languages.CompletionItemKind.Function,
          detail: command.detail,
          documentation: {
            value: `**${command.signature}**\n\n${command.documentation}`
          },
          insertText: command.snippet,
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          range
        })
      }

      if (insideMetaObject(model, position)) {
        for (const field of META_FIELDS) {
          suggestions.push({
            label: field.name,
            kind: monaco.languages.CompletionItemKind.Property,
            detail: field.detail,
            documentation: field.documentation,
            insertText: field.snippet,
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            range
          })
        }
      }

      for (const value of VALUE_LITERALS) {
        suggestions.push({
          label: value.label,
          kind: monaco.languages.CompletionItemKind.Value,
          detail: value.detail,
          insertText: value.label,
          range
        })
      }

      return { suggestions }
    }
  })

  monaco.languages.registerHoverProvider('smh', {
    provideHover(model, position) {
      const word = model.getWordAtPosition(position)
      if (!word) return null

      const command = COMMANDS.find((entry) => entry.name === word.word)
      if (command) {
        return {
          range: new monaco.Range(position.lineNumber, word.startColumn, position.lineNumber, word.endColumn),
          contents: [{ value: `**${command.signature}**\n\n${command.documentation}` }]
        }
      }

      const field = META_FIELDS.find((entry) => entry.name === word.word)
      if (field) {
        return {
          range: new monaco.Range(position.lineNumber, word.startColumn, position.lineNumber, word.endColumn),
          contents: [{ value: `**${field.name}**\n\n${field.documentation}` }]
        }
      }

      return null
    }
  })
}
