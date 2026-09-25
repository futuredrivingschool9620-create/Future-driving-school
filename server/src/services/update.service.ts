export interface AppUpdateMetadata {
  buildId?: string;
  latestVersion: string;
  releaseDate: string;
  releaseNotes: string[];
  downloadUrl: string;
  mandatory: boolean;
  minSupportedVersion?: string;
}

// In-memory / default version metadata (can be updated via API or env vars)
let currentUpdateInfo: AppUpdateMetadata = {
  latestVersion: process.env.APP_LATEST_VERSION || '1.5.1',
  releaseDate: process.env.APP_RELEASE_DATE || '25 September 2026',
  releaseNotes: [
    '🛡️ Permanently eliminated all UI flickering across data entry, forms, buttons, and page transitions',
    '⚡ Optimized Skia layout rasterization with 100% solid opaque card paint containment',
    '🖥️ Stabilized Windows DWM compositing and eliminated OS titlebar redraw flashes during navigation',
    '🔄 Extended all-day session integrity and stabilized SSE connection lifecycle after long hours of continuous use',
    '✨ Seamless in-app instant update delivery across all client PCs without external prompts',
  ],
  downloadUrl:
    process.env.APP_DOWNLOAD_URL ||
    '/api/app/update-bundle.zip',
  mandatory: false,
  minSupportedVersion: '1.0.0',
};


// Cached GitHub release info to prevent rate limits
let lastGitHubFetch = 0;
const CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutes

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
   * Checks cloud version-manifest.json from GitHub if cache has expired.
   */
  static async getVersionInfo(clientVersion?: string): Promise<AppUpdateMetadata & { hasUpdate: boolean; currentVersion: string }> {
    const now = Date.now();

    // Check Cloud version-manifest and GitHub Releases in parallel
    if (now - lastGitHubFetch > CACHE_DURATION_MS) {
      lastGitHubFetch = now;
      try {
        const [manifestRes, releaseRes] = await Promise.allSettled([
          fetch(
            'https://raw.githubusercontent.com/futuredrivingschool9620-create/Future-driving-school/main/version-manifest.json',
            { headers: { 'Cache-Control': 'no-cache' } }
          ),
          fetch(
            'https://api.github.com/repos/futuredrivingschool9620-create/Future-driving-school/releases/latest',
            {
              headers: {
                'User-Agent': 'Future-Driving-School-Update-Checker',
                Accept: 'application/vnd.github.v3+json',
              },
            }
          ),
        ]);

        // Process Cloud Manifest
        if (manifestRes.status === 'fulfilled' && manifestRes.value.ok) {
          try {
            const manifest = (await manifestRes.value.json()) as any;
            if (manifest && manifest.latestVersion) {
              if (this.compareVersions(manifest.latestVersion, currentUpdateInfo.latestVersion) >= 0) {
                currentUpdateInfo = { ...currentUpdateInfo, ...manifest };
              }
            }
          } catch {}
        }

        // Process GitHub Release
        if (releaseRes.status === 'fulfilled' && releaseRes.value.ok) {
          try {
            const data = (await releaseRes.value.json()) as any;
            if (data && data.tag_name) {
              const githubVersion = data.tag_name.replace(/^v/i, '');
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
                const exeAsset = data.assets?.find((a: any) => a.name?.endsWith('.exe'));
                if (exeAsset?.browser_download_url) {
                  currentUpdateInfo.downloadUrl = exeAsset.browser_download_url;
                } else if (data.html_url) {
                  currentUpdateInfo.downloadUrl = data.html_url;
                }
              }
            }
          } catch {}
        }
      } catch (err) {
        console.warn('[UpdateService] Cloud version check skipped/failed, using local metadata');
      }
    }

    const currentVer = clientVersion || currentUpdateInfo.latestVersion;
    const hasUpdate = this.compareVersions(currentUpdateInfo.latestVersion, currentVer) > 0;
    const buildId = process.env.VERCEL_GIT_COMMIT_SHA || process.env.VERCEL_DEPLOYMENT_ID || '1.3.0';

    return {
      ...currentUpdateInfo,
      buildId,
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
