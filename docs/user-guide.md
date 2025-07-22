# Astro Editor User Guide

## Overview

Astro Editor provides a clean, pleasant user experience for authoring and editing [Markdown](https://www.markdownguide.org/) & [MDX](https://mdxjs.com/) files in the content collections of local [Astro](https://astro.build/) sites.

### Philosophy

Most folks who publish content with Astro work in two distinct _modes_. We're in **coder mode** when we're editing Astro components, pages, CSS etc. This is best done in a _coding tool_ like VSCode. Whe're in **writer mode** when we're writing or editing prose in markdown. Editors designed for coding are not well suited to this - they have too many distractions and lack the kinds of tools which help with writing and editing prose.

Because of this, it's common for folks to **write** in tools like iA Writer or Obsidian and then switch to VSCode to add frontmatter, build and publish. The workflow often looks something like this:

1. Create a new draft markdown file & start writing
2. Edit and tweak (maybe over a number of sessions)
3. Add frontmatter for things like description, tags etc
4. Build & run locally to check everything works
5. Push to github and deploy/publish

Steps 1-3 are very much _writer mode_ tasks, while 4 & 5 are definitely _coder mode_ tasks. Astro Editor is only concerned with the former, which means:

- Code blocks are not syntax highlighted. If you have code examples in your files you're better off authoring them in a coding tool which can properly lint, format and check your code examples.
- There's no mechanism for comitting or publishing in Astro Editor. You should do that in a code editor or terminal.
- There's no way to preview your writing. The best way to do that is by running your astro site locally with `npm run dev` and looking at it there.

Because the goal of this **simplicity when in writer mode**, Astro Editor is intentionally opinionated about its UI and limits the user customisation features to _"making it work with your Astro project and no more"_. It's not possible to customise the colour schemes, typeface etc. If you need fine-grained customization & extensibility we recommend using a custom profile in VSCode (or Obsidian) which you've set up for Markdown editing.

### Astro Requirements

Astro Editor will only work properly with Astro projects which:

- Are using Atro 5+ _(it might work with Astro 4+ but you should expect a few bugs)_
- Use Astro [Content Collections ](https://docs.astro.build/en/guides/content-collections/) and have a `src/content.config.ts` or `/src/content/content.ts`.
- Have at least one collection defined with `defineCollection`. It **must** use the `glob` loader and have a `schema`.
- Have all collections in a single directory: `src/content/[collectionname]`

Content collections can contain non-markdown/MDX files, but they will not be shown in the editor.

Some features require you to have certain properties in your schema. A date field is required for proper ordering in the file list. A boolean field is required to show and filter drafts. A text field is required to show titles in the sidebar. Etc.

By default, Astro Editor expects the following structure in your Astro project:

```
my-astro-site
└── src
    ├── assets
    │   └── mycollection
    │       └── image1.png
    ├── content
    │   └── mycollection
    │       └── blog-post.mdx
    ├── components
    │   └── mdx
    │       └── ExampleAstroComponent.astro
    └── content.config.ts
```

The paths to the _Assets_, _Content_, and _MDX Components_ directories (relative to the project root) are configurable per project, but their internal structures are not.

### Quick Start

[How to open a project and get editing]

### Interface Overview

[Diagram showing & explaning toollbar, file picker sidebar, main editor, frontmatter sidebar & status bar]

## The Editor

The editor window shows the entire contents of your markdown or MDX files with the exception of the YAML frontmatter and any JSX `import` lines immediatly following the frontmatter. It's designed to provide an extremely clean writing interface, especially with both sidebars are closed. It provides markdown syntax highlighting.

### Writing Markdown

[Basic editing, bold italic etc]
[Pasting over text to insert links]
[Lists]
[HTML and JSX highlighting]

### Inserting Images & Files

### Inserting Astro Components into MDX files

### Saving & Auto-Save

### Editor Keyboard Shortcuts

Astro Editor includes the following keyboard shortcuts.

| Shortcut     | Action            | Description                                |
| ------------ | ----------------- | ------------------------------------------ |
| `Cmd+B`      | Bold              | Toggle bold formatting for selected text   |
| `Cmd+I`      | Italic            | Toggle italic formatting for selected text |
| `Cmd+K`      | Link              | Create or edit a link for selected text    |
| `Cmd+]`      | Indent Right      | Indent current line right                  |
| `Cmd+[`      | Indent Left       | Indent current line left                   |
| `Cmd+Z`      | Undo              | Undo the last edit action                  |
| `Cmd+Y`      | Redo              | Redo the last undo action                  |
| `Ctrl+Cmd+F` | Toggle Focus Mode | Enable/disable focus writing mode          |
| `Opt+Click`  | Open URL          | Open URL under mouse cursor in browser     |
| `Opt+Cmd+1`  | Heading 1         | Convert current line to H1                 |
| `Opt+Cmd+2`  | Heading 2         | Convert current line to H2                 |
| `Opt+Cmd+3`  | Heading 3         | Convert current line to H3                 |
| `Opt+Cmd+4`  | Heading 4         | Convert current line to H4                 |
| `Opt+Cmd+0`  | Plain Text        | Convert current line to plain paragraph    |

## The Frontmatter Sidebar

[Where the fields come from]
[How types are displayed - table mapping zod types to visual components]
[How frontmatter is written to file - order, defaults etc]

## The File List Sidebar

[How files are orderd and titles are displayed]
[Draft Markers and filtering by drafts]
[Renaming, Duplicating & Revealing Files]

## The Command Palette

[basic intro to command palette]

### Searching for Files

### Opening in your IDE

## Editing Modes

A number of "modes" can be toggled while writing/editing, which alter how the editor displays your content. These are generally compatible with each other (ie they can be toggled on and off independantly).

### Focus Mode

Dims everything but the current sentence (or line for lists). Can be toggled with the 👁️ icon in the toolbar.

### Typewriter Mode

> [!WARNING]
> This is currently unreliable and could cause the editor window to behave in unexpected ways.

Keeps the editor cursor centered vertically in the window and scrolls the document – much like a typewriter.

### Copyedit Mode

> [!WARNING]
> This fieature is still under active development.

Highlights adjectives, nouns, adverbs, verbs and conjunctions in different colours. Can be useful for spotting problematic or recurring patterns in your writing.

## MDX Components

[How to use the component builder]
[Optimising your Astro Project for this]

## Preferences & Configuration

### General

### Project Settings

### Frontmatter Mappings

## Crash Recovery & Project Settings

[Explain how project settings are saved and how to recover from file loss.]

## Global Keyboard Shortcuts

These work anywhere in the application

| Shortcut | Action                   | Description                                             |
| -------- | ------------------------ | ------------------------------------------------------- |
| `Cmd+S`  | Save File                | Save the currently open file                            |
| `Cmd+N`  | New File                 | Create a new file in the selected collection            |
| `Cmd+W`  | Close File               | Close the currently open file                           |
| `Cmd+P`  | Command Palette          | Open the command palette to search and execute commands |
| `Cmd+,`  | Preferences              | Open application preferences                            |
| `Cmd+0`  | Focus Editor             | Focus the main editor from anywhere in the app          |
| `Cmd+1`  | Toggle Sidebar           | Show/hide the left sidebar (file browser)               |
| `Cmd+2`  | Toggle Frontmatter Panel | Show/hide the right sidebar (frontmatter editor)        |

### Component Builder Keyboard Shortcuts

When the Component Builder dialog is open:

| Shortcut    | Action           | Description                                                |
| ----------- | ---------------- | ---------------------------------------------------------- |
| `Backspace` | Go Back          | Return to component selection (when in configuration step) |
| `Cmd+A`     | Toggle All Props | Select/deselect all optional component properties          |
| `Cmd+Enter` | Insert Component | Insert the configured component into the editor            |
