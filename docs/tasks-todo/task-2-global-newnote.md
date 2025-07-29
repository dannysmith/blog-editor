# Task 2: Global New Note Feature - Technical PRD

## Executive Summary

Implement a system-wide global quick-entry window for Astro Editor that enables rapid note capture from anywhere on macOS. The feature leverages Tauri v2's global shortcut capabilities to spawn a lightweight, floating markdown editor window that saves directly to a user-configured collection without requiring the main application to be open.

**Core Value Proposition**: Reduce friction for note capture by eliminating the need to open the full application, navigate to a collection, and create a new file.

## Technical Requirements

### Functional Requirements

#### FR-1: Global Shortcut System
- **FR-1.1**: Register system-wide keyboard shortcut (default: `Cmd+Shift+N`)
- **FR-1.2**: Shortcut works when main application is closed/backgrounded
- **FR-1.3**: Customizable shortcut preference in main application settings
- **FR-1.4**: Shortcut registration persists across app restarts
- **FR-1.5**: Graceful handling of shortcut conflicts with other applications

#### FR-2: Quick Entry Window
- **FR-2.1**: Lightweight floating window (400x300px minimum, resizable)
- **FR-2.2**: Always-on-top behavior with proper z-order management
- **FR-2.3**: Borderless design with custom window controls
- **FR-2.4**: Automatic positioning (center of active display)
- **FR-2.5**: Window state persistence (size, position)
- **FR-2.6**: Native macOS vibrancy/transparency effects

#### FR-3: Simplified Editor
- **FR-3.1**: CodeMirror 6 editor with markdown syntax highlighting
- **FR-3.2**: Subset of main editor features (no slash commands, no advanced formatting)
- **FR-3.3**: Basic keyboard shortcuts (Cmd+S save, Cmd+W close, Cmd+B bold, Cmd+I italic)
- **FR-3.4**: Real-time markdown preview (optional toggle)
- **FR-3.5**: Auto-focus in editor on window appearance

#### FR-4: Frontmatter Management
- **FR-4.1**: Minimal frontmatter form based on target collection schema
- **FR-4.2**: Auto-population of common fields (date, title from first line)
- **FR-4.3**: Toggle between frontmatter and content editing
- **FR-4.4**: Validation against collection schema before save

#### FR-5: Collection Integration
- **FR-5.1**: User preference for default "quick notes" collection
- **FR-5.2**: Collection dropdown for runtime selection
- **FR-5.3**: Validation that target collection exists and is accessible
- **FR-5.4**: Fallback handling for missing/invalid collections

#### FR-6: File Operations
- **FR-6.1**: Auto-save functionality (2-second interval when content changes)
- **FR-6.2**: Manual save with Cmd+S
- **FR-6.3**: Automatic filename generation based on title/date
- **FR-6.4**: Close and save operation (Cmd+Shift+S or custom shortcut)
- **FR-6.5**: Discard changes option (Escape key or close button)

### Non-Functional Requirements

#### NFR-1: Performance
- **NFR-1.1**: Window spawn time < 500ms from shortcut press
- **NFR-1.2**: Memory footprint < 50MB for quick entry window
- **NFR-1.3**: Smooth animations (60fps) for window appearance/dismissal
- **NFR-1.4**: No impact on main application performance when running

#### NFR-2: Reliability
- **NFR-2.1**: Graceful handling of file system errors
- **NFR-2.2**: Recovery from crash scenarios (draft recovery)
- **NFR-2.3**: Proper cleanup of system resources on window close
- **NFR-2.4**: Robust error handling for global shortcut registration failures

#### NFR-3: Usability
- **NFR-3.1**: Consistent visual design with main application
- **NFR-3.2**: Clear visual feedback for save states
- **NFR-3.3**: Intuitive keyboard navigation
- **NFR-3.4**: Accessibility compliance (VoiceOver, keyboard navigation)

## System Architecture

### High-Level Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Main Window   │    │  Global Shortcut │    │ Quick Entry     │
│   (React App)   │    │   Manager (Rust) │    │ Window (React)  │
├─────────────────┤    ├──────────────────┤    ├─────────────────┤
│ - Settings UI   │◄──►│ - Shortcut Reg   │◄──►│ - Mini Editor   │
│ - Preferences   │    │ - Window Spawn   │    │ - Frontmatter   │
│ - Collection    │    │ - IPC Bridge     │    │ - Auto-save     │
│   Management    │    │                  │    │                 │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
                    ┌──────────────────┐
                    │  Shared Services │
                    ├──────────────────┤
                    │ - File System    │
                    │ - Schema Parser  │
                    │ - Settings Store │
                    │ - Collection API │
                    └──────────────────┘
