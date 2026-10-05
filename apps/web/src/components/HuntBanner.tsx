import { FolderClock } from 'lucide-react';
import { useState } from 'react';
import { useViewedHunt } from '../api/hooks';
import { formatDate } from '../lib/format';
import { selectHunt } from '../lib/huntSelection';
import { HuntDialogs, type HuntDialog } from './HuntDialogs';
import { Button } from './ui/Button';

/**
 * Shown above pages that list or chart jobs while the hunt on screen is a finished one, so it
 * is never mistaken for the current search.
 */
export function HuntBanner() {
  const { hunt, active } = useViewedHunt();
  const [dialog, setDialog] = useState<HuntDialog>(null);

  return (
    <>
      {hunt?.endedOn && (
        <div className="mb-6 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900 ring-1 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-100 dark:ring-amber-900">
          <FolderClock className="size-4 shrink-0" aria-hidden />
          <p className="min-w-0 flex-1">
            <span className="font-medium">{hunt.name}</span> finished on {formatDate(hunt.endedOn)}.{' '}
            {active
              ? 'You are looking back at an earlier hunt.'
              : 'Start a new hunt when you begin searching again.'}
          </p>
          {active ? (
            <Button size="sm" onClick={() => selectHunt(null)}>
              Back to {active.name}
            </Button>
          ) : (
            <Button size="sm" variant="primary" onClick={() => setDialog({ mode: 'start' })}>
              Start a new hunt
            </Button>
          )}
        </div>
      )}
      <HuntDialogs dialog={dialog} onClose={() => setDialog(null)} />
    </>
  );
}
