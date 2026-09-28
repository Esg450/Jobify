import type { JobEvent } from '../api/types';
import { EVENT_LABELS, STATUS_LABELS } from '../lib/labels';

/** One-line description of a timeline event. */
export function describeEvent(
  event: Pick<JobEvent, 'type' | 'fromStatus' | 'toStatus' | 'title'>,
): string {
  switch (event.type) {
    case 'created':
      return event.toStatus && event.toStatus !== 'saved'
        ? `Added as ${STATUS_LABELS[event.toStatus].toLowerCase()}`
        : 'Added to Jobify';
    case 'status_change':
      return event.fromStatus && event.toStatus
        ? `${STATUS_LABELS[event.fromStatus]} → ${STATUS_LABELS[event.toStatus]}`
        : EVENT_LABELS.status_change;
    default:
      return event.title || EVENT_LABELS[event.type];
  }
}
