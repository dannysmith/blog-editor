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

## Agent Consultation Notes

### 1. Tauri v2 Expert Consultation

**Key Recommendations**:

**Global Shortcut Implementation**:
- Use `tauri-plugin-global-shortcut = "2"` dependency
- Implement `NSVisualEffectMaterial::Menu` instead of `HudWindow` for better readability
- Use `skip_taskbar(true)` to avoid dock/Alt+Tab interference
- Implement lazy window creation pattern (create on demand vs persistent)

**Critical Architecture Decisions**:
```rust
// Optimal window configuration
.always_on_top(true)
.skip_taskbar(true) // Don't show in Dock/Alt+Tab
.decorations(false)
.transparent(true)
.shadow(true)
.center() // Automatically centers on display with keyboard focus
```

**Multi-Window State Management**:
- Use Tauri's built-in IPC system for window communication
- Shared Rust state via `State` management for cross-window data
- Event-driven updates using `app.emit()` between windows
- Hide vs close strategy: Hide windows for <100ms reopen vs 500ms create

**Performance Optimizations**:
- Bundle splitting with shared runtime chunk
- Lazy loading of CodeMirror and heavy components
- Memory cleanup on window lifecycle events

**Platform Integration**:
- macOS vibrancy with `window_vibrancy::NSVisualEffectMaterial::Menu`
- Global shortcut conflicts handled gracefully with clear error messages
- Multi-display support automatic via Tauri's `.center()` method

### 2. Designer Agent Consultation

**Visual Design Specifications**:

**Layout Proportions** (420×320px base):
- Header: 32px (10%) - Traffic lights + collection indicator
- Editor: ~240px+ (75%+) - Maximum writing space
- Actions: 40px (12.5%) - Save/cancel controls
- Status: 20px (6%) - Auto-save feedback + word count

**Typography System**:
- Primary: iA Writer Duo (consistency with main app)
- Editor: iA Writer Mono for markdown content
- Sizes: Header 11px, Editor 14px/20px, Actions 12px, Status 10px

**Color Palette** (following existing design system):
- Light: `hsl(0 0% 100%)` background, `hsl(0 0% 96%)` cards
- Dark: `hsl(0 0% 7%)` background, `hsl(0 0% 12%)` cards
- Consistent with main app's CSS custom properties

**Interaction Patterns**:
- Instant focus in editor on window appearance
- 0.15s transitions on interactive elements
- Soft ring focus indication with 3px spread
- Smart collection auto-selection (most recently used)

**Component Architecture**:
```
QuickEntryWindow/
├── QuickEntryHeader.tsx     // Title bar with traffic lights
├── QuickEntryEditor.tsx     // CodeMirror integration  
├── QuickEntryFrontmatter.tsx // Collapsible metadata
├── QuickEntryActions.tsx    // Save/cancel buttons
├── QuickEntryStatus.tsx     // Status strip
└── index.tsx               // Main container
```

### 3. macOS UI Engineer Consultation

**Native macOS Refinements**:

**Vibrancy Implementation**:
```rust
// Use Menu material instead of HudWindow for better contrast
apply_vibrancy(
    &window, 
    NSVisualEffectMaterial::Menu,
    Some(NSVisualEffectState::Active),
    Some(12.0) // Corner radius
)
```

**Title Bar Design**:
- Custom traffic lights with only close button (minimize/maximize unnecessary)
- Collection indicator: "Quick Note → Collection Name"
- Proper `data-tauri-drag-region` for dragging
- Window focus/blur states for traffic light appearance

**Typography & Spacing** (macOS HIG compliant):
- Window padding: 20px standard
- Section spacing: 16px (2 × 8px grid)
- Input height: 22px (standard macOS text fields)
- Button height: 32px (standard macOS buttons)

**Keyboard Shortcuts** (macOS conventions):
- `Cmd+S`: Save
- `Cmd+W`: Close window
- `Escape`: Close window  
- `Cmd+Shift+M`: Toggle frontmatter
- `Cmd+Enter`: Save and close

