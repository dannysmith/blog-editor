import { create } from 'zustand'

interface UIState {
  // Layout state
  sidebarVisible: boolean
  frontmatterPanelVisible: boolean
  focusModeEnabled: boolean
  typewriterModeEnabled: boolean
  copyeditModeEnabled: boolean
  distractionFreeBarsHidden: boolean

  // Actions
  toggleSidebar: () => void
  toggleFrontmatterPanel: () => void
  toggleFocusMode: () => void
  toggleTypewriterMode: () => void
  toggleCopyeditMode: () => void
  setDistractionFreeBarsHidden: (hidden: boolean) => void
  handleTypingInEditor: () => void
}

export const useUIStore = create<UIState>((set, get) => ({
  // Initial state
  sidebarVisible: true,
  frontmatterPanelVisible: true,
  focusModeEnabled: false,
  typewriterModeEnabled: false,
  copyeditModeEnabled: false,
  distractionFreeBarsHidden: false,

  // Actions
  toggleSidebar: () => {
    set(state => ({
      sidebarVisible: !state.sidebarVisible,
      // Show bars when opening sidebar
      distractionFreeBarsHidden: false,
    }))
  },

  toggleFrontmatterPanel: () => {
    set(state => ({
      frontmatterPanelVisible: !state.frontmatterPanelVisible,
      // Show bars when opening frontmatter panel
      distractionFreeBarsHidden: false,
    }))
  },

  toggleFocusMode: () => {
    set(state => ({ focusModeEnabled: !state.focusModeEnabled }))
  },

  toggleTypewriterMode: () => {
    set(state => ({ typewriterModeEnabled: !state.typewriterModeEnabled }))
  },

  toggleCopyeditMode: () => {
    set(state => {
      const newState = !state.copyeditModeEnabled
      // eslint-disable-next-line no-console
      console.log(
        '[CopyeditMode] UI Store toggling from',
        state.copyeditModeEnabled,
        'to',
        newState
      )
      return { copyeditModeEnabled: newState }
    })
  },


  setDistractionFreeBarsHidden: (hidden: boolean) => {
    set({ distractionFreeBarsHidden: hidden })
  },

  handleTypingInEditor: () => {
    const { sidebarVisible, frontmatterPanelVisible } = get()
    if (!sidebarVisible && !frontmatterPanelVisible) {
      set({ distractionFreeBarsHidden: true })
    }
  },
}))

// Components can use direct selectors like:
// const sidebarVisible = useUIStore(state => state.sidebarVisible)
