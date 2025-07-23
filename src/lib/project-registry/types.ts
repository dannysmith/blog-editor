/**
 * Project Registry Types
 *
 * Simple type definitions for project identification and persistence
 */

export interface ProjectMetadata {
  id: string // Generated project ID (package.json name + path hash if needed)
  name: string // From package.json
  path: string // Current full path
  lastOpened: string // ISO timestamp
  created: string // ISO timestamp
}

export interface ProjectSettings {
  // Project-specific overrides for paths
  pathOverrides: {
    contentDirectory?: string
    assetsDirectory?: string
    mdxComponentsDirectory?: string
  }
  // Project-specific overrides for frontmatter field mappings
  frontmatterMappings: {
    publishedDate?: string
    title?: string
    description?: string
    draft?: string
  }
  // Per-collection view settings
  collectionViewSettings?: {
    [collectionName: string]: {
      showDraftsOnly?: boolean
    }
  }
}

export interface ProjectData {
  metadata: ProjectMetadata
  settings: ProjectSettings
}

export interface ProjectRegistry {
  projects: Record<string, ProjectMetadata> // projectId -> metadata
  lastOpenedProject: string | null
  version: number
}

export interface GlobalSettings {
  general: {
    ideCommand: string
    theme: 'light' | 'dark' | 'system'
    highlights: {
      nouns: boolean
      verbs: boolean
      adjectives: boolean
      adverbs: boolean
      conjunctions: boolean
    }
  }
  // Default settings that apply to new projects
  defaultProjectSettings: ProjectSettings
  version: number
}
