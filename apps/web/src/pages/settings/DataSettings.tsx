import { Download, Upload } from 'lucide-react';
import { useRef, useState, type ChangeEvent } from 'react';
import { useImportBackup } from '../../api/hooks';
import { Button } from '../../components/ui/Button';
import { Card, CardHeader } from '../../components/ui/Card';
import { Alert, errorText } from '../../components/ui/feedback';

export function DataSettings() {
  return <DataCard />;
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
        description="Your jobs and their timelines. Other users’ data is not included."
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
          Importing adds the jobs from a backup file to your account, alongside your existing ones.
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
