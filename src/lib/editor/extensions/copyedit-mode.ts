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

/* eslint-disable no-console */

// Type definitions for compromise.js responses
interface CompromiseOffset {
  start: number
  length: number
}

interface CompromiseMatch {
  text(): string
  offset?: CompromiseOffset
}

interface CompromiseMatches {
  length: number
  forEach(callback: (match: CompromiseMatch) => void): void
}

interface CompromiseDocument {
  match(pattern: string): CompromiseMatches
}

// State effects for copyedit mode control
export const toggleCopyeditMode = StateEffect.define<boolean>()
export const updatePosDecorations = StateEffect.define<DecorationSet>()

// State field to track copyedit mode state
export const copyeditModeState = StateField.define<{
  enabled: boolean
}>({
  create() {
    console.log('[CopyeditMode] StateField created with enabled: false')
    return { enabled: false }
  },

  update(value, tr) {
    let newValue = value

    // Handle copyedit mode toggle effects
    for (const effect of tr.effects) {
      if (effect.is(toggleCopyeditMode)) {
        console.log(
          '[CopyeditMode] StateField received toggle effect:',
          effect.value
        )
        newValue = { ...newValue, enabled: effect.value }
      }
    }

    if (newValue.enabled !== value.enabled) {
      console.log(
        '[CopyeditMode] StateField state changed from',
        value.enabled,
        'to',
        newValue.enabled
      )
    }

    return newValue
  },
})

