import React from 'react'
import { Input } from '@/components/ui/input'
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

const SettingsField: React.FC<{
  label: string
  children: React.ReactNode
  description?: string
}> = ({ label, children, description }) => (
  <div className="space-y-2">
    <Label className="text-sm font-medium">{label}</Label>
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
      <h3 className="text-lg font-medium">{title}</h3>
      <Separator className="mt-2" />
    </div>
    <div className="space-y-4">{children}</div>
  </div>
)

export const GeneralPane: React.FC = () => {
  const { globalSettings, updateGlobal } = usePreferences()

  const handleIdeCommandChange = (value: string) => {
    void updateGlobal({
      general: {
        ideCommand: value,
        theme: globalSettings?.general?.theme || 'system',
        highlights: globalSettings?.general?.highlights || {
          nouns: true,
          verbs: true,
          adjectives: true,
          adverbs: true,
          conjunctions: true,
        },
      },
    })
  }

  const handleThemeChange = (value: 'light' | 'dark' | 'system') => {
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
      },
    })
  }

  return (
    <div className="space-y-6">
      <SettingsSection title="General">
        <SettingsField
          label="IDE Command"
          description="Command to open files in your preferred IDE (e.g., 'code', 'cursor')"
        >
          <Input
            value={globalSettings?.general?.ideCommand || ''}
            onChange={e => handleIdeCommandChange(e.target.value)}
            placeholder="code"
          />
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