```

### Component Architecture

#### 1. Global Shortcut Manager (Rust)
**Location**: `src-tauri/src/commands/global_shortcut.rs`

```rust
pub struct GlobalShortcutManager {
    registered_shortcuts: Arc<Mutex<HashMap<String, GlobalShortcut>>>,
    app_handle: AppHandle,
}

#[tauri::command]
pub async fn register_global_shortcut(
    app_handle: AppHandle,
    shortcut: String,
    action: String,
) -> Result<(), String>

#[tauri::command]
pub async fn unregister_global_shortcut(
    app_handle: AppHandle,
    shortcut: String,
) -> Result<(), String>

#[tauri::command]
pub async fn spawn_quick_entry_window(
    app_handle: AppHandle,
) -> Result<(), String>
```

#### 2. Quick Entry Window Manager (Rust)
**Location**: `src-tauri/src/commands/quick_entry.rs`

```rust
pub struct QuickEntryWindow {
    window: Option<Window>,
    settings: QuickEntrySettings,
}

#[derive(Serialize, Deserialize)]
pub struct QuickEntrySettings {
    pub default_collection: String,
    pub window_size: (u32, u32),
    pub window_position: (i32, i32),
    pub auto_save_interval: u64,
}

#[tauri::command]
pub async fn create_quick_entry_window(
    app_handle: AppHandle,
) -> Result<String, String>

#[tauri::command]
pub async fn save_quick_note(
    app_handle: AppHandle,
    content: String,
    frontmatter: serde_json::Value,
    collection: String,
) -> Result<String, String>
```

#### 3. Quick Entry React Components

**Main Component**: `src/components/quick-entry/QuickEntryApp.tsx`
```typescript
interface QuickEntryAppProps {}

export const QuickEntryApp: React.FC<QuickEntryAppProps> = () => {
  // State management for quick entry mode
  // Simplified editor setup
  // Frontmatter form integration
  // Auto-save logic
}
```

**Editor Component**: `src/components/quick-entry/QuickEditor.tsx` 
```typescript
interface QuickEditorProps {
  content: string
  onChange: (content: string) => void
  onSave: () => Promise<void>
  collection: string
}
```

**Frontmatter Form**: `src/components/quick-entry/QuickFrontmatterForm.tsx`
```typescript
interface QuickFrontmatterFormProps {
  schema: z.ZodSchema
  values: Record<string, unknown>
  onChange: (field: string, value: unknown) => void
}
```

#### 4. Settings Integration

**Global Settings Extension**:
```typescript
// src/lib/project-registry/types.ts
export interface GlobalSettings {
  general: {
    // ... existing fields
    quickEntry: {
      enabled: boolean
      globalShortcut: string
      defaultCollection: string
      autoSaveInterval: number
      windowSize: { width: number; height: number }
      showPreview: boolean
    }
  }
  // ... rest unchanged
}
```

## Implementation Details

### 1. Global Shortcut Registration

**Tauri Configuration** (`src-tauri/tauri.conf.json`):
```json
{
  "plugins": {
    "global-shortcut": {
      "shortcuts": []
    }
  }
}
```

**Rust Implementation**:
```rust
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, ShortcutManager};

impl GlobalShortcutManager {
    pub async fn register_quick_entry_shortcut(&mut self, shortcut: &str) -> Result<(), String> {
        let app_handle = self.app_handle.clone();
        
        self.app_handle
            .global_shortcut()
            .register(shortcut, move || {
                let handle = app_handle.clone();
                tauri::async_runtime::spawn(async move {
                    if let Err(e) = spawn_quick_entry_window(handle).await {
                        eprintln!("Failed to spawn quick entry window: {}", e);
                    }
                });
            })
            .map_err(|e| format!("Failed to register global shortcut: {}", e))
    }
}
```

### 2. Quick Entry Window Configuration

**Window Configuration**:
```rust
pub async fn create_quick_entry_window(app_handle: AppHandle) -> Result<WebviewWindow, String> {
    let window = WebviewWindowBuilder::new(
        &app_handle,
        "quick-entry",
        WebviewUrl::App("quick-entry.html".into())
    )
    .title("Quick Note")
    .inner_size(400.0, 300.0)
    .min_inner_size(350.0, 250.0)
    .center()
    .decorations(false)
    .always_on_top(true)
    .resizable(true)
    .transparent(true)
    .shadow(true)
    .visible(false) // Start hidden, show after setup
    .build()
    .map_err(|e| format!("Failed to create window: {}", e))?;

    // Apply macOS vibrancy
    #[cfg(target_os = "macos")]
    {
        use window_vibrancy::{apply_vibrancy, NSVisualEffectMaterial};
        apply_vibrancy(&window, NSVisualEffectMaterial::HudWindow, None, None)
            .map_err(|e| format!("Failed to apply vibrancy: {}", e))?;
    }

    window.show().map_err(|e| format!("Failed to show window: {}", e))?;
    Ok(window)
}
```

### 3. State Management Architecture

**Quick Entry Store** (`src/store/quickEntryStore.ts`):
```typescript
interface QuickEntryState {
  // Content state
  content: string
  frontmatter: Record<string, unknown>
  selectedCollection: string
  
