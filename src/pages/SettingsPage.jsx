import { Bell, Download, Moon, Settings, Sun } from 'lucide-react'
import { BackupPanel } from '../components/BackupPanel.jsx'
import { PageIntro, Panel, SectionTitle, SettingRow } from '../components/ui.jsx'

export function SettingsPage({
  backupConfirmed,
  backupFileName,
  backupImporting,
  backupPreview,
  backupRestoring,
  exportBackup,
  health,
  notifications,
  previewBackupFile,
  restoreBackup,
  setBackupConfirmed,
  setNotifications,
  setTheme,
  theme,
}) {
  return (
    <section className="space-y-6">
      <PageIntro kicker="Settings" title="Local controls, no account required." copy="Configure app preferences, notification behavior, and confirm whether backend API keys are present." />
      <div className="grid gap-4 md:grid-cols-2">
        <Panel>
          <SectionTitle icon={Settings} title="API configuration" kicker="Read from .env" />
          <SettingRow label="Gemini API" value={health?.geminiConfigured ? 'Configured' : 'Missing'} />
          <SettingRow label="TMDB API" value={health?.tmdbConfigured ? 'Configured' : 'Missing'} />
          <p className="mt-4 text-sm text-[var(--muted)]">Keys live in the backend `.env` file so the browser never needs to hold them.</p>
        </Panel>
        <Panel>
          <SectionTitle icon={Bell} title="Preferences" kicker="Stored in browser" />
          <button className="setting-toggle" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
            {theme === 'dark' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
            <span>{theme === 'dark' ? 'Dark mode' : 'Light mode'}</span>
          </button>
          <button
            className="setting-toggle mt-3"
            onClick={() => {
              const next = !notifications
              setNotifications(next)
              localStorage.setItem('media-notifications', next ? 'on' : 'off')
            }}
          >
            <Bell className="h-4 w-4" />
            <span>{notifications ? 'Notifications on' : 'Notifications off'}</span>
          </button>
        </Panel>
        <Panel className="md:col-span-2">
          <SectionTitle icon={Download} title="Backup and restore" kicker="Local JSON" />
          <BackupPanel
            fileName={backupFileName}
            importing={backupImporting}
            restoring={backupRestoring}
            preview={backupPreview}
            confirmed={backupConfirmed}
            onExport={exportBackup}
            onPreview={previewBackupFile}
            onConfirm={setBackupConfirmed}
            onRestore={restoreBackup}
          />
        </Panel>
      </div>
    </section>
  )
}
