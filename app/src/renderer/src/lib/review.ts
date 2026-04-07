import type { ParsedAction } from './parser'

export interface ReviewComment {
  id: string
  panelId: string
  absolutePath: string
  relativePath: string
  startLine: number
  endLine: number
  startColumn?: number
  endColumn?: number
  body: string
  createdAt: number
  updatedAt: number
}

export interface ReviewDraft {
  commentId?: string
  panelId: string
  absolutePath: string
  relativePath: string
  startLine: number
  endLine: number
  startColumn?: number
  endColumn?: number
  body: string
}

export interface ReviewReferenceRange {
  command: string
  sourceLine: number
  startLine?: number
  endLine?: number
}

export interface ReviewReference {
  relativePath: string
  ranges: ReviewReferenceRange[]
}

export interface ReviewExportPayload {
  title?: string
  projectName?: string | null
  exportedAt: string
  comments: ReviewComment[]
  references: ReviewReference[]
}

export interface ReviewTreeNode {
  id: string
  name: string
  path: string
  type: 'folder' | 'file'
  children?: ReviewTreeNode[]
}

export function formatReviewLineRange(startLine: number, endLine: number) {
  return startLine === endLine ? `${startLine}` : `${startLine}-${endLine}`
}

export function normalizeReviewRange(startLine: number, endLine: number) {
  return {
    startLine: Math.min(startLine, endLine),
    endLine: Math.max(startLine, endLine)
  }
}

export function extractReviewReferences(actions: ParsedAction[]) {
  const panelFiles = new Map<string, string>()
  const references = new Map<string, ReviewReference>()

  const ensureReference = (relativePath: string) => {
    let reference = references.get(relativePath)
    if (!reference) {
      reference = { relativePath, ranges: [] }
      references.set(relativePath, reference)
    }
    return reference
  }

  const appendRange = (relativePath: string, range: ReviewReferenceRange) => {
    const reference = ensureReference(relativePath)
    const duplicate = reference.ranges.some(
      (existing) =>
        existing.command === range.command &&
        existing.sourceLine === range.sourceLine &&
        existing.startLine === range.startLine &&
        existing.endLine === range.endLine
    )

    if (!duplicate) {
      reference.ranges.push(range)
    }
  }

  for (const action of actions) {
    switch (action.command) {
      case 'open_code': {
        const [panelId, relativePath, line] = action.args as [string, string, number | undefined]
        panelFiles.set(panelId, relativePath)
        appendRange(relativePath, {
          command: action.command,
          sourceLine: action.sourceLine,
          startLine: line,
          endLine: line
        })
        break
      }

      case 'highlight_lines': {
        const [panelId, startLine, endLine] = action.args as [string, number, number]
        const relativePath = panelFiles.get(panelId)
        if (!relativePath) break
        const range = normalizeReviewRange(startLine, endLine)
        appendRange(relativePath, {
          command: action.command,
          sourceLine: action.sourceLine,
          startLine: range.startLine,
          endLine: range.endLine
        })
        break
      }

      case 'select_code': {
        const [panelId, line] = action.args as [string, number, number, number]
        const relativePath = panelFiles.get(panelId)
        if (!relativePath) break
        appendRange(relativePath, {
          command: action.command,
          sourceLine: action.sourceLine,
          startLine: line,
          endLine: line
        })
        break
      }

      case 'select_code_line': {
        const [panelId, line] = action.args as [string, number, number | undefined]
        const relativePath = panelFiles.get(panelId)
        if (!relativePath) break
        appendRange(relativePath, {
          command: action.command,
          sourceLine: action.sourceLine,
          startLine: line,
          endLine: line
        })
        break
      }

      default:
        break
    }
  }

  return Array.from(references.values()).sort((left, right) => left.relativePath.localeCompare(right.relativePath))
}

export function buildReviewFileTree(paths: string[]) {
  const root: ReviewTreeNode[] = []

  for (const filePath of [...new Set(paths)].sort((left, right) => left.localeCompare(right))) {
    const parts = filePath.split('/').filter(Boolean)
    let branch = root
    let cumulativePath = ''

    parts.forEach((part, index) => {
      cumulativePath = cumulativePath ? `${cumulativePath}/${part}` : part
      const isLeaf = index === parts.length - 1
      let node = branch.find((entry) => entry.name === part && entry.type === (isLeaf ? 'file' : 'folder'))

      if (!node) {
        node = {
          id: cumulativePath,
          name: part,
          path: cumulativePath,
          type: isLeaf ? 'file' : 'folder',
          children: isLeaf ? undefined : []
        }
        branch.push(node)
      }

      if (!isLeaf) {
        node.children ||= []
        branch = node.children
      }
    })
  }

  return sortTreeNodes(root)
}

export function buildReviewExportMarkdown(payload: ReviewExportPayload) {
  const title = payload.title?.trim() || 'Walkthrough review'
  const projectName = payload.projectName?.trim() || 'Unknown project'
  const lines: string[] = [`# ${title}`, '', `Project: ${projectName}`, `Exported: ${payload.exportedAt}`, '']
  const sortedComments = [...payload.comments].sort(
    (left, right) =>
      left.relativePath.localeCompare(right.relativePath) ||
      left.startLine - right.startLine ||
      left.endLine - right.endLine ||
      left.createdAt - right.createdAt
  )

  lines.push('## Review Comments', '')

  if (sortedComments.length === 0) {
    lines.push('No review comments captured.', '')
  } else {
    let currentPath: string | null = null

    for (const comment of sortedComments) {
      if (comment.relativePath !== currentPath) {
        currentPath = comment.relativePath
        lines.push(`### \`${currentPath}\``, '')
      }

      const body = comment.body
        .trim()
        .split('\n')
        .map((line) => line.trimEnd())
        .join('\n  ')

      lines.push(`- \`${comment.relativePath}:${formatReviewLineRange(comment.startLine, comment.endLine)}\``)
      lines.push(`  ${body}`)
      lines.push('')
    }
  }

  lines.push('## Referenced Files', '')

  if (payload.references.length === 0) {
    lines.push('No code references recorded.')
  } else {
    for (const reference of payload.references) {
      lines.push(`- \`${reference.relativePath}\``)
    }
  }

  return lines.join('\n').trim()
}

function sortTreeNodes(nodes: ReviewTreeNode[]): ReviewTreeNode[] {
  return [...nodes]
    .sort((left, right) => {
      if (left.type !== right.type) {
        return left.type === 'folder' ? -1 : 1
      }
      return left.name.localeCompare(right.name)
    })
    .map((node) => ({
      ...node,
      children: node.children ? sortTreeNodes(node.children) : undefined
    }))
}