  // UI state
  isVisible: boolean
  isDirty: boolean
  isPreviewMode: boolean
  
  // Settings
  settings: QuickEntrySettings
  
  // Actions
  setContent: (content: string) => void
  updateFrontmatter: (field: string, value: unknown) => void
  setSelectedCollection: (collection: string) => void
  saveNote: () => Promise<void>
  closeWindow: () => void
  resetState: () => void
}

export const useQuickEntryStore = create<QuickEntryState>((set, get) => ({
  // Implementation following Direct Store Pattern
}))
```

### 4. Auto-Save Implementation

**Auto-Save Hook** (`src/hooks/useQuickEntryAutoSave.ts`):
```typescript
export const useQuickEntryAutoSave = () => {
  const { content, frontmatter, isDirty, saveNote } = useQuickEntryStore()
  const settings = useQuickEntryStore(state => state.settings)
  
  useEffect(() => {
    if (!isDirty) return
    
    const timeoutId = setTimeout(() => {
      saveNote()
    }, settings.autoSaveInterval * 1000)
    
    return () => clearTimeout(timeoutId)
  }, [content, frontmatter, isDirty, settings.autoSaveInterval, saveNote])
}
```

### 5. File Generation Logic

**File Naming Strategy**:
```typescript
// src/lib/quick-entry/file-naming.ts
export const generateQuickNoteFilename = (
  content: string,
  frontmatter: Record<string, unknown>
): string => {
  // Priority: frontmatter.title > first line > timestamp
  const title = frontmatter.title as string
  if (title) return slugify(title)
  
  const firstLine = content.split('\n')[0].replace(/^#+\s*/, '').trim()
  if (firstLine.length > 0 && firstLine.length <= 50) {
    return slugify(firstLine)
  }
  
  const timestamp = new Date().toISOString().slice(0, 16).replace('T', '-')
  return `quick-note-${timestamp}`
}
```

### 6. Schema Integration

**Collection Schema Loading**:
```typescript
// src/lib/quick-entry/schema-loader.ts
export const loadCollectionSchema = async (
  projectPath: string,
  collectionName: string
): Promise<z.ZodSchema> => {
  const collections = await invoke<Collection[]>('get_collections', { projectPath })
  const collection = collections.find(c => c.name === collectionName)
  
  if (!collection) {
    throw new Error(`Collection ${collectionName} not found`)
  }
  
  return parseZodSchema(collection.schema)
}
```

## Dependencies & Integrations

### External Dependencies

#### Tauri Plugins
- `tauri-plugin-global-shortcut` - System-wide keyboard shortcut registration
- `tauri-plugin-window-state` - Window position/size persistence
- `window-vibrancy` - macOS visual effects

#### React Dependencies
- All existing dependencies (React 19, CodeMirror 6, Zustand, etc.)
- No additional frontend dependencies required

### Integration Points

#### 1. Main Application Integration
- **Settings UI**: Add quick entry preferences section
- **Command Palette**: Add quick entry commands
- **Menu Integration**: Add quick entry menu items

#### 2. File System Integration
- **Collection Discovery**: Reuse existing collection scanning logic
- **File Creation**: Leverage existing file creation commands
- **Schema Parsing**: Reuse existing Zod schema parsing

#### 3. Editor Integration
- **CodeMirror Setup**: Reuse existing editor configuration with subset of extensions
- **Syntax Highlighting**: Use existing markdown highlighting system
- **Keyboard Shortcuts**: Adapt existing shortcut system for quick entry context

## Acceptance Criteria

### AC-1: Global Shortcut Functionality
- [ ] User can register custom global shortcut in preferences
- [ ] Shortcut works when main app is closed
- [ ] Shortcut spawns quick entry window within 500ms
- [ ] Multiple shortcut presses don't spawn multiple windows
- [ ] Shortcut conflicts are handled gracefully

### AC-2: Quick Entry Window Behavior
- [ ] Window appears centered on active display
- [ ] Window stays on top of all other applications
- [ ] Window can be resized and position is persisted
- [ ] Window has proper macOS visual effects (vibrancy)
- [ ] Window can be closed via Escape, Cmd+W, or close button

### AC-3: Editor Functionality
- [ ] Editor auto-focuses when window appears
- [ ] Markdown syntax highlighting works correctly
- [ ] Basic formatting shortcuts work (Cmd+B, Cmd+I)
- [ ] Content is preserved during window lifetime
- [ ] Auto-save occurs every 2 seconds when content changes

### AC-4: Frontmatter Integration
- [ ] Frontmatter form adapts to selected collection schema
- [ ] Common fields are auto-populated (date, title from content)
- [ ] Frontmatter validation prevents invalid saves
- [ ] Toggle between frontmatter and content editing works

### AC-5: File Operations
- [ ] Files are saved to correct collection directory
- [ ] Filename generation follows defined strategy
- [ ] Save operation includes both content and frontmatter
- [ ] Saved files are properly formatted with frontmatter YAML block
- [ ] File conflicts are handled (increment filename if exists)

### AC-6: Settings Integration
- [ ] Quick entry preferences appear in main app settings
- [ ] Default collection setting is validated and persists
- [ ] Global shortcut setting updates registration immediately
- [ ] Settings changes don't require app restart

### AC-7: Error Handling
- [ ] Invalid collection selection shows clear error message
- [ ] File system errors are handled gracefully
- [ ] Global shortcut registration failures show user notification
- [ ] Network/permission errors don't crash the quick entry window

## Technical Considerations

### Security
- **Sandboxing**: Ensure quick entry window has appropriate filesystem permissions
- **Input Validation**: Sanitize all user input before file operations
- **Path Traversal**: Validate collection paths to prevent unauthorized file access

### Performance
- **Memory Management**: Quick entry window should release resources when closed
- **Editor Optimization**: Use minimal CodeMirror extensions to reduce bundle size
- **Lazy Loading**: Defer non-critical UI components until needed

### Scalability
- **Multiple Projects**: Handle switching between projects gracefully
- **Large Collections**: Optimize collection dropdown for projects with many collections
- **Concurrent Usage**: Handle multiple quick entry sessions if needed in future

### Maintainability
- **Code Reuse**: Maximize reuse of existing editor, file, and schema logic
- **Testing**: Ensure quick entry components are testable in isolation
- **Documentation**: Maintain comprehensive documentation for global shortcut system

## Risk Assessment

### High Risk
**R-1: Global Shortcut Conflicts**
- **Risk**: User's chosen shortcut conflicts with system or other apps
- **Mitigation**: Provide shortcut validation, fallback options, clear error messages
- **Contingency**: Allow multiple shortcut options, detect conflicts automatically

**R-2: Window Management Issues**
- **Risk**: Quick entry window doesn't behave properly across multiple displays/spaces
- **Mitigation**: Extensive testing on various macOS configurations
- **Contingency**: Provide window reset option in preferences

### Medium Risk
**R-3: Performance Impact**
- **Risk**: Global shortcut monitoring impacts system performance
- **Mitigation**: Use efficient shortcut registration, minimal background processes
- **Contingency**: Provide option to disable feature entirely

**R-4: Schema Complexity**
- **Risk**: Complex collection schemas don't work well in simplified UI
- **Mitigation**: Design flexible frontmatter form, provide field prioritization
- **Contingency**: Fall back to basic text fields for complex schemas

### Low Risk
**R-5: File System Permissions**
- **Risk**: Quick entry can't write to selected collection directory
- **Mitigation**: Validate permissions before showing quick entry window
- **Contingency**: Show clear error message with instructions

## Testing Requirements

### Unit Tests
- Global shortcut registration/unregistration logic
- File naming generation algorithms
- Frontmatter form field generation from schemas
- Auto-save timing and debouncing logic

### Integration Tests
- End-to-end quick entry workflow (shortcut → edit → save)
- Cross-window communication between main app and quick entry
- Settings persistence and loading
- Collection schema loading and validation

### Manual Testing
- Multi-display behavior and window positioning
- Keyboard shortcut conflicts with other applications
- macOS accessibility features (VoiceOver, keyboard navigation)
- Window behavior in different macOS versions and configurations

### Performance Tests
- Window spawn time measurement
- Memory usage monitoring during extended use
- Auto-save performance with large content
- Global shortcut responsiveness under system load

---

This PRD provides comprehensive technical guidance for implementing the global new note feature. The architecture leverages existing Astro Editor patterns while introducing minimal new complexity. The implementation should be executed incrementally, starting with the global shortcut system, then the window management, followed by the editor integration, and finally the settings integration.