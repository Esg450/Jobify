import { ClipboardPaste, Link2, Sparkles } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useAiSettings, useImportJob, useImportSites } from '../api/hooks';
import type { ImportRequest, ImportResult } from '../api/types';
import { cn } from '../lib/cn';
import { Button } from './ui/Button';
import { Card } from './ui/Card';
import { Alert, errorText } from './ui/feedback';
import { Checkbox, Input, Textarea } from './ui/fields';

type Mode = 'url' | 'paste';

export function ImportPanel({ onImported }: { onImported: (result: ImportResult) => void }) {
  const [mode, setMode] = useState<Mode>('url');
  const [url, setUrl] = useState('');
  const [pasted, setPasted] = useState('');
  const [useAi, setUseAi] = useState(false);
  const importJob = useImportJob();
  const { data: sites } = useImportSites();
  const { data: ai } = useAiSettings();

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const looksLikeHtml = /<\/?[a-z][\s\S]*>/i.test(pasted);
    const request: ImportRequest =
      mode === 'url'
        ? { url, useAi }
        : {
            url: url || undefined,
            useAi,
            ...(looksLikeHtml ? { html: pasted } : { text: pasted }),
          };
    importJob.mutate(request, { onSuccess: onImported });
  };

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">Import a posting</h2>
          <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">
            Fill in the form from a job link. Works with{' '}
            {sites?.map((site) => site.name).join(', ') ?? 'popular job sites'}, and most career
            pages.
          </p>
        </div>
        <div className="flex rounded-lg bg-zinc-100 p-0.5 text-sm dark:bg-zinc-800" role="tablist">
          {(
            [
              ['url', 'Link', Link2],
              ['paste', 'Paste', ClipboardPaste],
            ] as const
          ).map(([value, label, Icon]) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={mode === value}
              onClick={() => setMode(value)}
              className={cn(
                'flex items-center gap-1.5 rounded-md px-3 py-1.5 font-medium',
                mode === value
                  ? 'bg-white shadow-sm dark:bg-zinc-700'
                  : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300',
              )}
            >
              <Icon className="size-3.5" aria-hidden />
              {label}
            </button>
          ))}
        </div>
      </div>

      <form onSubmit={submit} className="mt-4 flex flex-col gap-3">
        {mode === 'url' ? (
          <Input
            type="url"
            required
            placeholder="https://www.linkedin.com/jobs/view/…"
            aria-label="Job posting URL"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
          />
        ) : (
          <>
            <Textarea
              required
              rows={6}
              placeholder="Paste the page source (View Source → Select all) or the posting text. Useful for sites that need you to sign in."
              aria-label="Page source or text"
              value={pasted}
              onChange={(event) => setPasted(event.target.value)}
            />
            <Input
              type="url"
              placeholder="Posting URL (optional)"
              aria-label="Posting URL"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
            />
          </>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3">
          {ai?.configured ? (
            <Checkbox
              label="Use AI to fill in missing details"
              checked={useAi}
              onChange={(event) => setUseAi(event.target.checked)}
            />
          ) : (
            <p className="flex items-center gap-1.5 text-xs text-zinc-500">
              <Sparkles className="size-3.5" aria-hidden />
              Set up an AI provider in Settings to extract details from any page.
            </p>
          )}
          <Button type="submit" variant="primary" loading={importJob.isPending}>
            Import
          </Button>
        </div>
      </form>

      {importJob.isError && <Alert className="mt-3">{errorText(importJob.error)}</Alert>}
      {importJob.data && (
        <Alert tone="success" className="mt-3">
          Imported. Review the details below before saving.
          {importJob.data.warnings.length > 0 && (
            <span className="mt-1 block text-xs opacity-80">
              {importJob.data.warnings.join(' · ')}
            </span>
          )}
        </Alert>
      )}
    </Card>
  );
}
