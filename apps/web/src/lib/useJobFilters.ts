import { useSearchParams } from 'react-router';
import { useSelectedHuntId } from './huntSelection';
import {
  JOB_STATUSES,
  WORKPLACE_TYPES,
  type JobQuery,
  type JobSortField,
  type JobStatus,
  type WorkplaceType,
} from '../api/types';

const SORT_FIELDS: JobSortField[] = [
  'updatedAt',
  'createdAt',
  'appliedOn',
  'company',
  'title',
  'interest',
  'status',
];

function listParam<T extends string>(value: string | null, allowed: readonly T[]): T[] {
  return (value?.split(',') ?? []).filter((item): item is T => allowed.includes(item as T));
}

/**
 * Job list filters, stored in the URL so they survive reloads and can be linked to. The hunt
 * is not one of them: it comes from the hunt being viewed.
 */
export function useJobFilters() {
  const [params, setParams] = useSearchParams();

  const huntId = useSelectedHuntId() ?? undefined;

  const sort = params.get('sort');
  const filters: Required<Pick<JobQuery, 'status' | 'workplaceType'>> & JobQuery = {
    huntId,
    q: params.get('q') ?? '',
    status: listParam<JobStatus>(params.get('status'), JOB_STATUSES),
    workplaceType: listParam<WorkplaceType>(params.get('workplaceType'), WORKPLACE_TYPES),
    archived: params.get('archived') === 'true',
    sort: SORT_FIELDS.includes(sort as JobSortField) ? (sort as JobSortField) : 'updatedAt',
    order: params.get('order') === 'asc' ? 'asc' : 'desc',
  };

  const update = (changes: Partial<JobQuery>) => {
    const next = { ...filters, ...changes };
    const entries: [string, string][] = [
      ['q', next.q ?? ''],
      ['status', (next.status ?? []).join(',')],
      ['workplaceType', (next.workplaceType ?? []).join(',')],
      ['archived', next.archived ? 'true' : ''],
      ['sort', next.sort === 'updatedAt' ? '' : (next.sort ?? '')],
      ['order', next.order === 'desc' ? '' : (next.order ?? '')],
    ];
    setParams(new URLSearchParams(entries.filter(([, value]) => value)), { replace: true });
  };

  return [filters, update] as const;
}
