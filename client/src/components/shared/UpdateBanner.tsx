import React from 'react';
import type { AppVersionInfo } from '../../types';

interface UpdateBannerProps {
  updateInfo: AppVersionInfo | null;
  onOpenDetails: () => void;
  onDownload: () => void;
  onDismiss: () => void;
}

export const UpdateBanner: React.FC<UpdateBannerProps> = ({
  updateInfo,
  onOpenDetails,
  onDownload,
  onDismiss,
}) => {
  if (!updateInfo || !updateInfo.hasUpdate) return null;

  return (
    <aside
      aria-label="Application update announcement"
      className="relative z-30 mx-4 mt-3 mb-2 rounded-2xl p-0.5 shadow-xl transition-all duration-300 animate-slide-down overflow-hidden"
      style={{
        background: 'linear-gradient(90deg, rgba(20, 184, 166, 0.6) 0%, rgba(99, 102, 241, 0.6) 50%, rgba(16, 185, 129, 0.6) 100%)',
      }}
    >
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 rounded-[14px] bg-slate-950/90 backdrop-blur-md">
        {/* Left Information */}
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="relative flex-shrink-0">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-teal-500 to-indigo-500 flex items-center justify-center text-lg shadow-md shadow-teal-500/30">
              🚀
            </div>
            <span className="absolute -top-1 -right-1 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-teal-500"></span>
            </span>
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold uppercase tracking-wider text-teal-300">
                Update Available
              </span>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-white/10 text-white border border-white/10">
                v{updateInfo.latestVersion}
              </span>
              <span className="text-xs text-slate-400 hidden md:inline">
                • Current: v{updateInfo.currentVersion}
              </span>
            </div>
            <p className="text-xs text-slate-300 truncate max-w-lg mt-0.5">
              {updateInfo.releaseNotes?.[0] || 'New WhatsApp reminder controls & performance enhancements.'}
            </p>
          </div>
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-2 self-end sm:self-center flex-shrink-0">
          <button
            onClick={onOpenDetails}
            className="px-3 py-1.5 rounded-xl text-xs font-medium text-slate-300 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 transition-all cursor-pointer"
          >
            What's New
          </button>

          <button
            onClick={onDownload}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold text-white bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 shadow-md shadow-teal-500/20 transition-all cursor-pointer"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            <span>Download</span>
          </button>

          {!updateInfo.mandatory && (
            <button
              onClick={onDismiss}
              className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors ml-1"
              title="Dismiss for 24 hours"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </aside>
  );
};
