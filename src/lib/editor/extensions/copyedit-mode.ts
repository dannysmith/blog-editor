import { StateField, StateEffect, Transaction } from '@codemirror/state'
import {
  EditorView,
  Decoration,
  DecorationSet,
  ViewPlugin,
  ViewUpdate,
} from '@codemirror/view'
import type { Range } from '@codemirror/state'
import nlp from 'compromise'

// Type definitions for compromise.js responses
interface CompromiseOffset {
  start: number
  length: number
}

interface CompromiseMatch {
  offset?: CompromiseOffset
}

// State effects for copyedit mode control
export const toggleCopyeditMode = StateEffect.define<boolean>()
export const updatePosDecorations = StateEffect.define<DecorationSet>()

// State field to track copyedit mode state
export const copyeditModeState = StateField.define<{
  enabled: boolean
}>({
  create() {
    return { enabled: false }
  },

  update(value, tr) {
    let newValue = value

    // Handle copyedit mode toggle effects
    for (const effect of tr.effects) {
      if (effect.is(toggleCopyeditMode)) {
        newValue = { ...newValue, enabled: effect.value }
      }
    }

    return newValue
  },
})

// Copyedit mode decorations
export const copyeditModeDecorations = StateField.define<DecorationSet>({
  create() {
    return Decoration.none
  },

  update(decorations: DecorationSet, tr: Transaction) {
    const copyeditState = tr.state.field(copyeditModeState)

    if (!copyeditState.enabled) {
      return Decoration.none
    }

    // Handle explicit decoration updates
    for (const effect of tr.effects) {
      if (effect.is(updatePosDecorations)) {
        return effect.value
      }
    }

    // Map existing decorations through document changes
    return decorations.map(tr.changes)
  },

  provide: f => EditorView.decorations.from(f),
})

/**
 * Check if a position is within a code block or frontmatter
 */
function isExcludedContent(text: string, from: number, to: number): boolean {
  // Check if inside fenced code block (```...```)
  const fencedCodeBlocks = text.matchAll(/```[\s\S]*?```/g)
  for (const match of fencedCodeBlocks) {
    if (
      match.index !== undefined &&
      from >= match.index &&
      to <= match.index + match[0].length
    ) {
      return true
    }
  }

  // Check if inside inline code (`...`)
  const inlineCodeBlocks = text.matchAll(/`[^`\n]+`/g)
  for (const match of inlineCodeBlocks) {
    if (
      match.index !== undefined &&
      from >= match.index &&
      to <= match.index + match[0].length
    ) {
      return true
    }
  }

  // Check if inside frontmatter (---...---)
  const frontmatterMatch = text.match(/^---[\s\S]*?---/)
  if (frontmatterMatch && from < frontmatterMatch[0].length) {
    return true
  }

  // Check if inside link syntax [text](url)
  const linkMatches = text.matchAll(/\[([^\]]+)\]\([^)]+\)/g)
  for (const match of linkMatches) {
    if (
      match.index !== undefined &&
      from >= match.index &&
      to <= match.index + match[0].length
    ) {
      return true
    }
  }

  return false
}

/**
 * Create decorations for parts of speech highlighting
 */
function createPosDecorations(text: string): DecorationSet {
  const marks: Range<Decoration>[] = []

  try {
    // Parse the text with compromise.js
    const doc = nlp(text)

    // Find nouns
    const nouns = doc.match('#Noun').json() as CompromiseMatch[]
    for (const noun of nouns) {
      const offset = noun.offset || { start: 0, length: 0 }
      const from = offset.start
      const to = offset.start + offset.length

      if (!isExcludedContent(text, from, to)) {
        marks.push(Decoration.mark({ class: 'cm-pos-noun' }).range(from, to))
      }
    }

    // Find verbs
    const verbs = doc.match('#Verb').json() as CompromiseMatch[]
    for (const verb of verbs) {
      const offset = verb.offset || { start: 0, length: 0 }
      const from = offset.start
      const to = offset.start + offset.length

      if (!isExcludedContent(text, from, to)) {
        marks.push(Decoration.mark({ class: 'cm-pos-verb' }).range(from, to))
      }
    }
  } catch (error) {
    // Error handling for NLP processing - avoid console statements in production
    // TODO: Add proper error reporting system
    void error
  }

  return Decoration.set(marks, true)
}

// Main copyedit mode plugin with debounced analysis
export const copyeditModePlugin = ViewPlugin.fromClass(
  class {
    private timeoutId: number | null = null

    constructor(public view: EditorView) {}

    update(update: ViewUpdate) {
      const state = update.state.field(copyeditModeState)
      if (!state.enabled) return

      // Only process if document changed
      if (update.docChanged) {
        this.scheduleAnalysis()
      }
    }

    scheduleAnalysis() {
      if (this.timeoutId !== null) {
        clearTimeout(this.timeoutId)
      }

      this.timeoutId = window.setTimeout(() => {
        this.analyzeDocument()
      }, 300) // 300ms debounce
    }

    analyzeDocument() {
      const doc = this.view.state.doc.toString()
      const decorations = createPosDecorations(doc)

      this.view.dispatch({
        effects: updatePosDecorations.of(decorations),
      })
    }

    destroy() {
      if (this.timeoutId !== null) {
        clearTimeout(this.timeoutId)
      }
    }
  }
)

// Combined copyedit mode extension
export function createCopyeditModeExtension() {
  return [copyeditModeState, copyeditModeDecorations, copyeditModePlugin]
}
