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
import { Card, CardContent, CardHeader } from '../ui/card'
import { Separator } from '../ui/separator'
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
          padding: '16px',
          minHeight: '100%',
          fontFamily: 'iA Writer Mono, SF Mono, Monaco, monospace',
          lineHeight: '1.6',
        },
        '.cm-focused': {
          outline: 'none',
        },
        '.cm-editor': {
          height: '100%',
          backgroundColor: 'transparent',
        },
        '.cm-scroller': {
          height: '100%',
        },
        '.cm-content, .cm-gutter': {
          backgroundColor: 'transparent',
        },
        '&.cm-focused .cm-content': {
          backgroundColor: 'transparent',
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
    <div className="quick-entry-window h-full p-4">
      <Card className="h-full flex flex-col">
        <CardHeader className="pb-4" data-tauri-drag-region>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-medium">Quick Note</h3>
              <span className="text-xs text-muted-foreground">
                → {projectData?.default_collection}
              </span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => void handleClose()}
              className="h-6 w-6 p-0 rounded-full bg-red-500 hover:bg-red-600 text-white hover:text-white"
            >
              ×
            </Button>
          </div>
        </CardHeader>

        <CardContent className="flex-1 flex flex-col gap-4 pt-0">
          {/* Title Input */}
          <Input
            ref={titleRef}
            type="text"
            placeholder="Title (optional)"
            value={title}
            onChange={e => setTitle(e.target.value)}
          />

          <Separator />

          {/* Editor */}
          <div className="flex-1 border rounded-md overflow-hidden">
            <div ref={editorRef} className="h-full" />
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between pt-2">
            <div className="text-xs text-muted-foreground">
              ⌘+Enter to save • Esc to cancel
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => void handleClose()}
                disabled={isSaving}
              >
                Cancel
              </Button>
              <Button
                onClick={() => void handleSave()}
                disabled={isSaving || (!title.trim() && !content.trim())}
              >
                {isSaving ? 'Saving...' : 'Save'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
