import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { selectHunt, useSelectedHuntId } from '../lib/huntSelection';
import { api } from './client';
import type {
  AiProviderInfo,
  AiSettings,
  AiSettingsInput,
  AiTask,
  AuthStatus,
  EventInput,
  HuntInput,
  HuntSummary,
  ImportRequest,
  ImportResult,
  Job,
  JobHunt,
  JobInput,
  JobQuery,
  JobSummary,
  Preferences,
  Profile,
  Stats,
  TimelineJob,
  User,
  UserInput,
} from './types';

export const queryKeys = {
  jobs: ['jobs'] as const,
  jobList: (query: JobQuery) => ['jobs', 'list', query] as const,
  job: (id: number) => ['jobs', id] as const,
  stats: ['stats'] as const,
  statsOverview: (huntId: number | null) => ['stats', 'overview', huntId] as const,
  huntSummaries: ['stats', 'hunts'] as const,
  hunts: ['hunts'] as const,
  timeline: (includeArchived: boolean, huntId: number | null) =>
    ['jobs', 'timeline', includeArchived, huntId] as const,
  aiSettings: ['ai', 'settings'] as const,
  aiProviders: ['ai', 'providers'] as const,
  profile: ['profile'] as const,
  preferences: ['preferences'] as const,
  importSites: ['import', 'sites'] as const,
  auth: ['auth'] as const,
  health: ['health'] as const,
  users: ['users'] as const,
  registration: ['users', 'registration'] as const,
};

export function useHealth() {
  return useQuery({
    queryKey: queryKeys.health,
    queryFn: () => api.get<{ status: string; version: string }>('/health'),
    staleTime: Infinity,
  });
}

export function useAuthStatus() {
  return useQuery({
    queryKey: queryKeys.auth,
    queryFn: () => api.get<AuthStatus>('/auth/status'),
  });
}

/** The signed-in user. Only use inside the app shell, which renders once someone is signed in. */
export function useCurrentUser(): User {
  const { data } = useAuthStatus();
  if (!data?.user) throw new Error('useCurrentUser was called while signed out');
  return data.user;
}

/**
 * Drops everything cached for the previous user and reloads the auth status, so one person's
 * jobs never flash on screen for the next person who signs in on the same browser.
 */
function useResetSession() {
  const queryClient = useQueryClient();
  return () => {
    selectHunt(null);
    queryClient.removeQueries({ predicate: (query) => query.queryKey[0] !== queryKeys.auth[0] });
    return queryClient.invalidateQueries({ queryKey: queryKeys.auth });
  };
}

export function useSetup() {
  const resetSession = useResetSession();
  return useMutation({
    mutationFn: (input: Omit<UserInput, 'role'> & { setupPassword?: string }) =>
      api.post('/auth/setup', input),
    onSuccess: resetSession,
  });
}

export function useLogin() {
  const resetSession = useResetSession();
  return useMutation({
    mutationFn: (credentials: { username: string; password: string }) =>
      api.post('/auth/login', credentials),
    onSuccess: resetSession,
  });
}

export function useRegister() {
  const resetSession = useResetSession();
  return useMutation({
    mutationFn: (input: Omit<UserInput, 'role'>) => api.post('/auth/register', input),
    onSuccess: resetSession,
  });
}

export function useLogout() {
  const resetSession = useResetSession();
  return useMutation({
    mutationFn: () => api.post('/auth/logout'),
    onSuccess: resetSession,
  });
}

export function useUpdateAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (changes: { displayName: string }) => api.patch<User>('/account', changes),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.auth }),
  });
}

export function useChangePassword() {
  return useMutation({
    mutationFn: (input: { currentPassword: string; password: string }) =>
      api.put('/account/password', input),
  });
}

export function useUsers() {
  return useQuery({ queryKey: queryKeys.users, queryFn: () => api.get<User[]>('/users') });
}

function useUsersChanged() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.users });
    // The signed-in admin may have edited their own account.
    void queryClient.invalidateQueries({ queryKey: queryKeys.auth });
  };
}

export function useCreateUser() {
  const changed = useUsersChanged();
  return useMutation({
    mutationFn: (input: UserInput) => api.post<User>('/users', input),
    onSuccess: changed,
  });
}

