import { useState, type FormEvent } from 'react';
import {
  useCurrentUser,
  useSearchSettings,
  useTestSearch,
  useUpdateSearchSettings,
} from '../../api/hooks';
import { SEARCH_SITES, type SearchSettings as SearchSettingsValues } from '../../api/types';
import { Button } from '../../components/ui/Button';
import { Card, CardHeader } from '../../components/ui/Card';
import { Alert, errorText } from '../../components/ui/feedback';
import { Checkbox, Field, Input } from '../../components/ui/fields';
import { PageSpinner } from '../../components/ui/Spinner';

const SIDECAR_DOCS = 'https://github.com/esg450/jobify#job-search';

export function SearchSettings() {
  const user = useCurrentUser();
  const settings = useSearchSettings();

  if (!settings.data) return <PageSpinner />;
  if (user.role !== 'admin') {
    return (
      <Card>
        <CardHeader title="Job search" />
        <p className="p-5 text-sm text-zinc-600 dark:text-zinc-300">
          {settings.data.configured
            ? 'Job board search is on. Use the Find jobs page to search Indeed, LinkedIn and other boards.'
            : 'Job board search is turned off. Ask an admin to connect a JobSpy service.'}
        </p>
      </Card>
    );
  }
  return <SearchSettingsCard settings={settings.data} />;
}

function SearchSettingsCard({ settings }: { settings: SearchSettingsValues }) {
  const [enabled, setEnabled] = useState(settings.enabled);
  const [baseUrl, setBaseUrl] = useState(settings.baseUrl);
  const [apiKey, setApiKey] = useState('');
  const update = useUpdateSearchSettings();
  const test = useTestSearch();

  const dirty = enabled !== settings.enabled || baseUrl !== settings.baseUrl || apiKey !== '';

  const save = (event: FormEvent) => {
    event.preventDefault();
    test.reset();
    update.mutate(
      // An empty key field keeps the saved key.
      { enabled, baseUrl, ...(apiKey && { apiKey }) },
      { onSuccess: () => setApiKey('') },
    );
  };

  return (
    <Card>
      <CardHeader
        title="Job search"
        description={
          <>
            Search Indeed, LinkedIn, Glassdoor and other boards from inside Jobify through a{' '}
            <a
              href={SIDECAR_DOCS}
              target="_blank"
              rel="noreferrer noopener"
              className="text-indigo-600 hover:underline dark:text-indigo-400"
            >
              JobSpy service
            </a>{' '}
            running on your server. Shared by everyone on this Jobify; the API key is stored on your
            server and never sent back to the browser.
          </>
        }
      />
      <form onSubmit={save} className="flex flex-col gap-4 p-5">
        <Checkbox
          label="Enable job board search"
          checked={enabled}
          onChange={(event) => setEnabled(event.target.checked)}
        />

        <Field
          label="JobSpy service URL"
          hint="Where the jobify-jobspy container is reachable from the Jobify server, e.g. http://192.168.1.10:8000"
        >
          {(id) => (
            <Input
              id={id}
              type="url"
              value={baseUrl}
              required={enabled}
              placeholder="http://jobspy:8000"
              onChange={(event) => setBaseUrl(event.target.value)}
            />
          )}
        </Field>

        <Field
          label="API key"
          hint={
            settings.hasApiKey
              ? 'A key is saved. Leave blank to keep it.'
              : 'The value of API_KEYS on the JobSpy container. Leave blank if it runs without one.'
          }
        >
          {(id) => (
            <Input
              id={id}
              type="password"
              autoComplete="off"
              value={apiKey}
              placeholder={settings.hasApiKey ? '••••••••••••' : ''}
              onChange={(event) => setApiKey(event.target.value)}
            />
          )}
        </Field>

        {update.isError && <Alert>{errorText(update.error)}</Alert>}
        {test.isError && <Alert>{errorText(test.error)}</Alert>}
        {test.isSuccess && (
          <Alert tone="success">
            Connected{test.data.version ? ` to JobSpy ${test.data.version}` : ''}.
            {test.data.sites.length > 0 && (
              <span className="mt-1 block text-xs opacity-80">
                Boards: {test.data.sites.map((site) => siteName(site)).join(', ')}
              </span>
            )}
          </Alert>
        )}

        <div className="flex justify-end gap-2">
          <Button
            disabled={!settings.configured || update.isPending || dirty}
            loading={test.isPending}
            title={dirty ? 'Save your changes first' : undefined}
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

function siteName(site: string): string {
  return (SEARCH_SITES as Record<string, string>)[site] ?? site;
}
