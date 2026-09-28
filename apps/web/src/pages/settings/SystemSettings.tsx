import { Download } from 'lucide-react';
import { useCurrentUser, useHealth } from '../../api/hooks';
import { Card, CardHeader } from '../../components/ui/Card';
import { Alert } from '../../components/ui/feedback';

export function SystemSettings() {
  const user = useCurrentUser();
  const { data: health } = useHealth();

  if (user.role !== 'admin') return <Alert>Only admins can see system information.</Alert>;

  return (
    <Card>
      <CardHeader
        title="Logs"
        description="Useful when something isn't working, or when reporting a bug."
      />
      <div className="flex flex-col gap-4 p-5 text-sm text-zinc-600 dark:text-zinc-300">
        <p>
          Jobify writes its log to{' '}
          <code className="rounded bg-zinc-100 px-1 py-0.5 text-xs dark:bg-zinc-800">
            logs/jobify.log
          </code>{' '}
          in your data folder (on Unraid,{' '}
          <code className="rounded bg-zinc-100 px-1 py-0.5 text-xs dark:bg-zinc-800">
            /mnt/user/appdata/jobify/logs
          </code>
          ). Errors from the server and from people's browsers end up there. Set the{' '}
          <code className="rounded bg-zinc-100 px-1 py-0.5 text-xs dark:bg-zinc-800">
            LOG_LEVEL
          </code>{' '}
          variable to{' '}
          <code className="rounded bg-zinc-100 px-1 py-0.5 text-xs dark:bg-zinc-800">debug</code> to
          also record every request.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <a
            href="/api/logs"
            className="inline-flex items-center gap-2 rounded-lg bg-white px-3.5 py-2 font-medium text-zinc-800 shadow-sm ring-1 ring-zinc-300 ring-inset hover:bg-zinc-50 dark:bg-zinc-900 dark:text-zinc-100 dark:ring-zinc-700 dark:hover:bg-zinc-800"
          >
            <Download className="size-4" aria-hidden />
            Download log
          </a>
          {health && <span className="text-xs text-zinc-500">Jobify {health.version}</span>}
        </div>
      </div>
    </Card>
  );
}
