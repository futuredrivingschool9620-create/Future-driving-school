import React from 'react';
import type { AppVersionInfo } from '../../types';

interface UpdateModalProps {
  isOpen: boolean;
  onClose: () => void;
  updateInfo: AppVersionInfo | null;
  onDownload: () => void;
}

export const UpdateModal: React.FC<UpdateModalProps> = ({
  isOpen,
  onClose,
  updateInfo,
  onDownload,
}) => {
  if (!isOpen || !updateInfo) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-fade-in">
      <div
        className="relative w-full max-w-xl overflow-hidden rounded-2xl border border-white/10 shadow-2xl transition-all"
        style={{
          backgroundColor: '#0f172a',
          backgroundImage: 'radial-gradient(circle at top right, rgba(20, 184, 166, 0.15), transparent 50%), radial-gradient(circle at bottom left, rgba(99, 102, 241, 0.15), transparent 50%)',
        }}
      >
        {/* Header Ribbon / Glow */}
        <div className="relative px-6 pt-6 pb-4 border-b border-white/10">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-teal-500 to-indigo-500 flex items-center justify-center shadow-lg shadow-teal-500/20 text-2xl">
                🚀
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-teal-500/20 text-teal-300 border border-teal-500/30">
                    New Update Ready
                  </span>
                  <span className="text-xs text-slate-400">
                    {updateInfo.releaseDate}
                  </span>
                </div>
                <h3 className="text-xl font-bold text-white mt-1">
                  Future Driving School v{updateInfo.latestVersion}
                </h3>
              </div>
            </div>

            {!updateInfo.mandatory && (
              <button
                onClick={onClose}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors"
                title="Close"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>

          {/* Version Diff Pill */}
          <div className="mt-4 flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/5 text-xs text-slate-300">
            <span>Your Version: <strong className="text-slate-200">v{updateInfo.currentVersion}</strong></span>
            <svg className="w-4 h-4 text-teal-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
            <span>Target Version: <strong className="text-emerald-300 font-semibold">v{updateInfo.latestVersion}</strong></span>
          </div>
        </div>

        {/* Release Notes Body */}
        <div className="px-6 py-5 max-h-72 overflow-y-auto space-y-3">
          <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            What's New in This Release:
          </h4>
          <ul className="space-y-2.5">
            {updateInfo.releaseNotes.map((note, idx) => (
              <li key={idx} className="flex items-start gap-2.5 text-sm text-slate-200 leading-relaxed">
                <span className="flex-shrink-0 mt-0.5 w-5 h-5 rounded-md bg-emerald-500/10 text-emerald-400 flex items-center justify-center text-xs font-bold">
                  ✓
                </span>
                <span>{note}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-white/10 bg-slate-900/60 flex items-center justify-between gap-3">
          {!updateInfo.mandatory ? (
            <button
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl text-xs font-medium text-slate-400 hover:text-white hover:bg-white/5 transition-all"
            >
              Remind Me Later
            </button>
          ) : (
            <span className="text-xs text-amber-400 font-medium">
              ⚠️ This is a required security & stability update.
            </span>
          )}

          <button
            onClick={onDownload}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-xs text-white bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 shadow-lg shadow-teal-500/25 transition-all transform hover:-translate-y-0.5 active:translate-y-0 cursor-pointer"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Download & Install Update
          </button>
        </div>
      </div>
    </div>
  );
};
