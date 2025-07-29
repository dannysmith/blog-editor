import React, { useCallback } from 'react'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { usePreferences } from '../../../hooks/usePreferences'
import { useTheme } from '../../../lib/theme-provider'
import { useAvailableIdes } from '../../../hooks/useAvailableIdes'

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

export const GeneralPane: React.FC = () => {
  const { globalSettings, updateGlobal } = usePreferences()
  const { setTheme } = useTheme()
  const { data: availableIdes = [], isLoading: ideLoading } = useAvailableIdes()

  const handleIdeCommandChange = useCallback(
    (value: string) => {
      void updateGlobal({
        general: {
          ideCommand: value === 'none' ? '' : value,
          theme: globalSettings?.general?.theme || 'system',
          highlights: globalSettings?.general?.highlights || {
            nouns: true,
            verbs: true,
            adjectives: true,
            adverbs: true,
            conjunctions: true,
          },
          quickEntry: globalSettings?.general?.quickEntry || {
            enabled: true,
            globalShortcut: 'CmdOrCtrl+Shift+N',
            defaultCollection: 'notes',
          },
        },
      })
    },
    [
      updateGlobal,
      globalSettings?.general?.theme,
      globalSettings?.general?.highlights,
      globalSettings?.general?.quickEntry,
    ]
  )

  const handleThemeChange = useCallback(
    (value: 'light' | 'dark' | 'system') => {
      // Update the theme provider immediately for live preview
      setTheme(value)

      // Also save to global settings for persistence
      // Using current globalSettings state (not getState pattern here as we need the current subscription)
      void updateGlobal({
        general: {
          ideCommand: globalSettings?.general?.ideCommand || '',
          theme: value,
          highlights: globalSettings?.general?.highlights || {
            nouns: true,
            verbs: true,
            adjectives: true,
            adverbs: true,
            conjunctions: true,
          },
          quickEntry: globalSettings?.general?.quickEntry || {
            enabled: true,
            globalShortcut: 'CmdOrCtrl+Shift+N',
            defaultCollection: 'notes',
          },
        },
      })
    },
    [
      setTheme,
      updateGlobal,
      globalSettings?.general?.ideCommand,
      globalSettings?.general?.highlights,
      globalSettings?.general?.quickEntry,
    ]
  )

  return (
    <div className="space-y-6">
      <SettingsSection title="General">
        <SettingsField
          label="IDE Command"
          description="Choose your preferred IDE for opening files and projects"
        >
          <Select
            value={globalSettings?.general?.ideCommand || 'none'}
            onValueChange={handleIdeCommandChange}
            disabled={ideLoading}
          >
            <SelectTrigger>
              <SelectValue
                placeholder={ideLoading ? 'Loading...' : 'Select IDE'}
              />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None</SelectItem>
              {availableIdes.map(ide => {
                const labels: Record<string, string> = {
                  code: 'Visual Studio Code (code)',
                  cursor: 'Cursor (cursor)',
                  subl: 'Sublime Text (subl)',
                  vim: 'Vim (vim)',
                  nvim: 'Neovim (nvim)',
                  emacs: 'Emacs (emacs)',
                }
                return (
                  <SelectItem key={ide} value={ide}>
                    {labels[ide] || `${ide} (${ide})`}
                  </SelectItem>
                )
              })}
              {availableIdes.length === 0 && !ideLoading && (
                <SelectItem value="none" disabled>
                  No IDEs detected
                </SelectItem>
              )}
            </SelectContent>
          </Select>
        </SettingsField>

        <SettingsField
          label="Theme"
          description="Choose your preferred color theme"
        >
          <Select
            value={globalSettings?.general?.theme || 'system'}
            onValueChange={handleThemeChange}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select theme" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="light">Light</SelectItem>
              <SelectItem value="dark">Dark</SelectItem>
              <SelectItem value="system">System</SelectItem>
            </SelectContent>
          </Select>
        </SettingsField>
      </SettingsSection>
    </div>
  )
}
