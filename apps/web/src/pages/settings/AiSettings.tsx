import { useState, type FormEvent } from 'react';
import {
  useAiProviders,
  useAiSettings,
  useCurrentUser,
  useTestAi,
  useUpdateAiSettings,
} from '../../api/hooks';
import type { AiProviderId, AiProviderInfo, AiSettings as AiSettingsValues } from '../../api/types';
import { Button } from '../../components/ui/Button';
import { Card, CardHeader } from '../../components/ui/Card';
import { Alert, errorText } from '../../components/ui/feedback';
import { Field, Input, Select } from '../../components/ui/fields';
import { PageSpinner } from '../../components/ui/Spinner';

export function AiSettings() {
  const user = useCurrentUser();
  const settings = useAiSettings();
  const providers = useAiProviders();

  if (!settings.data || !providers.data) return <PageSpinner />;
  if (user.role !== 'admin') {
    const provider = providers.data.find((option) => option.id === settings.data.provider);
    return (
      <Card>
        <CardHeader title="AI provider" />
        <p className="p-5 text-sm text-zinc-600 dark:text-zinc-300">
          {provider
            ? `AI features use ${provider.label}${settings.data.model ? ` (${settings.data.model})` : ''}, set up by an admin.`
            : 'AI features are turned off. Ask an admin to set up an AI provider.'}
        </p>
      </Card>
    );
  }
  return <AiSettingsCard settings={settings.data} providers={providers.data} />;
}

function AiSettingsCard({
  settings,
  providers,
}: {
  settings: AiSettingsValues;
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
        description="Shared by everyone on this Jobify. Used for summaries, cover letters, interview prep and smarter imports. The key is stored on your server and never sent back to the browser."
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