// Copyedit mode decorations
export const copyeditModeDecorations = StateField.define<DecorationSet>({
  create() {
    console.log('[CopyeditMode] Decorations field created')
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
        console.log('[CopyeditMode] Received decoration update effect')
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
  console.log(
    '[CopyeditMode] Creating POS decorations for text length:',
    text.length
  )
  const marks: Range<Decoration>[] = []
  const processedRanges = new Set<string>() // Track ranges to avoid duplicates

  try {
    // Parse the text with compromise.js
    const doc = nlp(text) as CompromiseDocument

    // Process nouns (exclude pronouns for copyediting relevance)
    const allNouns = doc.match('#Noun')
    const pronouns = doc.match('#Pronoun')

    // Create set of pronoun texts for exclusion
    const pronounTexts = new Set<string>()
    pronouns.forEach((pronoun: CompromiseMatch) => {
      const text = pronoun.text()
      if (text) {
        pronounTexts.add(text.toLowerCase())
      }
    })

    console.log('[CopyeditMode] Found', allNouns.length, 'total nouns')
    console.log('[CopyeditMode] Excluding', pronouns.length, 'pronouns')

    allNouns.forEach((match: CompromiseMatch) => {
      const matchText = match.text()
      if (
        !matchText ||
        matchText.trim().length === 0 ||
        pronounTexts.has(matchText.toLowerCase())
      ) {
        return
      }

      // Try to get offset from Compromise first
      const offset = match.offset
      if (offset && offset.start >= 0 && offset.length > 0) {
        const from = offset.start
        const to = offset.start + offset.length
        const rangeKey = `${from}-${to}`

        // Skip if we've already processed this range
        if (processedRanges.has(rangeKey)) {
          return
        }

        if (!isExcludedContent(text, from, to)) {
          marks.push(Decoration.mark({ class: 'cm-pos-noun' }).range(from, to))
          processedRanges.add(rangeKey)
        }
      } else {
        // Fallback: find first occurrence only
        const position = text.indexOf(matchText)
        if (position !== -1) {
          const from = position
          const to = position + matchText.length
          const rangeKey = `${from}-${to}`

          if (processedRanges.has(rangeKey)) {
            return
          }

          if (!isExcludedContent(text, from, to)) {
            marks.push(
              Decoration.mark({ class: 'cm-pos-noun' }).range(from, to)
            )
            processedRanges.add(rangeKey)
          }
        }
      }
    })

    // Process verbs (exclude auxiliaries and modals for copyediting relevance)
    const allVerbs = doc.match('#Verb')
    const auxiliaries = doc.match('#Auxiliary')
    const modals = doc.match('#Modal')

    // Create set of excluded verb texts
    const excludedVerbTexts = new Set<string>()
    auxiliaries.forEach((aux: CompromiseMatch) => {
      const text = aux.text()
      if (text) {
        excludedVerbTexts.add(text.toLowerCase())
      }
    })
    modals.forEach((modal: CompromiseMatch) => {
      const text = modal.text()
      if (text) {
        excludedVerbTexts.add(text.toLowerCase())
      }
    })

    console.log('[CopyeditMode] Found', allVerbs.length, 'total verbs')
    console.log(
      '[CopyeditMode] Excluding',
      auxiliaries.length,
      'auxiliaries and',
      modals.length,
      'modals'
    )

    allVerbs.forEach((match: CompromiseMatch) => {
      const matchText = match.text()
      if (
        !matchText ||
        matchText.trim().length === 0 ||
        excludedVerbTexts.has(matchText.toLowerCase())
      ) {
        return
      }

      // Try to get offset from Compromise first
      const offset = match.offset
      if (offset && offset.start >= 0 && offset.length > 0) {
        const from = offset.start
        const to = offset.start + offset.length
        const rangeKey = `${from}-${to}`

        // Skip if we've already processed this range
        if (processedRanges.has(rangeKey)) {
          return
        }

        if (!isExcludedContent(text, from, to)) {
          marks.push(Decoration.mark({ class: 'cm-pos-verb' }).range(from, to))
          processedRanges.add(rangeKey)
        }
      } else {
        // Fallback: find first occurrence only
        const position = text.indexOf(matchText)
        if (position !== -1) {
          const from = position
          const to = position + matchText.length
          const rangeKey = `${from}-${to}`

          if (processedRanges.has(rangeKey)) {
            return
          }

          if (!isExcludedContent(text, from, to)) {
            marks.push(
              Decoration.mark({ class: 'cm-pos-verb' }).range(from, to)
            )
            processedRanges.add(rangeKey)
          }
        }
      }
    })

    // Process adjectives for copyediting analysis
    const adjectives = doc.match('#Adjective')
    console.log('[CopyeditMode] Found', adjectives.length, 'adjectives')

    adjectives.forEach((match: CompromiseMatch) => {
      const matchText = match.text()
      if (!matchText || matchText.trim().length === 0) {
        return
      }

      // Try to get offset from Compromise first
      const offset = match.offset
      if (offset && offset.start >= 0 && offset.length > 0) {
        const from = offset.start
        const to = offset.start + offset.length
        const rangeKey = `${from}-${to}`

        // Skip if we've already processed this range
        if (processedRanges.has(rangeKey)) {
          return
        }

        if (!isExcludedContent(text, from, to)) {
          marks.push(
            Decoration.mark({ class: 'cm-pos-adjective' }).range(from, to)
          )
          processedRanges.add(rangeKey)
        }
      } else {
        // Fallback: find first occurrence only
        const position = text.indexOf(matchText)
        if (position !== -1) {
          const from = position
          const to = position + matchText.length
          const rangeKey = `${from}-${to}`

          if (processedRanges.has(rangeKey)) {
            return
          }

          if (!isExcludedContent(text, from, to)) {
            marks.push(
              Decoration.mark({ class: 'cm-pos-adjective' }).range(from, to)
            )
            processedRanges.add(rangeKey)
          }
        }
      }
    })

    // Process adverbs for writing style analysis
    const adverbs = doc.match('#Adverb')
    console.log('[CopyeditMode] Found', adverbs.length, 'adverbs')

    adverbs.forEach((match: CompromiseMatch) => {
      const matchText = match.text()
      if (!matchText || matchText.trim().length === 0) {
        return
      }

      // Try to get offset from Compromise first
      const offset = match.offset
      if (offset && offset.start >= 0 && offset.length > 0) {
        const from = offset.start
        const to = offset.start + offset.length
        const rangeKey = `${from}-${to}`

        // Skip if we've already processed this range
        if (processedRanges.has(rangeKey)) {
          return
        }

        if (!isExcludedContent(text, from, to)) {
          marks.push(
            Decoration.mark({ class: 'cm-pos-adverb' }).range(from, to)
          )
          processedRanges.add(rangeKey)
        }
      } else {
        // Fallback: find first occurrence only
        const position = text.indexOf(matchText)
        if (position !== -1) {
          const from = position
          const to = position + matchText.length
          const rangeKey = `${from}-${to}`

          if (processedRanges.has(rangeKey)) {
            return
          }

          if (!isExcludedContent(text, from, to)) {
            marks.push(
              Decoration.mark({ class: 'cm-pos-adverb' }).range(from, to)
            )
            processedRanges.add(rangeKey)
          }
        }
      }
    })

    // Process conjunctions for sentence flow analysis
    const conjunctions = doc.match('#Conjunction')
    console.log('[CopyeditMode] Found', conjunctions.length, 'conjunctions')

    conjunctions.forEach((match: CompromiseMatch) => {
      const matchText = match.text()
      if (!matchText || matchText.trim().length === 0) {
        return
      }

      // Try to get offset from Compromise first
      const offset = match.offset
      if (offset && offset.start >= 0 && offset.length > 0) {
        const from = offset.start
        const to = offset.start + offset.length
        const rangeKey = `${from}-${to}`

        // Skip if we've already processed this range
        if (processedRanges.has(rangeKey)) {
          return
        }

        if (!isExcludedContent(text, from, to)) {
          marks.push(
            Decoration.mark({ class: 'cm-pos-conjunction' }).range(from, to)
          )
          processedRanges.add(rangeKey)
        }
      } else {
        // Fallback: find first occurrence only
        const position = text.indexOf(matchText)
        if (position !== -1) {
          const from = position
          const to = position + matchText.length
          const rangeKey = `${from}-${to}`

          if (processedRanges.has(rangeKey)) {
            return
          }

          if (!isExcludedContent(text, from, to)) {
            marks.push(
              Decoration.mark({ class: 'cm-pos-conjunction' }).range(from, to)
            )
            processedRanges.add(rangeKey)
          }
        }
      }
    })

    console.log('[CopyeditMode] Total decorations created:', marks.length)
  } catch (error) {
    console.error('[CopyeditMode] Error in NLP processing:', error)
  }

  return Decoration.set(marks, true)
}

// Main copyedit mode plugin with debounced analysis
export const copyeditModePlugin = ViewPlugin.fromClass(
  class {
    private timeoutId: number | null = null

    constructor(public view: EditorView) {
      console.log('[CopyeditMode] Plugin constructed')
    }

    update(update: ViewUpdate) {
      const state = update.state.field(copyeditModeState)
      const prevState = update.startState.field(copyeditModeState)
      console.log(
        '[CopyeditMode] Plugin update - enabled:',
        state.enabled,
        'docChanged:',
        update.docChanged
      )

      if (!state.enabled) {
        console.log('[CopyeditMode] Plugin skipping update - mode disabled')
        return
      }

      // Check if mode was just enabled
      const justEnabled = state.enabled && !prevState.enabled
      if (justEnabled) {
        console.log(
          '[CopyeditMode] Mode just enabled, scheduling initial analysis'
        )
        this.scheduleAnalysis()
      }
      // Or if document changed while mode is on
      else if (update.docChanged) {
        console.log('[CopyeditMode] Document changed, scheduling analysis')
        this.scheduleAnalysis()
      }
    }

    scheduleAnalysis() {
      if (this.timeoutId !== null) {
        clearTimeout(this.timeoutId)
      }

      console.log('[CopyeditMode] Scheduling analysis in 300ms')
      this.timeoutId = window.setTimeout(() => {
        this.analyzeDocument()
      }, 300) // 300ms debounce
    }

    analyzeDocument() {
      console.log('[CopyeditMode] Analyzing document')
      const doc = this.view.state.doc.toString()
      const decorations = createPosDecorations(doc)

      console.log('[CopyeditMode] Dispatching decoration update')
      this.view.dispatch({
        effects: updatePosDecorations.of(decorations),
      })
    }

    destroy() {
      console.log('[CopyeditMode] Plugin destroyed')
      if (this.timeoutId !== null) {
        clearTimeout(this.timeoutId)
      }
    }
  }
)

// Combined copyedit mode extension
export function createCopyeditModeExtension() {
  console.log('[CopyeditMode] Creating extension')
  return [copyeditModeState, copyeditModeDecorations, copyeditModePlugin]
}
