import { DocumentStatus } from '../../types';

interface StatusBadgeProps {
  status: DocumentStatus | string;
  daysRemaining: number;
  compact?: boolean;
}

const statusConfig: Record<string, { label: string; bgClass: string; textClass: string; dotClass: string; icon: string }> = {
  [DocumentStatus.ACTIVE]: {
    label: 'Active',
    bgClass: 'bg-emerald-50 dark:bg-emerald-950/50',
    textClass: 'text-emerald-700 dark:text-emerald-400',
    dotClass: 'bg-emerald-500',
    icon: '✓',
  },
  [DocumentStatus.UPCOMING]: {
    label: 'Upcoming (30d)',
    bgClass: 'bg-blue-50 dark:bg-blue-950/50',
    textClass: 'text-blue-700 dark:text-blue-400',
    dotClass: 'bg-blue-500',
    icon: 'ℹ',
  },
  [DocumentStatus.DUE_SOON]: {
    label: 'Due Soon (15d)',
    bgClass: 'bg-amber-50 dark:bg-amber-950/50',
    textClass: 'text-amber-700 dark:text-amber-400',
    dotClass: 'bg-amber-500',
    icon: '⚠',
  },
  [DocumentStatus.CRITICAL]: {
    label: 'Critical (7d)',
    bgClass: 'bg-rose-50 dark:bg-rose-950/50',
    textClass: 'text-rose-700 dark:text-rose-400',
    dotClass: 'bg-rose-500 status-pulse',
    icon: '🚨',
  },
  [DocumentStatus.EXPIRES_TODAY]: {
    label: 'Expires Today',
    bgClass: 'bg-red-50 dark:bg-red-950/50',
    textClass: 'text-red-700 dark:text-red-400',
    dotClass: 'bg-red-500 status-pulse',
    icon: '⏰',
  },
  [DocumentStatus.EXPIRED]: {
    label: 'Expired',
    bgClass: 'bg-red-100 dark:bg-red-950/70',
    textClass: 'text-red-600 dark:text-red-400',
    dotClass: 'bg-red-600',
    icon: '✗',
  },
  [DocumentStatus.RENEWED]: {
    label: 'Renewed',
    bgClass: 'bg-purple-50 dark:bg-purple-950/50',
    textClass: 'text-purple-700 dark:text-purple-400',
    dotClass: 'bg-purple-500',
    icon: '🔄',
  },
  [DocumentStatus.CANCELLED]: {
    label: 'Cancelled',
    bgClass: 'bg-slate-100 dark:bg-slate-800',
    textClass: 'text-slate-600 dark:text-slate-400',
    dotClass: 'bg-slate-500',
    icon: '✕',
  },
};

export default function StatusBadge({ status, daysRemaining, compact = false }: StatusBadgeProps) {
  const config = statusConfig[status] || {
    label: status,
    bgClass: 'bg-slate-100 dark:bg-slate-800',
    textClass: 'text-slate-700 dark:text-slate-300',
    dotClass: 'bg-slate-500',
    icon: '•',
  };

  const getDaysText = () => {
    if (status === DocumentStatus.EXPIRES_TODAY) return 'Today!';
    if (status === DocumentStatus.EXPIRED) {
      const days = Math.abs(daysRemaining);
      return `${days} day${days !== 1 ? 's' : ''} ago`;
    }
    return `${daysRemaining} day${daysRemaining !== 1 ? 's' : ''} left`;
  };

  if (compact) {
    return (
      <span
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${config.bgClass} ${config.textClass}`}
      >
        <span className={`w-1.5 h-1.5 rounded-full ${config.dotClass}`} />
        {config.label}
      </span>
    );
  }

  return (
    <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm font-medium ${config.bgClass} ${config.textClass}`}>
      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${config.dotClass}`} />
      <span>{config.label}</span>
      <span className="text-xs opacity-75">— {getDaysText()}</span>
    </div>
  );
}
