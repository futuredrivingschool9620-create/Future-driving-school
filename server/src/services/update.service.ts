export interface AppUpdateMetadata {
  latestVersion: string;
  releaseDate: string;
  releaseNotes: string[];
  downloadUrl: string;
  mandatory: boolean;
  minSupportedVersion?: string;
}

// In-memory / default version metadata (can be updated via API or env vars)
let currentUpdateInfo: AppUpdateMetadata = {
  latestVersion: process.env.APP_LATEST_VERSION || '1.3.0',
  releaseDate: process.env.APP_RELEASE_DATE || '18 September 2026',
  releaseNotes: [
    '⚡ Instant WhatsApp reminder triggers directly from Documents and Search tables',
    '🚗 Automatic vehicle status sync (auto-marks Expired when documents pass due)',
    '🔔 Overdue cutoff removed — now alerts for all expired documents regardless of age',
    '🛡️ Duplicate reminder protection — eliminated status 500 alert on repeated sends',
    '✨ In-app update notifications & automatic version checking',
  ],
  downloadUrl:
    process.env.APP_DOWNLOAD_URL ||
    'https://github.com/futuredrivingschool9620-create/Future-driving-school/releases/latest',
  mandatory: false,
  minSupportedVersion: '1.0.0',
};

// Cached GitHub release info to prevent rate limits
let lastGitHubFetch = 0;
const CACHE_DURATION_MS = 15 * 60 * 1000; // 15 minutes

export class UpdateService {
  /**
   * Compare two semantic version strings.
   * Returns: 1 if v1 > v2, -1 if v1 < v2, 0 if equal.
   */
  static compareVersions(v1: string, v2: string): number {
    const clean = (v: string) =>
      v
        .replace(/^v/i, '')
        .split('.')
        .map((n) => parseInt(n, 10) || 0);
    const p1 = clean(v1);
    const p2 = clean(v2);
    for (let i = 0; i < Math.max(p1.length, p2.length); i++) {
      const num1 = p1[i] || 0;
      const num2 = p2[i] || 0;
      if (num1 > num2) return 1;
      if (num1 < num2) return -1;
    }
    return 0;
  }

  /**
   * Get the latest version info.
   * Optionally checks GitHub API if 15 minutes have passed since last check.
   */
  static async getVersionInfo(clientVersion?: string): Promise<AppUpdateMetadata & { hasUpdate: boolean; currentVersion: string }> {
    const now = Date.now();

    // Check GitHub Releases if repo is public and cache has expired
    if (now - lastGitHubFetch > CACHE_DURATION_MS) {
      try {
        lastGitHubFetch = now;
        const res = await fetch(
          'https://api.github.com/repos/futuredrivingschool9620-create/Future-driving-school/releases/latest',
          {
            headers: {
              'User-Agent': 'Future-Driving-School-Update-Checker',
              Accept: 'application/vnd.github.v3+json',
            },
          }
        );

        if (res.ok) {
          const data = (await res.json()) as any;
          if (data && data.tag_name) {
            const githubVersion = data.tag_name.replace(/^v/i, '');
            // Only adopt GitHub version if it is greater than or equal to current configured version
            if (this.compareVersions(githubVersion, currentUpdateInfo.latestVersion) >= 0) {
              currentUpdateInfo.latestVersion = githubVersion;
              currentUpdateInfo.releaseDate = new Date(data.published_at || data.created_at).toLocaleDateString('en-IN', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              });
              if (data.body) {
                const lines = data.body
                  .split('\n')
                  .map((l: string) => l.trim().replace(/^[-*•]\s*/, ''))
                  .filter((l: string) => l.length > 0 && !l.startsWith('#'));
                if (lines.length > 0) {
                  currentUpdateInfo.releaseNotes = lines;
                }
              }
              // Check for .exe asset in GitHub release
              const exeAsset = data.assets?.find((a: any) => a.name?.endsWith('.exe'));
              if (exeAsset?.browser_download_url) {
                currentUpdateInfo.downloadUrl = exeAsset.browser_download_url;
              } else if (data.html_url) {
                currentUpdateInfo.downloadUrl = data.html_url;
              }
            }
          }
        }
      } catch (err) {
        // Non-fatal: fallback to server config
        console.warn('[UpdateService] GitHub check skipped/failed, using local metadata');
      }
    }

    const currentVer = clientVersion || '1.2.0';
    const hasUpdate = this.compareVersions(currentUpdateInfo.latestVersion, currentVer) > 0;

    return {
      ...currentUpdateInfo,
      currentVersion: currentVer,
      hasUpdate,
    };
  }

  /**
   * Update version info manually (e.g. from Admin Settings)
   */
  static updateVersionInfo(updates: Partial<AppUpdateMetadata>): AppUpdateMetadata {
    currentUpdateInfo = {
      ...currentUpdateInfo,
      ...updates,
    };
    return currentUpdateInfo;
  }
}
