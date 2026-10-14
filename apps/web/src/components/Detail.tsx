import type { ReactNode } from 'react';

/** One label/value row in a details list (`<dl>`), as on the job page's Details card. */
export function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 px-5 py-3">
      <dt className="text-zinc-500 dark:text-zinc-400">{label}</dt>
      <dd className="text-right">{children}</dd>
    </div>
  );
}
