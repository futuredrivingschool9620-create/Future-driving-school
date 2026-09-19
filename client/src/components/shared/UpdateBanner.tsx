import React, { useState } from 'react';

interface UpdateBannerProps {
  onUpdateNow: () => Promise<void> | void;
  onLater: () => void;
}

export const UpdateBanner: React.FC<UpdateBannerProps> = ({ onUpdateNow, onLater }) => {
  const [isUpdating, setIsUpdating] = useState(false);

  const handleUpdate = async () => {
    setIsUpdating(true);
    try {
      await onUpdateNow();
    } catch (err) {
      console.error('Update reload failed:', err);
      window.location.reload();
    }
  };

  return (
    <div
      role="alert"
      aria-live="polite"
      className="fixed top-4 right-4 z-50 max-w-sm w-[calc(100vw-2rem)] sm:w-auto animate-slide-down"
    >
      <div className="rounded-2xl p-0.5 shadow-2xl bg-gradient-to-r from-teal-500 via-indigo-500 to-emerald-500">
        <div className="p-4 rounded-[14px] bg-slate-950/95 backdrop-blur-xl border border-white/10 text-white flex flex-col gap-3">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-teal-500 to-indigo-500 flex items-center justify-center text-xl shadow-lg shadow-teal-500/30 shrink-0">
              🔔
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                New Update Available
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-teal-500/20 text-teal-300 border border-teal-500/30">
                  Live
                </span>
              </h3>
              <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                A new update is available for the system.
              </p>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-1 border-t border-white/5">
            <button
              onClick={onLater}
              disabled={isUpdating}
              className="px-3.5 py-1.5 rounded-xl text-xs font-medium text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 transition-all cursor-pointer disabled:opacity-50"
            >
              Later
            </button>
            <button
              onClick={handleUpdate}
              disabled={isUpdating}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-semibold text-white bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 shadow-lg shadow-teal-500/25 transition-all cursor-pointer disabled:opacity-50"
            >
              {isUpdating ? (
                <>
                  <svg className="animate-spin h-3.5 w-3.5 text-white" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span>Updating...</span>
                </>
              ) : (
                <span>Update Now</span>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
