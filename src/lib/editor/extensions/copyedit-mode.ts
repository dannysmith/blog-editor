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
    return Decoration.none
  },

  update(decorations: DecorationSet, tr: Transaction) {
    // Handle explicit decoration updates
    for (const effect of tr.effects) {
      if (effect.is(updatePosDecorations)) {
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
 * Check if a decoration range overlaps with the cursor position or nearby area
 * This prevents decorations from interfering with active editing
 */
function isRangeBeingEdited(
  from: number,
  to: number,
  cursorPosition: number
): boolean {
  if (cursorPosition === -1) return false

  // Exclude decorations that contain the cursor or are very close to it
  // This prevents interference when editing within or near decorated words
  const buffer = 2 // Small buffer around cursor
  return (
    (cursorPosition >= from - buffer && cursorPosition <= to + buffer) ||
    (from <= cursorPosition && to >= cursorPosition)
  )
}

/**
 * Create decorations for parts of speech highlighting
 */
function createPosDecorations(
  text: string,
  enabledPartsOfSpeech: Set<string>
): DecorationSet {
  const marks: Range<Decoration>[] = []
  const processedRanges = new Set<string>() // Track ranges to avoid duplicates

  // Get current cursor position to exclude words being actively edited
  let cursorPosition = -1
  if (currentEditorView) {
    cursorPosition = currentEditorView.state.selection.main.head
  }

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

          if (
            !isExcludedContent(text, from, to) &&
            !isRangeBeingEdited(from, to, cursorPosition)
          ) {
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
            const to = from + match[0].length
            const rangeKey = `${from}-${to}`

            // Validate range
            if (from < 0 || to > text.length || from >= to) {
              if (import.meta.env.DEV) {
                // eslint-disable-next-line no-console
                console.warn('[CopyeditMode] Invalid range detected:', {
                  from,
                  to,
                  matchText,
                })
              }
              continue
            }

            if (processedRanges.has(rangeKey)) {
              continue
            }

            if (
              !isExcludedContent(text, from, to) &&
              !isRangeBeingEdited(from, to, cursorPosition)
            ) {
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

          if (
            !isExcludedContent(text, from, to) &&
            !isRangeBeingEdited(from, to, cursorPosition)
          ) {
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

            if (
              !isExcludedContent(text, from, to) &&
              !isRangeBeingEdited(from, to, cursorPosition)
            ) {
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

          if (
            !isExcludedContent(text, from, to) &&
            !isRangeBeingEdited(from, to, cursorPosition)
          ) {
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

            if (
              !isExcludedContent(text, from, to) &&
              !isRangeBeingEdited(from, to, cursorPosition)
            ) {
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

          if (
            !isExcludedContent(text, from, to) &&
            !isRangeBeingEdited(from, to, cursorPosition)
          ) {
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

            if (
              !isExcludedContent(text, from, to) &&
              !isRangeBeingEdited(from, to, cursorPosition)
            ) {
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

          if (
            !isExcludedContent(text, from, to) &&
            !isRangeBeingEdited(from, to, cursorPosition)
          ) {
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

            if (
              !isExcludedContent(text, from, to) &&
              !isRangeBeingEdited(from, to, cursorPosition)
            ) {
              marks.push(
                Decoration.mark({ class: 'cm-pos-conjunction' }).range(from, to)
              )
              processedRanges.add(rangeKey)
            }
          }
        }
      })
    }

    // Sort marks by position to ensure proper application
    marks.sort((a, b) => a.from - b.from)
  } catch (error) {
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.error('[CopyeditMode] Error in NLP processing:', error)
    }
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
    // Always re-analyze when called externally (user toggled settings)
    const enabledPartsOfSpeech = getEnabledPartsOfSpeech()
    const doc = currentEditorView.state.doc.toString()
    const decorations = createPosDecorations(doc, enabledPartsOfSpeech)

    // Preserve cursor position during decoration update
    currentEditorView.dispatch({
      effects: updatePosDecorations.of(decorations),
      selection: currentEditorView.state.selection,
      scrollIntoView: false,
    })

    // Force the view to update by requesting a measure
    currentEditorView.requestMeasure()
  }
}

// Highlight plugin with view tracking
export const highlightPlugin = ViewPlugin.fromClass(
  class {
    private timeoutId: number | null = null
    private hasInitialAnalysis = false
    private isActivelyEditing = false
    private editingTimeoutId: number | null = null

    constructor(public view: EditorView) {
      currentEditorView = view // Store reference for external access
    }

    update(update: ViewUpdate) {
      // Always check if any highlights are enabled and analyze if needed
      const hasHighlights = hasAnyHighlightsEnabled()

      if (hasHighlights && update.docChanged) {
        // ANY document change means we're actively editing
        this.isActivelyEditing = true

        // Clear previous editing timeout
        if (this.editingTimeoutId !== null) {
          clearTimeout(this.editingTimeoutId)
        }

        // Set editing state to false after 3 seconds of complete inactivity
        this.editingTimeoutId = window.setTimeout(() => {
          this.isActivelyEditing = false
          // Immediately re-analyze after editing stops
          this.scheduleAnalysis()
        }, 3000)
      } else if (hasHighlights && !this.hasInitialAnalysis) {
        this.hasInitialAnalysis = true
        this.scheduleAnalysis()
      }
    }

    scheduleAnalysis() {
      if (this.timeoutId !== null) {
        clearTimeout(this.timeoutId)
      }

      // If actively editing, clear decorations immediately and don't schedule analysis
      if (this.isActivelyEditing) {
        this.view.dispatch({
          effects: updatePosDecorations.of(Decoration.none),
        })
        return
      }
      this.timeoutId = window.setTimeout(() => {
        this.analyzeDocument()
      }, 300)
    }

    analyzeDocument() {
      // Skip analysis if actively editing to prevent cursor interference
      if (this.isActivelyEditing) {
        return
      }

      const doc = this.view.state.doc.toString()

      // Get enabled parts of speech from global settings
      const enabledPartsOfSpeech = getEnabledPartsOfSpeech()

      const decorations = createPosDecorations(doc, enabledPartsOfSpeech)

      // Store cursor position before applying decorations
      const currentSelection = this.view.state.selection

      this.view.dispatch({
        effects: updatePosDecorations.of(decorations),
        selection: currentSelection, // Preserve cursor position
        scrollIntoView: false, // Don't scroll when updating decorations
      })
    }

    destroy() {
      if (this.timeoutId !== null) {
        clearTimeout(this.timeoutId)
      }
      if (this.editingTimeoutId !== null) {
        clearTimeout(this.editingTimeoutId)
      }
      if (currentEditorView === this.view) {
        currentEditorView = null // Clear reference
      }
    }
  }
)

// Combined highlight extension
export function createCopyeditModeExtension() {
  return [highlightDecorations, highlightPlugin]
}
