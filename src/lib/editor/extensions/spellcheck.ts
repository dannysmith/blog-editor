/**
 * Native macOS Spell Check Extension
 *
 * Enables native macOS spell checking and grammar checking in CodeMirror 6
 * through WebKit/WKWebView integration in Tauri v2.
 */

import { EditorView } from '@codemirror/view'

/**
 * Creates a spell check extension that enables native macOS spell checking
 *
 * @param enabled - Whether spell checking should be enabled
 * @returns CodeMirror extension array
 */
export function createSpellcheckExtension(enabled: boolean) {
  if (!enabled) return []

  return [
    EditorView.contentAttributes.of({
      spellcheck: 'true',
      autocorrect: 'off', // Disable autocorrect to avoid interference with code
      autocapitalize: 'off', // Disable autocapitalize for technical content
    }),
  ]
}
