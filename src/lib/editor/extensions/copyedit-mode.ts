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
import { useProjectStore } from '../../../store/projectStore'

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

// State effects for highlight control
export const updatePosDecorations = StateEffect.define<DecorationSet>()

// Highlight decorations
export const highlightDecorations = StateField.define<DecorationSet>({
  create() {
    console.log('[Highlights] Decorations field created')
    return Decoration.none
  },

  update(decorations: DecorationSet, tr: Transaction) {
    // Handle explicit decoration updates
    for (const effect of tr.effects) {
      if (effect.is(updatePosDecorations)) {
        console.log(
          '[Highlights] Received decoration update effect, replacing all decorations'
        )
        // Replace all decorations instead of merging
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
function createPosDecorations(
  text: string,
  enabledPartsOfSpeech: Set<string>
): DecorationSet {
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
    if (enabledPartsOfSpeech.has('nouns')) {
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
            marks.push(
              Decoration.mark({ class: 'cm-pos-noun' }).range(from, to)
            )
            processedRanges.add(rangeKey)
          }
        } else {
          // Fallback: find all occurrences with word boundary checking
          const escapedText = matchText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
          const wordBoundaryRegex = new RegExp(`\\b${escapedText}\\b`, 'g')
          const matches = Array.from(text.matchAll(wordBoundaryRegex))

          for (const match of matches) {
            const from = match.index
            const to = match.index + match[0].length
            const rangeKey = `${from}-${to}`

            if (processedRanges.has(rangeKey)) {
              continue
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
    }

    // Process verbs (exclude auxiliaries and modals for copyediting relevance)
    if (enabledPartsOfSpeech.has('verbs')) {
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
            marks.push(
              Decoration.mark({ class: 'cm-pos-verb' }).range(from, to)
            )
            processedRanges.add(rangeKey)
          }
        } else {
          // Fallback: find all occurrences with word boundary checking
          const escapedText = matchText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
          const wordBoundaryRegex = new RegExp(`\\b${escapedText}\\b`, 'g')
          const matches = Array.from(text.matchAll(wordBoundaryRegex))

          for (const match of matches) {
            const from = match.index
            const to = match.index + match[0].length
            const rangeKey = `${from}-${to}`

            if (processedRanges.has(rangeKey)) {
              continue
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
    }

    // Process adjectives for copyediting analysis
    if (enabledPartsOfSpeech.has('adjectives')) {
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
          // Fallback: find all occurrences with word boundary checking
          const escapedText = matchText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
          const wordBoundaryRegex = new RegExp(`\\b${escapedText}\\b`, 'g')
          const matches = Array.from(text.matchAll(wordBoundaryRegex))

          for (const match of matches) {
            const from = match.index
            const to = match.index + match[0].length
            const rangeKey = `${from}-${to}`

            if (processedRanges.has(rangeKey)) {
              continue
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
    }

    // Process adverbs for writing style analysis
    if (enabledPartsOfSpeech.has('adverbs')) {
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
          // Fallback: find all occurrences with word boundary checking
          const escapedText = matchText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
          const wordBoundaryRegex = new RegExp(`\\b${escapedText}\\b`, 'g')
          const matches = Array.from(text.matchAll(wordBoundaryRegex))

          for (const match of matches) {
            const from = match.index
            const to = match.index + match[0].length
            const rangeKey = `${from}-${to}`

            if (processedRanges.has(rangeKey)) {
              continue
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
    }

    // Process conjunctions for sentence flow analysis
    if (enabledPartsOfSpeech.has('conjunctions')) {
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
          // Fallback: find all occurrences with word boundary checking
          const escapedText = matchText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
          const wordBoundaryRegex = new RegExp(`\\b${escapedText}\\b`, 'g')
          const matches = Array.from(text.matchAll(wordBoundaryRegex))

          for (const match of matches) {
            const from = match.index
            const to = match.index + match[0].length
            const rangeKey = `${from}-${to}`

            if (processedRanges.has(rangeKey)) {
              continue
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
    }

    console.log('[CopyeditMode] Total decorations created:', marks.length)
  } catch (error) {
    console.error('[CopyeditMode] Error in NLP processing:', error)
  }

  return Decoration.set(marks, true)
}

// Global reference to current view for external updates
let currentEditorView: EditorView | null = null

// Function to get enabled parts of speech from global settings
function getEnabledPartsOfSpeech(): Set<string> {
  const globalSettings = useProjectStore.getState().globalSettings
  const highlights = globalSettings?.general?.highlights

  const enabled = new Set<string>()
  // Use nullish coalescing to properly handle false values
  if (highlights?.nouns ?? true) enabled.add('nouns')
  if (highlights?.verbs ?? true) enabled.add('verbs')
  if (highlights?.adjectives ?? true) enabled.add('adjectives')
  if (highlights?.adverbs ?? true) enabled.add('adverbs')
  if (highlights?.conjunctions ?? true) enabled.add('conjunctions')

  return enabled
}

// Function to check if any highlights are enabled
function hasAnyHighlightsEnabled(): boolean {
  const enabledPartsOfSpeech = getEnabledPartsOfSpeech()
  return enabledPartsOfSpeech.size > 0
}

// Function to trigger re-analysis from external components
export function updateCopyeditModePartsOfSpeech() {
  if (currentEditorView) {
    console.log('[Highlights] External trigger for parts-of-speech update')
    // Always re-analyze when called, the decorations function will handle empty sets
    const enabledPartsOfSpeech = getEnabledPartsOfSpeech()
    console.log(
      '[Highlights] Enabled parts of speech:',
      Array.from(enabledPartsOfSpeech)
    )

    const doc = currentEditorView.state.doc.toString()
    const decorations = createPosDecorations(doc, enabledPartsOfSpeech)
    console.log('[Highlights] Created decorations, dispatching update')

    currentEditorView.dispatch({
      effects: updatePosDecorations.of(decorations),
    })

    // Force the view to update by requesting a measure
    currentEditorView.requestMeasure()
    console.log('[Highlights] Update dispatched and measure requested')
  } else {
    console.log('[Highlights] WARNING: No current editor view available')
  }
}

// Highlight plugin with view tracking
export const highlightPlugin = ViewPlugin.fromClass(
  class {
    private timeoutId: number | null = null
    private hasInitialAnalysis = false

    constructor(public view: EditorView) {
      console.log('[Highlights] Plugin constructed')
      currentEditorView = view // Store reference for external access
    }

    update(update: ViewUpdate) {
      console.log('[Highlights] Plugin update - docChanged:', update.docChanged)

      // Always check if any highlights are enabled and analyze if needed
      const hasHighlights = hasAnyHighlightsEnabled()

      if (hasHighlights && update.docChanged) {
        console.log(
          '[Highlights] Document changed with highlights enabled, scheduling analysis'
        )
        this.scheduleAnalysis()
      } else if (hasHighlights && !this.hasInitialAnalysis) {
        console.log(
          '[Highlights] First update with highlights enabled, scheduling initial analysis'
        )
        this.hasInitialAnalysis = true
        this.scheduleAnalysis()
      }
    }

    scheduleAnalysis() {
      if (this.timeoutId !== null) {
        clearTimeout(this.timeoutId)
      }

      console.log('[Highlights] Scheduling analysis in 300ms')
      this.timeoutId = window.setTimeout(() => {
        this.analyzeDocument()
      }, 300) // 300ms debounce
    }

    analyzeDocument() {
      console.log('[Highlights] Analyzing document')
      const doc = this.view.state.doc.toString()

      // Get enabled parts of speech from global settings
      const enabledPartsOfSpeech = getEnabledPartsOfSpeech()

      const decorations = createPosDecorations(doc, enabledPartsOfSpeech)

      console.log('[Highlights] Dispatching decoration update')
      this.view.dispatch({
        effects: updatePosDecorations.of(decorations),
      })
    }

    destroy() {
      console.log('[Highlights] Plugin destroyed')
      if (this.timeoutId !== null) {
        clearTimeout(this.timeoutId)
      }
      if (currentEditorView === this.view) {
        currentEditorView = null // Clear reference
      }
    }
  }
)

// Combined highlight extension
export function createCopyeditModeExtension() {
  console.log('[Highlights] Creating extension')
  return [highlightDecorations, highlightPlugin]
}
