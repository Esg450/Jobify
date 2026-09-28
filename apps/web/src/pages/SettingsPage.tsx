import { Download, Upload } from 'lucide-react';
import { useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import {
  useAiProviders,
  useAiSettings,
  useHealth,
  useImportBackup,
  useProfile,
  useTestAi,
  useUpdateAiSettings,
  useUpdateProfile,
} from '../api/hooks';
import type { AiProviderId, AiProviderInfo, AiSettings, Profile } from '../api/types';
import { PageHeader } from '../components/PageHeader';
import { Button } from '../components/ui/Button';
import { Card, CardHeader } from '../components/ui/Card';
import { Alert, errorText } from '../components/ui/feedback';
import { Field, Input, Select, Textarea } from '../components/ui/fields';
import { PageSpinner } from '../components/ui/Spinner';

export function SettingsPage() {
  const ai = useAiSettings();
  const providers = useAiProviders();
  const profile = useProfile();
  const { data: health } = useHealth();

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Settings"
        description={
          health &&
          `Jobify ${health.version === 'dev' ? 'development build' : `v${health.version}`}`
        }
      />
      <div className="flex flex-col gap-6">
        {ai.data && providers.data ? (
          <AiSettingsCard settings={ai.data} providers={providers.data} />
        ) : (
          <PageSpinner />
        )}
        {profile.data && <ProfileCard profile={profile.data} />}
        <DataCard />
      </div>
    </div>
  );
}

