import type { JobStatus } from '../api/types';
import { cn } from '../lib/cn';
import { STATUS_LABELS, STATUS_STYLES } from '../lib/labels';

export function StatusBadge({ status, className }: { status: JobStatus; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset',
        STATUS_STYLES[status].badge,
        className,
      )}
    >
      <span aria-hidden className={cn('size-1.5 rounded-full', STATUS_STYLES[status].dot)} />
      {STATUS_LABELS[status]}
    </span>
  );
}