**Focus Management**:
- Auto-focus editor with 150ms delay after window visible
- Position cursor at end of existing content
- Proper VoiceOver/accessibility support with ARIA labels

**Window Position Memory**:
- Save size/position to settings
- Center on active display by default
- Handle multi-display setups automatically

### 4. React Performance Architect Consultation

**Performance Optimizations for <200ms Startup**:

**Bundle Splitting Strategy**:
```typescript
// Separate lightweight entry bundle
build: {
  rollupOptions: {
    input: {
      main: 'index.html',
      'quick-entry': 'quick-entry.html'
    },
    output: {
      manualChunks: {
        'vendor-core': ['react', 'react-dom', 'zustand'],
        'vendor-editor': ['@codemirror/view', '@codemirror/state'], // Load on demand
        'vendor-query': ['@tanstack/react-query'], // Load on demand
      }
    }
  }
}
```

**Ultra-Minimal Component Architecture**:
- Lazy load CodeMirror and frontmatter components
- Shell component with aggressive lazy loading
- Separate loading states for editor vs form components

**Store Architecture**:
```typescript
// Reuse existing stores with selective subscriptions
const projectPath = useProjectStore(state => state.projectPath) // Precise selector
const createQuickNote = useCallback(() => {
  const { currentContent } = useQuickEntryStore.getState() // getState() pattern
}, [])
```

