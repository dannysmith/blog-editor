import React, { useCallback, useState, useEffect } from 'react'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { usePreferences } from '../../../hooks/usePreferences'
import { useCollectionsQuery } from '../../../hooks/queries/useCollectionsQuery'
import { useProjectStore } from '../../../store/projectStore'
import { toast } from 'sonner'
import { invoke } from '@tauri-apps/api/core'

const SettingsField: React.FC<{
  label: string
  children: React.ReactNode
  description?: string
}> = ({ label, children, description }) => (
  <div className="space-y-2">
    <Label className="text-sm font-medium text-foreground">{label}</Label>
    {children}
    {description && (
      <p className="text-sm text-muted-foreground">{description}</p>
    )}
  </div>
)

const SettingsSection: React.FC<{
  title: string
  children: React.ReactNode
}> = ({ title, children }) => (
  <div className="space-y-4">
    <div>
      <h3 className="text-lg font-medium text-foreground">{title}</h3>
      <Separator className="mt-2" />
    </div>
    <div className="space-y-4">{children}</div>
  </div>
)

export const QuickEntryPane: React.FC = () => {
  const { globalSettings, updateGlobal } = usePreferences()
  const projectPath = useProjectStore(state => state.projectPath)
  const { data: collections = [] } = useCollectionsQuery(projectPath)

  const [shortcutInput, setShortcutInput] = useState(
    globalSettings?.general?.quickEntry?.globalShortcut || 'CmdOrCtrl+Shift+N'
  )
  const [isUpdatingShortcut, setIsUpdatingShortcut] = useState(false)

  // Update local shortcut input when global settings change
  useEffect(() => {
    setShortcutInput(
      globalSettings?.general?.quickEntry?.globalShortcut || 'CmdOrCtrl+Shift+N'
    )
  }, [globalSettings?.general?.quickEntry?.globalShortcut])

  const handleEnabledChange = useCallback(
    async (enabled: boolean) => {
      if (!globalSettings) return

      await updateGlobal({
        general: {
          ...globalSettings.general,
          quickEntry: {
            ...globalSettings.general.quickEntry,
            enabled,
          },
        },
      })

      if (enabled) {
        // Register shortcut when enabling
        try {
          await invoke('register_quick_entry_shortcut', {
            shortcut: globalSettings.general.quickEntry.globalShortcut,
          })
          toast.success('Quick Entry enabled')
        } catch {
          toast.error('Failed to register global shortcut')
        }
      } else {
        // Unregister shortcut when disabling
        try {
          await invoke('unregister_quick_entry_shortcut', {
            shortcut: globalSettings.general.quickEntry.globalShortcut,
          })
          toast.success('Quick Entry disabled')
        } catch {
          // Silent fail for unregistration
        }
      }
    },
    [globalSettings, updateGlobal]
  )

  const handleShortcutChange = useCallback(
    async (value: string) => {
      if (isUpdatingShortcut || !globalSettings) return

      setIsUpdatingShortcut(true)
      const oldShortcut = globalSettings.general.quickEntry.globalShortcut

      try {
        // Unregister old shortcut if enabled
        if (globalSettings.general.quickEntry.enabled) {
          await invoke('unregister_quick_entry_shortcut', {
            shortcut: oldShortcut,
          })
        }

        // Update settings
        await updateGlobal({
          general: {
            ...globalSettings.general,
            quickEntry: {
              ...globalSettings.general.quickEntry,
              globalShortcut: value,
            },
          },
        })

        // Register new shortcut if enabled
        if (globalSettings.general.quickEntry.enabled) {
          await invoke('register_quick_entry_shortcut', {
            shortcut: value,
          })
        }

        toast.success('Global shortcut updated')
      } catch {
        toast.error('Failed to update global shortcut')
        setShortcutInput(oldShortcut) // Revert on error
      } finally {
        setIsUpdatingShortcut(false)
      }
    },
    [globalSettings, updateGlobal, isUpdatingShortcut]
  )

  const handleDefaultCollectionChange = useCallback(
    async (value: string) => {
      if (!globalSettings || value === 'none' || !value || value.trim() === '')
        return

      await updateGlobal({
        general: {
          ...globalSettings.general,
          quickEntry: {
            ...globalSettings.general.quickEntry,
            defaultCollection: value,
          },
        },
      })
    },
    [globalSettings, updateGlobal]
  )

  const handleShortcutInputKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      e.preventDefault()

      const modifiers = []
      if (e.metaKey || e.ctrlKey) modifiers.push('CmdOrCtrl')
      if (e.shiftKey) modifiers.push('Shift')
      if (e.altKey) modifiers.push('Alt')

      // Only capture actual key combinations, not just modifiers
      if (e.key && !['Meta', 'Control', 'Shift', 'Alt'].includes(e.key)) {
        const key = e.key.toUpperCase()
        const shortcut = [...modifiers, key].join('+')
        setShortcutInput(shortcut)
        void handleShortcutChange(shortcut)
      }
    },
    [handleShortcutChange]
  )

  // Early return if settings not loaded yet
  if (!globalSettings) {
    return (
      <div className="space-y-6">
        <div className="text-center text-muted-foreground">Loading...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <SettingsSection title="Quick Entry">
        <SettingsField
          label="Enable Quick Entry"
          description="Allow creating quick notes from anywhere using a global keyboard shortcut"
        >
          <Switch
            checked={globalSettings.general.quickEntry.enabled}
            onCheckedChange={checked => void handleEnabledChange(checked)}
          />
        </SettingsField>

        <SettingsField
          label="Global Shortcut"
          description="Press keys to set shortcut. Try combinations like Cmd+Shift+N"
        >
          <Input
            value={shortcutInput}
            onKeyDown={handleShortcutInputKeyDown}
            placeholder="Press keys to set shortcut"
            disabled={
              !globalSettings.general.quickEntry.enabled || isUpdatingShortcut
            }
            className="font-mono"
          />
        </SettingsField>

        <SettingsField
          label="Default Collection"
          description="Collection where quick notes will be saved"
        >
          <Select
            value={(() => {
              const currentDefault =
                globalSettings.general.quickEntry.defaultCollection
              const validCollections =
                collections?.filter(
                  collection => collection.name && collection.name.trim() !== ''
                ) || []

              // If current default exists and is valid, use it
              if (
                currentDefault &&
                typeof currentDefault === 'string' &&
                currentDefault.trim() !== '' &&
                validCollections.some(c => c.name === currentDefault)
              ) {
                return currentDefault
              }

              // Otherwise, use first valid collection or fallback to 'none'
              if (validCollections.length > 0) {
                const firstName = validCollections[0]?.name
                if (
                  firstName &&
                  typeof firstName === 'string' &&
                  firstName.trim() !== ''
                ) {
                  return firstName
                }
              }

              // Absolute fallback - ensure we NEVER return empty string
              return 'none'
            })()}
            onValueChange={value => void handleDefaultCollectionChange(value)}
            disabled={!globalSettings.general.quickEntry.enabled}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select default collection" />
            </SelectTrigger>
            <SelectContent>
              {(() => {
                // Filter out collections with empty names
                const validCollections =
                  collections?.filter(
                    collection =>
                      collection.name && collection.name.trim() !== ''
                  ) || []

                return validCollections.length > 0 ? (
                  validCollections.map(collection => (
                    <SelectItem key={collection.name} value={collection.name}>
                      {collection.name}
                    </SelectItem>
                  ))
                ) : (
                  <SelectItem value="none" disabled>
                    No collections found
                  </SelectItem>
                )
              })()}
            </SelectContent>
          </Select>
        </SettingsField>
      </SettingsSection>
    </div>
  )
}