export function useUpdateUser() {
  const changed = useUsersChanged();
  return useMutation({
    mutationFn: ({ id, changes }: { id: number; changes: Partial<UserInput> }) =>
      api.patch<User>(`/users/${id}`, changes),
    onSuccess: changed,
  });
}

export function useDeleteUser() {
  const changed = useUsersChanged();
  return useMutation({
    mutationFn: (id: number) => api.delete(`/users/${id}`),
    onSuccess: changed,
  });
}

export function useRegistration() {
  return useQuery({
    queryKey: queryKeys.registration,
    queryFn: () => api.get<{ open: boolean }>('/users/registration'),
  });
}

export function useSetRegistration() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (open: boolean) => api.put<{ open: boolean }>('/users/registration', { open }),
    onSuccess: (data) => queryClient.setQueryData(queryKeys.registration, data),
  });
}

export function useHunts() {
  return useQuery({ queryKey: queryKeys.hunts, queryFn: () => api.get<JobHunt[]>('/hunts') });
}

/**
 * The hunt whose jobs are on screen: the one picked with `selectHunt`, or else the current hunt
 * (the active one, or the most recent when none is active). The server lists that one first.
 * `hunt` is undefined while loading and for someone who has not added a job yet.
 */
export function useViewedHunt() {
  const { data: hunts = [], isPending } = useHunts();
  const selectedId = useSelectedHuntId();
  return {
    hunts,
    isPending,
    hunt: hunts.find((hunt) => hunt.id === selectedId) ?? hunts.at(0),
    active: hunts.find((hunt) => !hunt.endedOn),
    /** Switches to a hunt. Picking the current one goes back to following it. */
    view: (id: number) => selectHunt(id === hunts.at(0)?.id ? null : id),
  };
}

export function useHuntSummaries() {
  return useQuery({
    queryKey: queryKeys.huntSummaries,
    queryFn: () => api.get<HuntSummary[]>('/stats/hunts'),
  });
}

/** Refreshes everything after hunts change: jobs and stats are both scoped by hunt. */
function useHuntsChanged() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.hunts });
    void queryClient.invalidateQueries({ queryKey: queryKeys.jobs });
    void queryClient.invalidateQueries({ queryKey: queryKeys.stats });
  };
}

/** Starts a new hunt, which finishes the active one, and switches to it. */
export function useCreateHunt() {
  const changed = useHuntsChanged();
  return useMutation({
    mutationFn: (input: HuntInput) => api.post<JobHunt>('/hunts', input),
    onSuccess: () => {
      selectHunt(null);
      changed();
    },
  });
}

export function useUpdateHunt() {
  const changed = useHuntsChanged();
  return useMutation({
    mutationFn: ({ id, changes }: { id: number; changes: Partial<HuntInput> }) =>
      api.patch<JobHunt>(`/hunts/${id}`, changes),
    onSuccess: changed,
  });
}

/** Deletes a hunt and every job in it. */
export function useDeleteHunt() {
  const changed = useHuntsChanged();
  return useMutation({
    mutationFn: (id: number) => api.delete(`/hunts/${id}`),
    onSuccess: changed,
  });
}

export function useJobs(query: JobQuery) {
  return useQuery({
    queryKey: queryKeys.jobList(query),
    queryFn: () => api.get<JobSummary[]>('/jobs', { ...query }),
    placeholderData: (previous) => previous,
  });
}

export function useTimeline(includeArchived: boolean) {
  const huntId = useSelectedHuntId();
  return useQuery({
    queryKey: queryKeys.timeline(includeArchived, huntId),
    queryFn: () =>
      api.get<TimelineJob[]>('/jobs/timeline', { includeArchived, huntId: huntId ?? undefined }),
  });
}

export function useJob(id: number) {
  return useQuery({
    queryKey: queryKeys.job(id),
    queryFn: () => api.get<Job>(`/jobs/${id}`),
  });
}

/** Refreshes everything derived from jobs after a change. */
function useJobsChanged() {
  const queryClient = useQueryClient();
  return (job?: Job) => {
    if (job) queryClient.setQueryData(queryKeys.job(job.id), job);
    void queryClient.invalidateQueries({ queryKey: queryKeys.jobs });
    void queryClient.invalidateQueries({ queryKey: queryKeys.stats });
    // Hunts carry a job count, and the first job starts a hunt.
    void queryClient.invalidateQueries({ queryKey: queryKeys.hunts });
  };
}

