import { useEffect, useState, useCallback } from 'react'
import { useHotkeys } from 'react-hotkeys-hook'
import { listen } from '@tauri-apps/api/event'
import { invoke } from '@tauri-apps/api/core'
import { useEditorStore } from '../store/editorStore'
import { useProjectStore } from '../store/projectStore'
import { useUIStore } from '../store/uiStore'
import { globalCommandRegistry } from '../lib/editor/commands'
import { toast } from '../lib/toast'
import { initializeRustToastBridge } from '../lib/rust-toast-bridge'
import { focusEditor } from '../lib/focus-utils'
import { useCreateFile } from './useCreateFile'

export function useLayoutEventListeners() {
  const [preferencesOpen, setPreferencesOpen] = useState(false)

  // Only subscribe to data that triggers re-renders (none in this case)
  // Use getState() pattern for all store access in callbacks
  const { createNewFile: createNewFileWithQuery } = useCreateFile()

  // Custom setPreferencesOpen that returns focus to editor when closed
  const handleSetPreferencesOpen = useCallback((open: boolean) => {
    setPreferencesOpen(open)
    if (!open) {
      // Return focus to editor when preferences are closed
      setTimeout(() => {
        focusEditor()
      }, 100) // Small delay to allow dialog to fully close
    }
  }, [])

  // Update format menu state based on editor focus and file presence
  useEffect(() => {
    const { currentFile } = useEditorStore.getState()
    const shouldEnableMenu = Boolean(currentFile && window.isEditorFocused)
    void invoke('update_format_menu_state', { enabled: shouldEnableMenu })
  })

  useEffect(() => {
    window.isEditorFocused = false
    void invoke('update_format_menu_state', { enabled: false })

    const handleEditorFocusChange = () => {
      const { currentFile } = useEditorStore.getState()
      const shouldEnableMenu = Boolean(currentFile && window.isEditorFocused)
      void invoke('update_format_menu_state', { enabled: shouldEnableMenu })
    }

    window.addEventListener('editor-focus-changed', handleEditorFocusChange)
    return () =>
      window.removeEventListener(
        'editor-focus-changed',
        handleEditorFocusChange
      )
  }, [])

  // Keyboard shortcuts
  useHotkeys(
    'mod+s',
    () => {
      // Cmd+S: Save File - get isDirty directly to avoid subscription
      const { currentFile, isDirty, saveFile } = useEditorStore.getState()
      if (currentFile && isDirty) {
        void saveFile()
      }
    },
    { preventDefault: true }
  )

  useHotkeys(
    'mod+1',
    () => {
      // Cmd+1: Toggle Sidebar
      useUIStore.getState().toggleSidebar()
    },
    {
      preventDefault: true,
      enableOnFormTags: ['input', 'textarea', 'select'],
      enableOnContentEditable: true, // Enable in contenteditable elements like CodeMirror
    }
  )

  useHotkeys(
    'mod+2',
    () => {
      // Cmd+2: Toggle Frontmatter Panel
      useUIStore.getState().toggleFrontmatterPanel()
    },
    {
      preventDefault: true,
      enableOnFormTags: ['input', 'textarea', 'select'],
      enableOnContentEditable: true, // Enable in contenteditable elements like CodeMirror
    }
  )

  useHotkeys(
    'mod+n',
    () => {
      // Cmd+N: Create New File (only if a collection is selected)
      const { selectedCollection } = useProjectStore.getState()
      if (selectedCollection) {
        // Use DOM event system to trigger the existing listener
        window.dispatchEvent(new CustomEvent('create-new-file'))
        // Fix for cursor disappearing - ensure cursor is visible
        document.body.style.cursor = 'auto'
        // Force a reflow to ensure the cursor change is applied
        void document.body.offsetHeight
      }
    },
    {
      preventDefault: true,
      enableOnFormTags: true,
      enableOnContentEditable: true,
    }
  )

  useHotkeys(
    'mod+w',
    () => {
      // Cmd+W: Close Current File (only if a file is open)
      const { currentFile, closeCurrentFile } = useEditorStore.getState()
      if (currentFile) {
        closeCurrentFile()
      }
    },
    {
      preventDefault: true,
      enableOnFormTags: ['input', 'textarea', 'select'],
      enableOnContentEditable: true, // Enable in contenteditable elements like CodeMirror
    }
  )

  useHotkeys(
    'mod+comma',
    () => {
      // Cmd+,: Open Preferences
      handleSetPreferencesOpen(true)
    },
    {
      preventDefault: true,
      enableOnFormTags: ['input', 'textarea', 'select'],
      enableOnContentEditable: true, // Enable in contenteditable elements like CodeMirror
    }
  )

  useHotkeys(
    'mod+0',
    () => {
      // Cmd+0: Focus main editor
      focusEditor()
    },
    {
      preventDefault: true,
      enableOnFormTags: ['input', 'textarea', 'select'],
      enableOnContentEditable: true, // Enable in all contexts
    }
  )

  // DOM event listeners for menu actions
  useEffect(() => {
    const handleOpenPreferences = () => {
      handleSetPreferencesOpen(true)
    }

    window.addEventListener('open-preferences', handleOpenPreferences)
    return () =>
      window.removeEventListener('open-preferences', handleOpenPreferences)
  }, [handleSetPreferencesOpen])

  useEffect(() => {
    const handleCreateNewFile = () => {
      void createNewFileWithQuery()
    }

    window.addEventListener('create-new-file', handleCreateNewFile)
    return () =>
      window.removeEventListener('create-new-file', handleCreateNewFile)
  }, [createNewFileWithQuery])

  // Focus mode and typewriter mode event listeners
  useEffect(() => {
    const handleToggleFocusMode = () => {
      useUIStore.getState().toggleFocusMode()
    }

    const handleToggleTypewriterMode = () => {
      useUIStore.getState().toggleTypewriterMode()
    }

    const handleToggleCopyeditMode = () => {
      // eslint-disable-next-line no-console
      console.log('[CopyeditMode] Event listener triggered')
      const currentState = useUIStore.getState().copyeditModeEnabled
      // eslint-disable-next-line no-console
      console.log('[CopyeditMode] Current state:', currentState)
      useUIStore.getState().toggleCopyeditMode()
      const newState = useUIStore.getState().copyeditModeEnabled
      // eslint-disable-next-line no-console
      console.log('[CopyeditMode] New state:', newState)
    }

    const handleFileOpened = (event: Event) => {
      const customEvent = event as CustomEvent<{ collectionName: string }>
      const { collectionName } = customEvent.detail

      // Update the selected collection to match the opened file
      useProjectStore.getState().setSelectedCollection(collectionName)
    }

    window.addEventListener('toggle-focus-mode', handleToggleFocusMode)
    window.addEventListener(
      'toggle-typewriter-mode',
      handleToggleTypewriterMode
    )
    window.addEventListener('toggle-copyedit-mode', handleToggleCopyeditMode)
    window.addEventListener('file-opened', handleFileOpened)

    return () => {
      window.removeEventListener('toggle-focus-mode', handleToggleFocusMode)
      window.removeEventListener(
        'toggle-typewriter-mode',
        handleToggleTypewriterMode
      )
      window.removeEventListener(
        'toggle-copyedit-mode',
        handleToggleCopyeditMode
      )
      window.removeEventListener('file-opened', handleFileOpened)
    }
  }, [])

  // Load persisted project on mount
  useEffect(() => {
    void useProjectStore.getState().loadPersistedProject()
  }, [])

  // Initialize Rust toast bridge
  useEffect(() => {
    let cleanup: (() => void) | undefined

    void initializeRustToastBridge().then(unlisten => {
      cleanup = unlisten
    })

    return () => {
      cleanup?.()
    }
  }, [])

  // Tauri event listeners for menu actions
  useEffect(() => {
    const handleOpenProject = async () => {
      try {
        const projectPath = await invoke<string>('select_project_folder')
        if (projectPath) {
          useProjectStore.getState().setProject(projectPath)
          toast.success('Project opened successfully')
        }
      } catch (error) {
        toast.error('Failed to open project', {
          description:
            error instanceof Error ? error.message : 'Unknown error occurred',
        })
        if (import.meta.env.DEV) {
          // eslint-disable-next-line no-console
          console.error('Failed to open project:', error)
        }
      }
    }

    // Store all unlisten functions for cleanup
    const unlistenFunctions: Array<() => void> = []

    // Set up all listeners asynchronously
    const setupListeners = async () => {
      const unlisteners = await Promise.all([
        listen('menu-open-project', () => {
          void handleOpenProject()
        }),
        listen('menu-save', () => {
          const { currentFile, isDirty, saveFile } = useEditorStore.getState()
          if (currentFile && isDirty) {
            void saveFile()
          }
        }),
        listen('menu-toggle-sidebar', () => {
          useUIStore.getState().toggleSidebar()
        }),
        listen('menu-toggle-frontmatter', () => {
          useUIStore.getState().toggleFrontmatterPanel()
        }),
        listen('menu-new-file', () => {
          const { selectedCollection } = useProjectStore.getState()
          if (selectedCollection) {
            void createNewFileWithQuery()
          }
        }),
        // Text formatting menu listeners
        listen('menu-format-bold', () => {
          const { currentFile } = useEditorStore.getState()
          if (currentFile) {
            globalCommandRegistry.execute('toggleBold')
          }
        }),
        listen('menu-format-italic', () => {
          const { currentFile } = useEditorStore.getState()
          if (currentFile) {
            globalCommandRegistry.execute('toggleItalic')
          }
        }),
        listen('menu-format-link', () => {
          const { currentFile } = useEditorStore.getState()
          if (currentFile) {
            globalCommandRegistry.execute('createLink')
          }
        }),
        listen('menu-format-h1', () => {
          const { currentFile } = useEditorStore.getState()
          if (currentFile) {
            globalCommandRegistry.execute('formatHeading', 1)
          }
        }),
        listen('menu-format-h2', () => {
          const { currentFile } = useEditorStore.getState()
          if (currentFile) {
            globalCommandRegistry.execute('formatHeading', 2)
          }
        }),
        listen('menu-format-h3', () => {
          const { currentFile } = useEditorStore.getState()
          if (currentFile) {
            globalCommandRegistry.execute('formatHeading', 3)
          }
        }),
        listen('menu-format-h4', () => {
          const { currentFile } = useEditorStore.getState()
          if (currentFile) {
            globalCommandRegistry.execute('formatHeading', 4)
          }
        }),
        listen('menu-format-paragraph', () => {
          const { currentFile } = useEditorStore.getState()
          if (currentFile) {
            globalCommandRegistry.execute('formatHeading', 0)
          }
        }),
      ])

      // Add all unlisteners to the array
      unlistenFunctions.push(...unlisteners)
    }

    // Set up listeners
    void setupListeners()

    return () => {
      // Call all unlisten functions
      unlistenFunctions.forEach(unlisten => {
        if (unlisten && typeof unlisten === 'function') {
          unlisten()
        }
      })
    }
  }, [createNewFileWithQuery])

  return {
    preferencesOpen,
    setPreferencesOpen: handleSetPreferencesOpen,
  }
}