**CodeMirror Optimization**:
- Minimal extension set (basicSetup + markdown only)
- No URL plugin, drag-drop, or heavy extensions
- 1-second debounce for auto-save (faster than main app's 2s)

**Data Loading Strategy**:
- Aggressive caching: 10min staleTime for collections, 5min for schemas
- Only load schema when collection selected
- Reuse main app's query functions where possible

**Performance Monitoring**:
```typescript
// Built-in metrics tracking for development
quickEntryMetrics.mark('editor-ready')
// Alert if startup > 200ms target
```

**Critical Performance Patterns Applied**:
1. `getState()` pattern eliminates callback dependency cascades
2. Lazy loading defers non-critical components
3. Selective subscriptions only for render-affecting data
4. Bundle splitting with shared runtime
5. Minimal CodeMirror extensions
6. Strategic memoization at component boundaries

**Expected Performance Results**:
- Startup: <150ms (target <200ms)
- Memory: ~40MB (vs 80MB main app)
- Bundle: ~300KB initial (vs 800KB main app)
- Keystroke latency: <16ms (60fps)

## REVISED: Simplified Execution Plan

**Requirements Clarification**: User wants ultra-simple floating window with just:
1. Title field (optional frontmatter)
2. Markdown editor content
3. Save to preferred collection
4. Works when main app closed

**Architecture Simplification**: The original plan was over-engineered. Here's the streamlined approach:

## Comprehensive Execution Plan

Based on all agent consultations but **simplified to match actual requirements**:

### Phase 1: Backend Foundation (Days 1-2) - SIMPLIFIED & CORRECTED

#### 1.1 Add Dependencies & Configuration
```bash
# Add to src-tauri/Cargo.toml  
tauri-plugin-global-shortcut = "2"
tauri-plugin-system-tray = "2"  # CRITICAL: App must run in background
window-vibrancy = "0.5"

# Update tauri.conf.json
{
  "plugins": {
    "global-shortcut": { "all": true }
  },
  "systemTray": {
    "iconPath": "icons/icon.png",
    "iconAsTemplate": true
  }
}
```

#### 1.2 Implement System Tray & Global Shortcut System  
**Files to create**:
- `src-tauri/src/commands/quick_entry.rs` - Single file for all quick entry logic

**Key implementations** (corrected based on expert feedback):
```rust
// Critical functions to implement:
#[tauri::command]
async fn spawn_quick_entry_window(app: AppHandle) -> Result<()>

#[tauri::command]
async fn save_quick_note(app: AppHandle, title: String, content: String, collection: String) -> Result<()>

#[tauri::command]
async fn get_quick_entry_data(state: State<'_, AppState>) -> Result<QuickEntryData>
// ^ CRITICAL: Provides project data to quick entry window (Zustand stores don't share across windows)
```

**Window configuration** (corrected):
- Use `NSVisualEffectMaterial::HudWindow` (not Menu) for better contrast
- Size: 420×380px (taller for better spacing)
- System tray mode so app runs in background

#### 1.3 Update Main Rust Application
**Files to modify**:
- `src-tauri/src/lib.rs` - Add quick_entry module + system tray setup
- `src-tauri/src/commands/mod.rs` - Export quick_entry
- `src-tauri/src/main.rs` - Add system tray initialization

### Phase 2: Minimal UI (Days 3-4) - SIMPLIFIED

#### 2.1 Create Simple Quick Entry Bundle
**Files to create**:
- `quick-entry.html` - Basic entry point (no complex bundle splitting needed)
- `src/quick-entry-main.tsx` - Minimal React bootstrap
- **Skip complex vite config changes** - simple is better

#### 2.2 Single Component Architecture (Corrected)
**Files to create**:
- `src/components/quick-entry/QuickEntryWindow.tsx` - **Single component** with:
  - Title input field with auto-focus
  - CodeMirror editor with minimal extensions
  - Save/Cancel buttons with proper keyboard shortcuts
  - **Local React state + Tauri commands** (not Zustand stores)

**CRITICAL CORRECTION**: Cannot use `useProjectStore` across windows. Must use:
```typescript
// Get data via Tauri command instead
const [projectData, setProjectData] = useState<QuickEntryData | null>(null)

useEffect(() => {
  invoke('get_quick_entry_data').then(setProjectData)
}, [])
```

#### 2.3 Keyboard Navigation & macOS Feel
**Required keyboard handling** (from macOS expert):
```typescript
useHotkeys('mod+enter', handleSave)  // ⌘Enter to save
useHotkeys('escape', closeWindow)    // Escape to close
useHotkeys('mod+w', closeWindow)     // ⌘W to close

// Auto-focus on mount
useEffect(() => {
  titleInputRef.current?.focus()
}, [])
```

### Phase 3: Settings Integration (Days 5-6) - SIMPLIFIED

#### 3.1 Add Quick Entry Preference to Global Settings
**Files to modify**:
- `src/lib/project-registry/types.ts` - Add simple quickEntry settings:
  ```typescript
  quickEntry: {
    enabled: boolean
    globalShortcut: string  
    defaultCollection: string
  }
  ```
- `src/lib/project-registry/defaults.ts` - Default values

#### 3.2 Simple Preferences UI
**Files to create**:
- `src/components/preferences/panes/QuickEntryPane.tsx` - Basic form with:
  - Enable/disable toggle
  - Shortcut input field
  - Collection dropdown (reuse existing collection query)

### Phase 4: Integration & Polish (Days 7-8) - SIMPLIFIED

#### 4.1 Connect Global Shortcut to Settings
**Implementation**:
- Register shortcut on app startup from settings
- Update shortcut when preferences change
- **Skip command palette integration for now** - keep it simple

#### 4.2 Basic Error Handling
**Simple error handling**:
- Toast notifications for save errors
- Basic shortcut conflict detection
- **Skip complex edge cases** - handle as they come up

### Final Architecture: Ultra-Simple (CORRECTED)

**Single React Component** (`QuickEntryWindow.tsx`):
```tsx
const QuickEntryWindow = () => {
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [projectData, setProjectData] = useState<QuickEntryData | null>(null)
  const titleRef = useRef<HTMLInputElement>(null)
  
  // CORRECTED: Get data via Tauri command (not Zustand)
  useEffect(() => {
    invoke('get_quick_entry_data').then(setProjectData)
  }, [])
  
  // Auto-focus title on mount
  useEffect(() => {
    titleRef.current?.focus()
  }, [])
  
  // Keyboard shortcuts
  useHotkeys('mod+enter', handleSave)
  useHotkeys('escape', () => getCurrentWindow().close())
  
  const handleSave = async () => {
    if (!projectData) return
    
    const frontmatter = title ? { title } : {}
    
    await invoke('save_quick_note', {
      title,
      content,
      collection: projectData.defaultCollection,
    })
    
    await getCurrentWindow().close()
  }
  
  return (
    <div className="quick-entry-window p-3 h-full flex flex-col">
      <input 
        ref={titleRef}
        type="text" 
        placeholder="Title (optional)"
        value={title}
        onChange={e => setTitle(e.target.value)}
        className="mb-2 px-3 py-1.5 text-sm rounded-md border"
      />
      
      <div className="h-px bg-gray-200 dark:bg-gray-800 mb-2" />
      
      <div className="flex-1 min-h-0">
        <CodeMirrorEditor 
          value={content}
          onChange={setContent}
          extensions={[markdown(), basicKeymap]}
        />
      </div>
      
      <div className="flex justify-end gap-2 mt-3">
        <button 
          onClick={() => getCurrentWindow().close()}
          className="px-4 py-1.5 text-sm rounded-md bg-gray-100"
        >
          Cancel
        </button>
        <button 
          onClick={handleSave}
          className="px-4 py-1.5 text-sm rounded-md bg-blue-500 text-white"
        >
          Save
        </button>  
      </div>
    </div>
  )
}
```

**Critical Architecture Changes**:
1. ✅ App runs in system tray (not fully closed)
2. ✅ Uses Tauri commands for data (not Zustand stores)
3. ✅ Proper keyboard shortcuts & auto-focus
4. ✅ Window size 420×380px with 12px padding
5. ✅ Visual separator between title and editor

**Total Implementation Time: ~8 days instead of 16**

### SIMPLIFIED Implementation Guidelines

**Critical Success Factors** (simplified):
1. **Keep It Simple** - Single component, local state, minimal complexity
2. **Reuse Existing Patterns** - Use current `useProjectStore`, `invoke()` patterns, CodeMirror setup
3. **Leverage Existing File Operations** - Reuse current save logic, don't reinvent
4. **Focus on Core UX** - Title + content + save, that's it

**Key Files to Reference** (simplified):
- `src/store/projectStore.ts` - How to get current project and settings
- `src/components/editor/Editor.tsx` - CodeMirror setup patterns  
- `src/hooks/mutations/useSaveFileMutation.ts` - How to save files
- `src/lib/project-registry/defaults.ts` - How to add new settings

**Quality Gates** (simplified):
- Must work with main app closed
- Must save to correct collection
- Must generate proper frontmatter
- Must feel native on macOS

**Total Complexity Reduction**:
- ❌ 6 separate components → ✅ 1 single component
- ❌ Complex store architecture → ✅ Local React state
- ❌ Bundle splitting optimization → ✅ Simple separate HTML file
- ❌ Advanced performance monitoring → ✅ Basic fast window
- ❌ Complex frontmatter forms → ✅ Single title input
- ❌ Collection dropdown UI → ✅ Preference setting only
- ❌ 16 day implementation → ✅ 8 day implementation

This **simplified plan** matches your actual requirements perfectly and uses existing Astro Editor patterns without over-engineering.

## Expert Review Summary

### Critical Corrections Made:

1. **System Tray Mode Required** (Tauri v2 Expert)
   - Global shortcuts require app to be running in background
   - Added `tauri-plugin-system-tray` dependency
   - App will run with system tray icon (no dock icon)

2. **Cross-Window State Solution** (Tauri v2 Expert)
   - Zustand stores don't share between windows
   - Added `get_quick_entry_data` Tauri command
   - Quick entry window fetches data via `invoke()`

3. **macOS UI Refinements** (macOS UI Engineer)
   - Changed to `HudWindow` vibrancy for better contrast
   - Increased window height to 380px for proper spacing
   - Added keyboard shortcuts (⌘Enter, Escape, ⌘W)
   - Added auto-focus and visual separator

The corrected plan maintains the simplicity while ensuring it will actually work with Tauri v2's architecture and feel native on macOS.