function AiSettingsCard({
  settings,
  providers,
}: {
  settings: AiSettings;
  providers: AiProviderInfo[];
}) {
  const [provider, setProvider] = useState<AiProviderId | ''>(settings.provider ?? '');
  const [model, setModel] = useState(settings.model);
  const [baseUrl, setBaseUrl] = useState(settings.baseUrl);
  const [apiKey, setApiKey] = useState('');
  const update = useUpdateAiSettings();
  const test = useTestAi();

  const info = providers.find((candidate) => candidate.id === provider);
  const providerChanged = provider !== (settings.provider ?? '');
  const keySaved = settings.hasApiKey && !providerChanged;

  const save = (event: FormEvent) => {
    event.preventDefault();
    test.reset();
    update.mutate(
      {
        provider: provider || null,
        model,
        baseUrl,
        // An empty field keeps the saved key.
        ...(apiKey && { apiKey }),
      },
      { onSuccess: () => setApiKey('') },
    );
  };

  return (
    <Card>
      <CardHeader
        title="AI provider"
        description="Used for summaries, cover letters, interview prep and smarter imports. Your key is stored on your server and never sent back to the browser."
      />
      <form onSubmit={save} className="flex flex-col gap-4 p-5">
        <Field label="Provider">
          {(id) => (
            <Select
              id={id}
              value={provider}
              onChange={(event) => setProvider(event.target.value as AiProviderId | '')}
            >
              <option value="">Disabled</option>
              {providers.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </Select>
          )}
        </Field>

        {info && (
          <>
            <Field label="Model" hint={info.modelHint}>
              {(id) => (
                <Input
                  id={id}
                  value={model}
                  required={!info.defaultModel}
                  placeholder={info.defaultModel ?? ''}
                  onChange={(event) => setModel(event.target.value)}
                />
              )}
            </Field>
            {info.id !== 'ollama' && (
              <Field
                label="API key"
                hint={
                  keySaved
                    ? 'A key is saved. Leave blank to keep it.'
                    : info.requiresApiKey
                      ? undefined
                      : 'Optional for this provider.'
                }
              >
                {(id) => (
                  <Input
                    id={id}
                    type="password"
                    autoComplete="off"
                    value={apiKey}
                    required={info.requiresApiKey && !keySaved}
                    placeholder={keySaved ? '••••••••••••' : ''}
                    onChange={(event) => setApiKey(event.target.value)}
                  />
                )}
              </Field>
            )}
            <Field
              label="Base URL"
              hint={
                info.requiresBaseUrl
                  ? 'The API root, e.g. https://openrouter.ai/api/v1'
                  : 'Optional. Override when using a proxy or a different host.'
              }
            >
              {(id) => (
                <Input
                  id={id}
                  type="url"
                  value={baseUrl}
                  required={info.requiresBaseUrl}
                  placeholder={info.defaultBaseUrl ?? ''}
                  onChange={(event) => setBaseUrl(event.target.value)}
                />
              )}
            </Field>
          </>
        )}

        {update.isError && <Alert>{errorText(update.error)}</Alert>}
        {test.isError && <Alert>{errorText(test.error)}</Alert>}
        {test.isSuccess && (
          <Alert tone="success">
            Connected. The model replied: “{test.data.reply.slice(0, 80)}”
          </Alert>
        )}

        <div className="flex justify-end gap-2">
          <Button
            disabled={!settings.configured || update.isPending || providerChanged}
            loading={test.isPending}
            onClick={() => test.mutate()}
          >
            Test connection
          </Button>
          <Button type="submit" variant="primary" loading={update.isPending}>
            Save
          </Button>
        </div>
      </form>
    </Card>
  );
}

function ProfileCard({ profile }: { profile: Profile }) {
  const [values, setValues] = useState(profile);
  const update = useUpdateProfile();
  const bind = (key: keyof Profile) => ({
    value: values[key],
    onChange: (event: { target: { value: string } }) =>
      setValues((current) => ({ ...current, [key]: event.target.value })),
  });

  return (
    <Card>
      <CardHeader
        title="Your profile"
        description="Optional. The AI uses this to tailor cover letters and interview prep to you."
      />
      <form
        onSubmit={(event) => {
          event.preventDefault();
          update.mutate(values);
        }}
        className="flex flex-col gap-4 p-5"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name">{(id) => <Input id={id} {...bind('name')} />}</Field>
          <Field label="Headline">
            {(id) => <Input id={id} placeholder="Senior frontend engineer" {...bind('headline')} />}
          </Field>
        </div>
        <Field label="What you're looking for">
          {(id) => (
            <Textarea
              id={id}
              rows={3}
              placeholder="Remote-first teams, product work, around 150k…"
              {...bind('preferences')}
            />
          )}
        </Field>
        <Field label="Resume" hint="Paste your resume as plain text.">
          {(id) => (
            <Textarea id={id} rows={10} className="font-mono text-[13px]" {...bind('resume')} />
          )}
        </Field>
        {update.isError && <Alert>{errorText(update.error)}</Alert>}
        {update.isSuccess && <Alert tone="success">Profile saved.</Alert>}
        <div className="flex justify-end">
          <Button type="submit" variant="primary" loading={update.isPending}>
            Save profile
          </Button>
        </div>
      </form>
    </Card>
  );
}

function DataCard() {
  const fileInput = useRef<HTMLInputElement>(null);
  const importBackup = useImportBackup();
  const [parseError, setParseError] = useState<string>();

  const onFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setParseError(undefined);
    try {
      importBackup.mutate(JSON.parse(await file.text()));
    } catch {
      setParseError('That file is not a valid Jobify backup.');
    }
  };

  return (
    <Card>
      <CardHeader
        title="Your data"
        description="Everything lives in a single SQLite file in your data directory."
      />
      <div className="flex flex-col gap-4 p-5">
        <div className="flex flex-wrap gap-2">
          <a
            href="/api/backup/json"
            className="inline-flex items-center gap-2 rounded-lg bg-white px-3.5 py-2 text-sm font-medium shadow-sm ring-1 ring-zinc-300 ring-inset hover:bg-zinc-50 dark:bg-zinc-900 dark:ring-zinc-700 dark:hover:bg-zinc-800"
          >
            <Download className="size-4" aria-hidden />
            Export backup (JSON)
          </a>
          <a
            href="/api/backup/csv"
            className="inline-flex items-center gap-2 rounded-lg bg-white px-3.5 py-2 text-sm font-medium shadow-sm ring-1 ring-zinc-300 ring-inset hover:bg-zinc-50 dark:bg-zinc-900 dark:ring-zinc-700 dark:hover:bg-zinc-800"
          >
            <Download className="size-4" aria-hidden />
            Export spreadsheet (CSV)
          </a>
          <Button
            icon={<Upload className="size-4" />}
            loading={importBackup.isPending}
            onClick={() => fileInput.current?.click()}
          >
            Import backup
          </Button>
          <input
            ref={fileInput}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={onFile}
          />
        </div>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Importing adds the jobs from a backup file alongside your existing ones.
        </p>
        {(parseError || importBackup.isError) && (
          <Alert>{parseError ?? errorText(importBackup.error)}</Alert>
        )}
        {importBackup.isSuccess && (
          <Alert tone="success">
            Imported {importBackup.data.imported}{' '}
            {importBackup.data.imported === 1 ? 'job' : 'jobs'}.
          </Alert>
        )}
      </div>
    </Card>
  );
}
