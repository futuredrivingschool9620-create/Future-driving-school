import { useState, useEffect, type FormEvent } from 'react';
import { useAuth } from '../../context/AuthContext';
import { authApi, dashboardApi, appApi } from '../../lib/api';
import type { AppVersionInfo } from '../../types';

export default function SettingsPage() {
  const { logout, admin } = useAuth();

  // Change password state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  // Manual Trigger
  const [isTriggering, setIsTriggering] = useState(false);
  const [triggerMsg, setTriggerMsg] = useState('');

  // App Version & Update State
  const clientVersion = window.electronAPI?.appVersion || '1.2.0';
  const [versionInfo, setVersionInfo] = useState<AppVersionInfo | null>(null);
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
  const [updateMsg, setUpdateMsg] = useState('');

  useEffect(() => {
    const fetchVersion = async () => {
      try {
        const info = await appApi.getVersionInfo(clientVersion);
        setVersionInfo(info);
      } catch {
        // Non-fatal
      }
    };
    fetchVersion();
  }, [clientVersion]);

  const handleCheckUpdate = async () => {
    setIsCheckingUpdate(true);
    setUpdateMsg('');
    try {
      const info = await appApi.getVersionInfo(clientVersion);
      setVersionInfo(info);
      if (info.hasUpdate) {
        setUpdateMsg(`✨ New update v${info.latestVersion} is available!`);
      } else {
        setUpdateMsg(`✅ You are on the latest version (v${info.currentVersion})!`);
      }
    } catch {
      setUpdateMsg('❌ Failed to check for updates. Please verify your connection.');
    } finally {
      setIsCheckingUpdate(false);
    }
  };

  const handleDownloadApp = () => {
    if (!versionInfo?.downloadUrl) return;
    if (window.electronAPI?.openExternalUrl) {
      window.electronAPI.openExternalUrl(versionInfo.downloadUrl);
    } else {
      window.open(versionInfo.downloadUrl, '_blank');
    }
  };

  const handleChangePassword = async (e: FormEvent) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess('');

    if (newPassword !== confirmPassword) {
      setPasswordError('Passwords do not match');
      return;
    }

    if (newPassword.length < 8) {
      setPasswordError('Password must be at least 8 characters');
      return;
    }

    setIsChangingPassword(true);
    try {
      const result = await authApi.changePassword({
        currentPassword,
        newPassword,
        confirmPassword,
      });
      setPasswordSuccess(result.message);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => {
        window.location.href = '/login';
      }, 2000);
    } catch (err: unknown) {
      const message =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { error?: string } } }).response?.data?.error || 'Failed to change password'
          : 'Network error';
      setPasswordError(message);
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleManualCheck = async () => {
    try {
      setIsTriggering(true);
      setTriggerMsg('');
      const res = await dashboardApi.triggerCheck();
      setTriggerMsg(res.message || 'Expiry check run successfully');
    } catch (err) {
      console.error(err);
      setTriggerMsg('Failed to run scheduler');
    } finally {
      setIsTriggering(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
    } catch {
      window.location.href = '/login';
    }
  };

  return (
    <div className="max-w-4xl space-y-6 mx-auto">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
          System Settings & Control Panel
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>
          Manage your account credentials, themes, and automated background workers.
        </p>
      </div>

      {/* Application Updates & Version Control */}
      <div className="glass-card p-6 border border-white/10 rounded-2xl shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/10">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-teal-500 to-indigo-500 flex items-center justify-center text-xl shadow-lg shadow-teal-500/20">
              🚀
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">
                Application Updates & Version Control
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Current release channel, changelog inspection, and update deployment.
              </p>
            </div>
          </div>

          {versionInfo && (
            <div className="flex items-center gap-2 self-start sm:self-auto">
              {versionInfo.hasUpdate ? (
                <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                  <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse"></span>
                  Update Available (v{versionInfo.latestVersion})
                </span>
              ) : (
                <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                  <span className="h-2 w-2 rounded-full bg-emerald-400"></span>
                  Up to Date (v{versionInfo.currentVersion})
                </span>
              )}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 my-4">
          <div className="p-4 rounded-xl bg-white/5 border border-white/5">
            <span className="text-xs font-medium text-slate-400">Installed App Version</span>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-lg font-bold text-white">v{clientVersion}</span>
              {window.electronAPI?.isElectron ? (
                <span className="text-[10px] px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 font-semibold">
                  Windows Desktop App
                </span>
              ) : (
                <span className="text-[10px] px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 font-semibold">
                  Web Client
                </span>
              )}
            </div>
          </div>

          <div className="p-4 rounded-xl bg-white/5 border border-white/5">
            <span className="text-xs font-medium text-slate-400">Latest Available Version</span>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-lg font-bold text-teal-300">
                v{versionInfo?.latestVersion || clientVersion}
              </span>
              <span className="text-xs text-slate-400">
                ({versionInfo?.releaseDate || 'Current'})
              </span>
            </div>
          </div>
        </div>

        {/* What's New bullet points */}
        {versionInfo && versionInfo.releaseNotes && versionInfo.releaseNotes.length > 0 && (
          <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5 mb-4">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-2">
              Changelog & Features (v{versionInfo.latestVersion}):
            </span>
            <ul className="space-y-1.5">
              {versionInfo.releaseNotes.map((note, i) => (
                <li key={i} className="flex items-center gap-2 text-xs text-slate-300">
                  <span className="text-teal-400 font-bold">•</span>
                  <span>{note}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex flex-col sm:flex-row items-center gap-3">
          <button
            onClick={handleCheckUpdate}
            disabled={isCheckingUpdate}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl text-xs font-semibold bg-white/10 hover:bg-white/15 text-white border border-white/10 transition-all disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
          >
            {isCheckingUpdate ? (
              <>
                <svg className="animate-spin h-3.5 w-3.5 text-white" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>Checking Server...</span>
              </>
            ) : (
              <>
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                <span>Check for Updates Now</span>
              </>
            )}
          </button>

          {versionInfo?.hasUpdate && (
            <button
              onClick={handleDownloadApp}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl text-xs font-semibold text-white bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 shadow-md shadow-teal-500/20 transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              <span>Download & Install v{versionInfo.latestVersion} (.exe)</span>
            </button>
          )}
        </div>

        {updateMsg && (
          <p className="text-xs mt-3 text-slate-300 font-medium">
            {updateMsg}
          </p>
        )}
      </div>

      {/* Background Scheduler & Dispatcher */}
      <div className="glass-card p-6">
        <h3 className="text-lg font-bold mb-1" style={{ color: 'var(--color-text-primary)' }}>
          Daily Cron Scheduler
        </h3>
        <p className="text-sm mb-4" style={{ color: 'var(--color-text-muted)' }}>
          Configured for 08:00 AM IST (Asia/Kolkata) daily.
        </p>

        <div className="p-4 rounded-xl mb-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
          <div className="flex items-center justify-between text-xs mb-2">
            <span className="font-semibold text-slate-700 dark:text-slate-300">Engine Status</span>
            <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400 font-bold">
              RUNNING
            </span>
          </div>
          <p className="text-xs text-slate-500">
            Evaluates all documents, triggers 15-day and 7-day daily reminders, and logs them in Notification history.
          </p>
        </div>

        <button
          onClick={handleManualCheck}
          disabled={isTriggering}
          className="w-full py-2.5 rounded-xl text-sm font-semibold bg-teal-600 hover:bg-teal-700 text-white transition-all disabled:opacity-50"
        >
          {isTriggering ? 'Running Expiry Check...' : '⚡ Trigger Immediate Expiry Check'}
        </button>
        {triggerMsg && (
          <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-2 text-center font-medium">
            {triggerMsg}
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Change Password */}
        <div className="glass-card p-6">
          <h3 className="text-lg font-bold mb-1" style={{ color: 'var(--color-text-primary)' }}>
            Change Admin Password
          </h3>
          <p className="text-sm mb-4" style={{ color: 'var(--color-text-muted)' }}>
            Update credentials for user: <strong>{admin?.username}</strong>
          </p>

          <form onSubmit={handleChangePassword} className="space-y-3" id="change-password-form">
            {passwordError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs">
                {passwordError}
              </div>
            )}
            {passwordSuccess && (
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs">
                {passwordSuccess}
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--color-text-secondary)' }}>
                Current Password
              </label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
                className="w-full px-3 py-2 rounded-lg text-sm border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--color-text-secondary)' }}>
                New Password (min 8 chars)
              </label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={8}
                className="w-full px-3 py-2 rounded-lg text-sm border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--color-text-secondary)' }}>
                Confirm New Password
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className="w-full px-3 py-2 rounded-lg text-sm border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
              />
            </div>

            <button
              type="submit"
              disabled={isChangingPassword || !currentPassword || !newPassword || !confirmPassword}
              className="w-full py-2.5 rounded-xl text-sm font-semibold bg-teal-600 text-white hover:bg-teal-700 transition-all disabled:opacity-50"
            >
              {isChangingPassword ? 'Updating...' : 'Update Password'}
            </button>
          </form>
        </div>

        {/* Integration Status & Account */}
        <div className="space-y-6">
          <div className="glass-card p-6">
            <h3 className="text-lg font-bold mb-1" style={{ color: 'var(--color-text-primary)' }}>
              SMS & WhatsApp Gateways
            </h3>
            <p className="text-sm mb-4" style={{ color: 'var(--color-text-muted)' }}>
              Configure provider credentials in <code>server/.env</code>
            </p>

            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                <span className="font-medium text-slate-700 dark:text-slate-300">WhatsApp Business API</span>
                <span className="px-2 py-0.5 rounded bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300 font-mono">
                  READY (MOCK LOGS)
                </span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                <span className="font-medium text-slate-700 dark:text-slate-300">SMS Gateway API</span>
                <span className="px-2 py-0.5 rounded bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300 font-mono">
                  READY (MOCK LOGS)
                </span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                <span className="font-medium text-slate-700 dark:text-slate-300">PostgreSQL Database</span>
                <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400 font-mono font-bold">
                  CONNECTED
                </span>
              </div>
            </div>
          </div>

          <div className="glass-card p-6">
            <h3 className="text-lg font-bold mb-1" style={{ color: 'var(--color-text-primary)' }}>
              Session Management
            </h3>
            <p className="text-sm mb-4" style={{ color: 'var(--color-text-muted)' }}>
              Active Admin: <strong>{admin?.username}</strong> &bull; Role: {admin?.role || 'SUPER_ADMIN'}
            </p>

            <button
              onClick={handleLogout}
              className="w-full py-2.5 rounded-xl text-sm font-semibold bg-rose-50 text-rose-600 hover:bg-rose-100 dark:bg-rose-950/30 dark:hover:bg-rose-950/50 dark:text-rose-400 border border-rose-200 dark:border-rose-800/50 transition-all"
            >
              Sign Out of System
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