export function useCreateJob() {
  const changed = useJobsChanged();
  return useMutation({
    mutationFn: (input: JobInput) => api.post<Job>('/jobs', input),
    onSuccess: changed,
  });
}

export function useUpdateJob() {
  const changed = useJobsChanged();
  return useMutation({
    mutationFn: ({ id, changes }: { id: number; changes: Partial<JobInput> }) =>
      api.patch<Job>(`/jobs/${id}`, changes),
    onSuccess: changed,
  });
}

export function useDeleteJob() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.delete(`/jobs/${id}`),
    onSuccess: (_, id) => {
      queryClient.removeQueries({ queryKey: queryKeys.job(id) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.jobs });
      void queryClient.invalidateQueries({ queryKey: queryKeys.stats });
      void queryClient.invalidateQueries({ queryKey: queryKeys.hunts });
    },
  });
}

export function useAddEvent(jobId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: EventInput) => api.post(`/jobs/${jobId}/events`, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.job(jobId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.stats });
    },
  });
}

export function useDeleteEvent(jobId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (eventId: number) => api.delete(`/jobs/${jobId}/events/${eventId}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.job(jobId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.stats });
    },
  });
}

export function useStats() {
  const huntId = useSelectedHuntId();
  return useQuery({
    queryKey: queryKeys.statsOverview(huntId),
    queryFn: () => api.get<Stats>('/stats', { huntId: huntId ?? undefined }),
  });
}

export function useImportJob() {
  return useMutation({
    mutationFn: (input: ImportRequest) => api.post<ImportResult>('/import', input),
  });
}

export function useImportSites() {
  return useQuery({
    queryKey: queryKeys.importSites,
    queryFn: () => api.get<{ id: string; name: string }[]>('/import/sites'),
    staleTime: Infinity,
  });
}

export function useAiProviders() {
  return useQuery({
    queryKey: queryKeys.aiProviders,
    queryFn: () => api.get<AiProviderInfo[]>('/ai/providers'),
    staleTime: Infinity,
  });
}

export function useAiSettings() {
  return useQuery({
    queryKey: queryKeys.aiSettings,
    queryFn: () => api.get<AiSettings>('/ai/settings'),
  });
}

export function useUpdateAiSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: AiSettingsInput) => api.put<AiSettings>('/ai/settings', input),
    onSuccess: (settings) => queryClient.setQueryData(queryKeys.aiSettings, settings),
  });
}

export function useTestAi() {
  return useMutation({ mutationFn: () => api.post<{ reply: string }>('/ai/test') });
}

export function useRunAiTask(jobId: number) {
  const changed = useJobsChanged();
  return useMutation({
    mutationFn: (task: AiTask) => api.post<Job>(`/ai/jobs/${jobId}/${task}`),
    onSuccess: changed,
  });
}

export function useProfile() {
  return useQuery({
    queryKey: queryKeys.profile,
    queryFn: () => api.get<Profile>('/account/profile'),
  });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (profile: Partial<Profile>) => api.put<Profile>('/account/profile', profile),
    onSuccess: (profile) => queryClient.setQueryData(queryKeys.profile, profile),
  });
}

export function usePreferences() {
  return useQuery({
    queryKey: queryKeys.preferences,
    queryFn: () => api.get<Preferences>('/account/preferences'),
  });
}

/** Saves preferences, applying them immediately and rolling back if the server rejects them. */
export function useUpdatePreferences() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (changes: Partial<Preferences>) =>
      api.put<Preferences>('/account/preferences', changes),
    onMutate: async (changes) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.preferences });
      const previous = queryClient.getQueryData<Preferences>(queryKeys.preferences);
      if (previous) queryClient.setQueryData(queryKeys.preferences, { ...previous, ...changes });
      return { previous };
    },
    onError: (_error, _changes, context) => {
      if (context?.previous) queryClient.setQueryData(queryKeys.preferences, context.previous);
    },
    onSuccess: (preferences) => queryClient.setQueryData(queryKeys.preferences, preferences),
  });
}

export function useImportBackup() {
  const changed = useJobsChanged();
  return useMutation({
    mutationFn: (backup: unknown) => api.post<{ imported: number }>('/backup/import', backup),
    onSuccess: () => changed(),
  });
}
