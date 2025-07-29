/**
 * Default settings and values for the project registry system
 */

import { GlobalSettings, ProjectSettings, ProjectRegistry } from './types'

export const DEFAULT_PROJECT_SETTINGS: ProjectSettings = {
  pathOverrides: {
    contentDirectory: 'src/content/',
    assetsDirectory: 'src/assets/',
    mdxComponentsDirectory: 'src/components/mdx/',
  },
  frontmatterMappings: {
    publishedDate: 'date', // Will try date, pubDate, publishedDate
    title: 'title',
    description: 'description',
    draft: 'draft',
  },
  collectionViewSettings: {},
}

export const DEFAULT_GLOBAL_SETTINGS: GlobalSettings = {
  general: {
    ideCommand: '',
    theme: 'system',
    highlights: {
      nouns: true,
      verbs: true,
      adjectives: true,
      adverbs: true,
      conjunctions: true,
    },
    quickEntry: {
      enabled: true,
      globalShortcut: 'CmdOrCtrl+Shift+N',
      defaultCollection: 'notes',
    },
  },
  defaultProjectSettings: DEFAULT_PROJECT_SETTINGS,
  version: 1,
}

export const DEFAULT_PROJECT_REGISTRY: ProjectRegistry = {
  projects: {},
  lastOpenedProject: null,
  version: 1,
}
