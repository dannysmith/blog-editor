import React, { useState, useRef, useEffect, useCallback } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { useHotkeys } from 'react-hotkeys-hook'
import { EditorView } from '@codemirror/view'
import { EditorState } from '@codemirror/state'
import { markdown } from '@codemirror/lang-markdown'
import { syntaxHighlighting } from '@codemirror/language'
import { history } from '@codemirror/commands'
import { drawSelection, dropCursor } from '@codemirror/view'
import { comprehensiveHighlightStyle } from '../../lib/editor/syntax'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { toast } from 'sonner'

interface QuickEntryData {
  project_path: string
  default_collection: string
  collections: Array<{ name: string; path: string }>
}

export const QuickEntryWindow: React.FC = () => {
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [projectData, setProjectData] = useState<QuickEntryData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  const titleRef = useRef<HTMLInputElement>(null)
  const editorRef = useRef<HTMLDivElement>(null)
  const editorViewRef = useRef<EditorView | null>(null)

  // Load project data on mount
  useEffect(() => {
    const loadData = async () => {
      try {
        const data = await invoke<QuickEntryData>('get_quick_entry_data')
        setProjectData(data)
      } catch {
        toast.error('Failed to load project data')
      } finally {
        setIsLoading(false)
      }
    }
    void loadData()
  }, [])

  // Initialize CodeMirror editor
  useEffect(() => {
    if (!editorRef.current || editorViewRef.current) return

    const extensions = [
      markdown(),
      history(),
      drawSelection(),
      dropCursor(),
      syntaxHighlighting(comprehensiveHighlightStyle),
      EditorView.theme({
        '&': {
          fontSize: '14px',
          height: '100%',
        },
        '.cm-content': {
          padding: '12px',
          minHeight: '100%',
          fontFamily: 'iA Writer Mono, SF Mono, Monaco, monospace',
        },
        '.cm-focused': {
          outline: 'none',
        },
        '.cm-editor': {
          height: '100%',
        },
        '.cm-scroller': {
          height: '100%',
        },
      }),
      EditorView.updateListener.of(update => {
        if (update.docChanged) {
          setContent(update.state.doc.toString())
        }
      }),
    ]

    const state = EditorState.create({
      doc: content,
      extensions,
    })

    const view = new EditorView({
      state,
      parent: editorRef.current,
    })

    editorViewRef.current = view

    return () => {
      view.destroy()
      editorViewRef.current = null
    }
  }, [content])

  // Auto-focus title input when window appears
  useEffect(() => {
    if (!isLoading && titleRef.current) {
      setTimeout(() => {
        titleRef.current?.focus()
      }, 150) // Small delay for smooth appearance
    }
  }, [isLoading])

  // Handle save
  const handleSave = useCallback(async () => {
    if (!projectData || isSaving) return

    setIsSaving(true)
    try {
      await invoke('save_quick_note', {
        title: title.trim(),
        content: content.trim(),
        collection: projectData.default_collection,
      })

      toast.success('Note saved successfully!')
      await getCurrentWindow().close()
    } catch {
      toast.error('Failed to save note')
    } finally {
      setIsSaving(false)
    }
  }, [title, content, projectData, isSaving])

  // Handle close
  const handleClose = useCallback(async () => {
    await getCurrentWindow().close()
  }, [])

  // Keyboard shortcuts
  useHotkeys(
    'mod+enter',
    e => {
      e.preventDefault()
      void handleSave()
    },
    { enableOnFormTags: true }
  )

  useHotkeys(
    'escape',
    e => {
      e.preventDefault()
      void handleClose()
    },
    { enableOnFormTags: true }
  )

  useHotkeys(
    'mod+w',
    e => {
      e.preventDefault()
      void handleClose()
    },
    { enableOnFormTags: true }
  )

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-sm text-muted-foreground">Loading...</div>
      </div>
    )
  }

  return (
    <div className="quick-entry-window h-full flex flex-col bg-background/95 backdrop-blur-sm border border-border/50 rounded-lg shadow-lg">
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 border-b border-border/50"
        data-tauri-drag-region
      >
        <div className="flex items-center gap-2">
          <div className="text-xs text-muted-foreground">
            Quick Note → {projectData?.default_collection}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => void handleClose()}
            className="w-3 h-3 rounded-full bg-red-500 hover:bg-red-600 transition-colors"
            aria-label="Close"
          />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col p-4 gap-3 min-h-0">
        {/* Title Input */}
        <Input
          ref={titleRef}
          type="text"
          placeholder="Title (optional)"
          value={title}
          onChange={e => setTitle(e.target.value)}
          className="border-border/50 bg-background/50"
        />

        {/* Separator */}
        <div className="h-px bg-border/30" />

        {/* Editor */}
        <div className="flex-1 min-h-0 border border-border/50 rounded-md bg-background/30">
          <div ref={editorRef} className="h-full" />
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void handleClose()}
            disabled={isSaving}
          >
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={() => void handleSave()}
            disabled={isSaving || (!title.trim() && !content.trim())}
          >
            {isSaving ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </div>
    </div>
  )
}
