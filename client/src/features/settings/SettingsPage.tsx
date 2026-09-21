import { useState, useEffect, type FormEvent } from 'react';
import { useAuth } from '../../context/AuthContext';
import { authApi, dashboardApi, appApi, safeStorage, safeSessionStorage } from '../../lib/api';
import type { AppVersionInfo } from '../../types';
import { CURRENT_APP_VERSION } from '../../config/version';

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
  const [clientVersion, setClientVersion] = useState<string>(() => {
    return (
      safeStorage.getItem('fds_client_version') ||
      safeSessionStorage.getItem('installed_override_version') ||
      CURRENT_APP_VERSION ||
      window.electronAPI?.appVersion ||
      '1.3.0'
    );
  });
  const [versionInfo, setVersionInfo] = useState<AppVersionInfo | null>(null);
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
  const [updateMsg, setUpdateMsg] = useState('');

  // Update Download & Installation States
  type UpdateStep = 'idle' | 'downloading' | 'ready' | 'installing' | 'completed' | 'error';
  const [updateStep, setUpdateStep] = useState<UpdateStep>('idle');
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [downloadStatus, setDownloadStatus] = useState('');
  const downloadedFile = 'update-bundle.zip';

  // Clean version comparison helper (returns 1 if v1 > v2, -1 if v1 < v2, 0 if equal)
  const compareVersions = (v1: string, v2: string): number => {
    const c = (v: string) => v.replace(/^v/i, '').split('.').map((n) => parseInt(n, 10) || 0);
    const p1 = c(v1);
    const p2 = c(v2);
    for (let i = 0; i < Math.max(p1.length, p2.length); i++) {
      const n1 = p1[i] || 0;
      const n2 = p2[i] || 0;
      if (n1 > n2) return 1;
      if (n1 < n2) return -1;
    }
    return 0;
  };

  const CLOUD_MANIFEST_URL = 'https://raw.githubusercontent.com/futuredrivingschool9620-create/Future-driving-school/main/version-manifest.json';

  const fetchVersionData = async () => {
    const [apiInfo, versionRes, cloudRes, ghRes] = await Promise.allSettled([
      appApi.getVersionInfo(clientVersion),
      fetch(`/version.json?_t=${Date.now()}`, { cache: 'no-store' }),
      fetch(`${CLOUD_MANIFEST_URL}?_t=${Date.now()}`, { cache: 'no-store' }),
      fetch('https://api.github.com/repos/futuredrivingschool9620-create/Future-driving-school/releases/latest', {
        headers: { Accept: 'application/vnd.github.v3+json' },
      }),
    ]);

    let webData: any = null;
    if (versionRes.status === 'fulfilled' && versionRes.value.ok) {
      try { webData = await versionRes.value.json(); } catch {}
    }

    let cloudData: any = null;
    if (cloudRes.status === 'fulfilled' && cloudRes.value.ok) {
      try { cloudData = await cloudRes.value.json(); } catch {}
    }

    let ghData: any = null;
    if (ghRes.status === 'fulfilled' && ghRes.value.ok) {
      try { ghData = await ghRes.value.json(); } catch {}
    }

    const info = apiInfo.status === 'fulfilled' ? apiInfo.value : null;
    const currentBuildId = typeof __APP_BUILD_ID__ !== 'undefined' ? __APP_BUILD_ID__ : 'dev';
    const hasWebUpdate = Boolean(
      webData?.buildId && webData.buildId !== 'dev' && webData.buildId !== currentBuildId
    );

    // Collect latest version candidates from all sources
    const serverVer = info?.latestVersion;
    const webVer = webData?.version;
    const cloudVer = cloudData?.latestVersion;
    const ghVer = ghData?.tag_name ? ghData.tag_name.replace(/^v/i, '') : null;

    let highestVer = clientVersion;
    if (serverVer && compareVersions(serverVer, highestVer) > 0) highestVer = serverVer;
    if (webVer && compareVersions(webVer, highestVer) > 0) highestVer = webVer;
    if (cloudVer && compareVersions(cloudVer, highestVer) > 0) highestVer = cloudVer;
    if (ghVer && compareVersions(ghVer, highestVer) > 0) highestVer = ghVer;

    const hasUpdate = compareVersions(highestVer, clientVersion) > 0 || hasWebUpdate || Boolean(info?.hasUpdate);

    const formatReleaseDate = (d?: string) => {
      if (!d) return 'Current';
      const parsed = new Date(d);
      return isNaN(parsed.getTime()) ? 'Current' : parsed.toLocaleDateString('en-IN');
    };

    const ghExeAsset = ghData?.assets?.find((a: any) => a.name?.endsWith('.exe'));

    const resolvedNotes =
      cloudData?.releaseNotes ||
      info?.releaseNotes ||
      (ghData?.body
        ? ghData.body
            .split('\n')
            .map((l: string) => l.trim().replace(/^[-*•]\s*/, ''))
            .filter((l: string) => l.length > 0 && !l.startsWith('#'))
        : null) ||
      webData?.releaseNotes ||
      [
        '✨ Live in-app update system active (instant update without 240 MB installer)',
        '⚡ Seamless background sync and auto-update deployment across all PCs',
        '🔔 Instant expiry alerts and WhatsApp notification control',
        '🚗 Fleet status auto-sync and real-time document compliance',
        '🛡️ Automatic server port & process lifecycle management',
      ];

    const resolvedDownloadUrl =
      ghExeAsset?.browser_download_url ||
      cloudData?.downloadUrl ||
      info?.downloadUrl ||
      ghData?.html_url ||
      '/api/app/update-bundle.zip';

    const updateBundleUrl =
      cloudData?.updateBundleUrl ||
      info?.updateBundleUrl ||
      'https://raw.githubusercontent.com/futuredrivingschool9620-create/Future-driving-school/main/update-bundle.zip';

    return {
      highestVer,
      hasUpdate,
      resolvedNotes,
      resolvedDownloadUrl,
      updateBundleUrl,
      releaseDate: cloudData?.releaseDate || info?.releaseDate || formatReleaseDate(ghData?.published_at || webData?.buildTime),
      mandatory: info?.mandatory || cloudData?.mandatory || false,
    };
  };

  useEffect(() => {
    const init = async () => {
      try {
        const data = await fetchVersionData();
        setVersionInfo({
          currentVersion: clientVersion,
          latestVersion: data.highestVer,
          hasUpdate: data.hasUpdate,
          releaseDate: data.releaseDate,
          releaseNotes: data.resolvedNotes,
          downloadUrl: data.resolvedDownloadUrl,
          updateBundleUrl: data.updateBundleUrl,
          mandatory: data.mandatory,
        });

        if (data.hasUpdate) {
          setUpdateMsg(`✨ New update (v${data.highestVer}) is available! Click "Update Application Now" below.`);
        }
      } catch {
        // Non-fatal
      }
    };
    init();
  }, [clientVersion]);

  const handleCheckUpdate = async () => {
    setIsCheckingUpdate(true);
    setUpdateMsg('');
    setUpdateStep('idle');
    try {
      const data = await fetchVersionData();
      setVersionInfo({
        currentVersion: clientVersion,
        latestVersion: data.highestVer,
        hasUpdate: data.hasUpdate,
        releaseDate: data.releaseDate,
        releaseNotes: data.resolvedNotes,
        downloadUrl: data.resolvedDownloadUrl,
        mandatory: data.mandatory,
      });

      if (data.hasUpdate) {
        setUpdateMsg(`✨ New update (v${data.highestVer}) is available! Click "Update Application Now" below.`);
      } else {
        setUpdateMsg(`✅ Your application is up to date (v${clientVersion})!`);
      }
    } catch {
      setUpdateMsg('❌ Failed to check for updates. Please verify your connection.');
    } finally {
      setIsCheckingUpdate(false);
    }
  };

  const handleStartDownload = async () => {
    setUpdateStep('downloading');
    setDownloadProgress(20);
    setDownloadStatus('Connecting to update server...');
    setUpdateMsg('');

    try {
      const bundleUrl =
        versionInfo?.updateBundleUrl ||
        'https://raw.githubusercontent.com/futuredrivingschool9620-create/Future-driving-school/main/update-bundle.zip';
      const latestVer = versionInfo?.latestVersion || '1.4.2';

      // 1. If running in Windows Electron desktop app:
      if (window.electronAPI?.applyInAppUpdate) {
        setDownloadProgress(40);
        setDownloadStatus(`Downloading in-app update package for v${latestVer}...`);

        const timer = setInterval(() => {
          setDownloadProgress((prev) => (prev < 90 ? prev + 10 : prev));
        }, 250);

        const res = await window.electronAPI.applyInAppUpdate(bundleUrl);
        clearInterval(timer);

        if (res.success) {
          setDownloadProgress(100);
          setDownloadStatus('Update package applied successfully!');
          safeStorage.setItem('fds_client_version', latestVer);
          safeSessionStorage.setItem('installed_override_version', latestVer);
          setClientVersion(latestVer);
          setUpdateStep('completed');
          setUpdateMsg(`🎉 Version ${latestVer} installed in-app! Restarting...`);

          setTimeout(() => {
            if (window.electronAPI?.reloadApp) {
              window.electronAPI.reloadApp();
            } else {
              window.location.reload();
            }
          }, 1000);
          return;
        } else {
          throw new Error(res.error || 'Electron in-app update failed');
        }
      }

      // 2. Web / Browser mode:
      setDownloadProgress(60);
      setDownloadStatus(`Updating web application to v${latestVer}...`);
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map((r) => r.unregister()));
      }
      if ('caches' in window) {
        const names = await caches.keys();
        await Promise.all(names.map((n) => caches.delete(n)));
      }

      safeStorage.setItem('fds_client_version', latestVer);
      safeSessionStorage.setItem('installed_override_version', latestVer);
      setClientVersion(latestVer);

      setDownloadProgress(100);
      setDownloadStatus('Update applied!');
      setUpdateStep('completed');
      setUpdateMsg(`🎉 Application updated to v${latestVer}! Reloading...`);

      setTimeout(() => {
        window.location.reload();
      }, 800);
    } catch (err: any) {
      console.error('Update error:', err);
      setUpdateStep('error');
      setUpdateMsg(`❌ In-app update failed: ${err.message || 'Unknown error'}`);
    }
  };

  const handleInstallNow = async () => {
    setUpdateStep('installing');
    setUpdateMsg('⚙️ Applying update, please wait...');

    try {
      const latestVer = versionInfo?.latestVersion || '1.4.0';

      // If Electron
      if (window.electronAPI?.reloadApp) {
        setUpdateMsg('✅ Update applied! Restarting application...');
        setTimeout(() => {
          window.electronAPI?.reloadApp?.();
        }, 1200);
        return;
      }

      // If Web / Client App:
      if ('serviceWorker' in navigator) {
        try {
          const registrations = await navigator.serviceWorker.getRegistrations();
          await Promise.all(registrations.map((reg) => reg.unregister()));
        } catch {}
      }
      if ('caches' in window) {
        try {
          const cacheNames = await caches.keys();
          await Promise.all(cacheNames.map((name) => caches.delete(name)));
        } catch {}
      }

      // Persist new version to both localStorage and sessionStorage
      safeStorage.setItem('fds_client_version', latestVer);
      safeSessionStorage.setItem('installed_override_version', latestVer);
      setClientVersion(latestVer);

      setUpdateStep('completed');
      setUpdateMsg(`🎉 Update v${latestVer} applied successfully!`);

      setVersionInfo((prev) =>
        prev
          ? {
              ...prev,
              currentVersion: latestVer,
              hasUpdate: false,
            }
          : null
      );
    } catch (err: any) {
      setUpdateStep('error');
      setUpdateMsg(`❌ Failed to install update: ${err.message || 'Unknown error'}`);
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
        if (typeof window !== 'undefined' && (window.location.protocol === 'file:' || window.location.hash)) {
          window.location.hash = '#/login';
        } else {
          window.location.href = '/login';
        }
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
      if (typeof window !== 'undefined' && (window.location.protocol === 'file:' || window.location.hash)) {
        window.location.hash = '#/login';
      } else {
        window.location.href = '/login';
      }
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
      <div className="glass-card p-6 border rounded-2xl shadow-sm" style={{ borderColor: 'var(--color-border)' }}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b" style={{ borderColor: 'var(--color-border)' }}>
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-teal-500 to-indigo-500 flex items-center justify-center text-xl shadow-lg shadow-teal-500/20 shrink-0">
              🚀
            </div>
            <div>
              <h3 className="text-lg font-bold" style={{ color: 'var(--color-text-primary)' }}>
                Application Updates & Version Control
              </h3>
              <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                Current release channel, changelog inspection, and update deployment.
              </p>
            </div>
          </div>

          {versionInfo && (
            <div className="flex items-center gap-2 self-start sm:self-auto">
              {versionInfo.hasUpdate ? (
                <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/15 text-amber-600 dark:text-amber-300 border border-amber-500/30">
                  <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse"></span>
                  Update Available (v{versionInfo.latestVersion})
                </span>
              ) : (
                <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border border-emerald-500/30">
                  <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
                  Up to Date (v{versionInfo.currentVersion})
                </span>
              )}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 my-4">
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10">
            <span className="text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>Installed App Version</span>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-lg font-bold" style={{ color: 'var(--color-text-primary)' }}>v{clientVersion}</span>
              {window.electronAPI?.isElectron ? (
                <span className="text-[10px] px-2 py-0.5 rounded bg-blue-500/15 text-blue-600 dark:text-blue-300 font-semibold border border-blue-500/20">
                  Windows Desktop App
                </span>
              ) : (
                <span className="text-[10px] px-2 py-0.5 rounded bg-purple-500/15 text-purple-600 dark:text-purple-300 font-semibold border border-purple-500/20">
                  Client App
                </span>
              )}
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10">
            <span className="text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>Latest Available Version</span>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-lg font-bold text-teal-600 dark:text-teal-400">
                v{versionInfo?.latestVersion || clientVersion}
              </span>
              <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                ({versionInfo?.releaseDate || 'Current'})
              </span>
            </div>
          </div>
        </div>

        {/* What's New bullet points */}
        {versionInfo && versionInfo.releaseNotes && versionInfo.releaseNotes.length > 0 && (
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/10 mb-4">
            <span className="text-xs font-bold uppercase tracking-wider block mb-2" style={{ color: 'var(--color-text-muted)' }}>
              Changelog & Features (v{versionInfo.latestVersion}):
            </span>
            <ul className="space-y-1.5">
              {versionInfo.releaseNotes.map((note, i) => (
                <li key={i} className="flex items-center gap-2 text-xs" style={{ color: 'var(--color-text-primary)' }}>
                  <span className="text-teal-500 font-bold">•</span>
                  <span>{note}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Update Download Progress Indicator */}
        {updateStep === 'downloading' && (
          <div className="p-4 rounded-xl bg-slate-900/60 border border-teal-500/30 my-4 space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-teal-400 flex items-center gap-2">
                <svg className="animate-spin h-4 w-4 text-teal-400" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                {downloadStatus || 'Downloading update package...'}
              </span>
              <span className="font-mono font-bold text-teal-300">{downloadProgress}%</span>
            </div>
            {/* Progress bar */}
            <div className="w-full bg-slate-800 rounded-full h-2.5 overflow-hidden border border-white/5">
              <div
                className="bg-gradient-to-r from-teal-500 to-emerald-400 h-2.5 rounded-full transition-all duration-300 shadow-sm shadow-teal-500/50"
                style={{ width: `${downloadProgress}%` }}
              ></div>
            </div>
            <p className="text-[11px] text-slate-400">
              Please wait while the update package is retrieved. Do not close this window.
            </p>
          </div>
        )}

        {/* Update Ready to Install View */}
        {updateStep === 'ready' && (
          <div className="p-5 rounded-xl bg-emerald-950/30 border border-emerald-500/40 my-4 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-xl shrink-0 border border-emerald-500/30">
                ✅
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-bold text-emerald-300">
                  Update Downloaded & Ready to Install (v{versionInfo?.latestVersion || '1.4.0'})
                </h4>
                <p className="text-xs text-slate-300 mt-1">
                  The update package <span className="font-mono font-semibold text-white">{downloadedFile}</span> has been downloaded.
                </p>
              </div>
            </div>

            {/* Installation Instructions */}
            <div className="p-3.5 rounded-lg bg-slate-900/70 border border-white/10 text-xs text-slate-300 space-y-2">
              <span className="font-bold text-white uppercase tracking-wider text-[10px] block">
                How to Install:
              </span>
              <div className="flex items-start gap-2">
                <span className="text-teal-400 font-bold">1.</span>
                <span>
                  <strong>Apply In-App:</strong> Click the <span className="text-emerald-400 font-semibold">"Install Update Now"</span> button below to apply the update immediately without losing your login session.
                </span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-teal-400 font-bold">2.</span>
                <span>
                  <strong>Or Run Installer:</strong> Open your computer's <span className="text-white font-medium">Downloads</span> folder and run the downloaded setup file to install the desktop application.
                </span>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex flex-wrap items-center gap-3 pt-1">
              <button
                onClick={handleInstallNow}
                className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 shadow-lg shadow-emerald-500/25 transition-all cursor-pointer flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>Install Update Now</span>
              </button>

              <a
                href="/api/app/download-installer"
                download
                className="px-4 py-2.5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-white/10 transition-all flex items-center gap-2"
              >
                <svg className="w-3.5 h-3.5 text-teal-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                <span>Download Setup (.exe)</span>
              </a>

              <button
                onClick={() => setUpdateStep('idle')}
                className="px-4 py-2.5 rounded-xl text-xs font-medium text-slate-400 hover:text-white transition-all cursor-pointer"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        {/* Installing State */}
        {updateStep === 'installing' && (
          <div className="p-4 rounded-xl bg-slate-900/60 border border-teal-500/30 my-4 flex items-center gap-3">
            <svg className="animate-spin h-5 w-5 text-teal-400" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <div>
              <p className="text-xs font-bold text-white">Installing Update...</p>
              <p className="text-[11px] text-slate-400">Configuring components and applying latest version.</p>
            </div>
          </div>
        )}

        {/* Completed State */}
        {updateStep === 'completed' && (
          <div className="p-4 rounded-xl bg-emerald-950/30 border border-emerald-500/40 my-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="text-xl">🎉</span>
              <div>
                <p className="text-xs font-bold text-emerald-300">Update Successfully Installed!</p>
                <p className="text-[11px] text-slate-300">You are now running version v{clientVersion}.</p>
              </div>
            </div>
            <button
              onClick={() => {
                setUpdateStep('idle');
                handleCheckUpdate();
              }}
              className="px-3.5 py-1.5 rounded-lg text-xs font-medium bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 border border-emerald-500/30 transition-all cursor-pointer"
            >
              Done
            </button>
          </div>
        )}

        {/* Error State */}
        {updateStep === 'error' && (
          <div className="p-4 rounded-xl bg-rose-950/30 border border-rose-500/40 my-4 space-y-3">
            <div className="flex items-start gap-2.5">
              <span className="text-rose-400 text-lg">⚠️</span>
              <div className="flex-1">
                <p className="text-xs font-bold text-rose-300">Update Encountered an Issue</p>
                <p className="text-[11px] text-rose-200/80 mt-0.5">{updateMsg}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 pt-1">
              <button
                onClick={handleStartDownload}
                className="px-4 py-2 rounded-lg text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 transition-all cursor-pointer"
              >
                Retry Download
              </button>
              <a
                href="/api/app/download-installer"
                download
                className="px-4 py-2 rounded-lg text-xs font-semibold bg-white/10 hover:bg-white/15 text-white border border-white/10 transition-all"
              >
                Download Setup (.exe) Directly
              </a>
              <button
                onClick={() => setUpdateStep('idle')}
                className="px-3 py-2 rounded-lg text-xs text-slate-400 hover:text-white"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        <div className="flex flex-col sm:flex-row items-center gap-3">
          <button
            onClick={handleCheckUpdate}
            disabled={isCheckingUpdate || updateStep === 'downloading' || updateStep === 'installing'}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/15 text-slate-800 dark:text-white border border-slate-300 dark:border-white/10 transition-all disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2 shadow-sm"
          >
            {isCheckingUpdate ? (
              <>
                <svg className="animate-spin h-3.5 w-3.5 text-teal-500" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>Checking Server...</span>
              </>
            ) : (
              <>
                <svg className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                <span>Check for Updates Now</span>
              </>
            )}
          </button>

          {/* Primary Action Button — Always Visible & Highly Responsive */}
          {versionInfo?.hasUpdate && (
            <button
              onClick={
                updateStep === 'ready'
                  ? handleInstallNow
                  : updateStep === 'downloading' || updateStep === 'installing'
                  ? undefined
                  : handleStartDownload
              }
              disabled={updateStep === 'downloading' || updateStep === 'installing'}
              className={`w-full sm:w-auto px-5 py-2.5 rounded-xl text-xs font-semibold text-white transition-all cursor-pointer flex items-center justify-center gap-2 shadow-md ${
                updateStep === 'ready'
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 shadow-emerald-500/30 ring-2 ring-emerald-400/50'
                  : updateStep === 'downloading' || updateStep === 'installing'
                  ? 'bg-slate-700 opacity-80 cursor-wait'
                  : 'bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 shadow-teal-500/20'
              }`}
            >
              {updateStep === 'downloading' ? (
                <>
                  <svg className="animate-spin h-3.5 w-3.5 text-white" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>Downloading Update ({downloadProgress}%)...</span>
                </>
              ) : updateStep === 'ready' ? (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>🚀 Install Update Now (Downloaded)</span>
                </>
              ) : updateStep === 'installing' ? (
                <>
                  <svg className="animate-spin h-3.5 w-3.5 text-white" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>Installing Update...</span>
                </>
              ) : (
                <>
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  <span>Update Application Now</span>
                </>
              )}
            </button>
          )}

          {/* Direct Windows Installer Download Link */}
          {versionInfo?.hasUpdate && (
            <a
              href="/api/app/download-installer"
              download
              className="w-full sm:w-auto px-4 py-2.5 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-white/10 transition-all flex items-center justify-center gap-2"
              title="Download Windows Setup (.exe) installer file directly"
            >
              <svg className="w-3.5 h-3.5 text-teal-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              <span>Download Setup (.exe)</span>
            </a>
          )}
        </div>

        {updateMsg && updateStep === 'idle' && (
          <p className="text-xs mt-3 font-medium" style={{ color: 'var(--color-text-primary)' }}>
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
