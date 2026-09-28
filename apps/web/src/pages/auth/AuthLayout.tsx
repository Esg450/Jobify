import { BriefcaseBusiness } from 'lucide-react';
import type { FormEvent, ReactNode } from 'react';
import { Button } from '../../components/ui/Button';
import { Alert } from '../../components/ui/feedback';

interface AuthLayoutProps {
  title: string;
  description?: ReactNode;
  error?: string;
  submitLabel: string;
  submitting: boolean;
  onSubmit: () => void;
  footer?: ReactNode;
  children: ReactNode;
}

/** The centered card shared by the sign-in, sign-up and setup screens. */
export function AuthLayout({
  title,
  description,
  error,
  submitLabel,
  submitting,
  onSubmit,
  footer,
  children,
}: AuthLayoutProps) {
  const submit = (event: FormEvent) => {
    event.preventDefault();
    onSubmit();
  };

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-4 py-10">
      <form
        onSubmit={submit}
        className="w-full max-w-sm rounded-xl bg-white p-8 shadow-sm ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-800"
      >
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <div className="rounded-xl bg-indigo-600 p-2.5 text-white">
            <BriefcaseBusiness className="size-6" aria-hidden />
          </div>
          <h1 className="text-xl font-semibold">{title}</h1>
          {description && <p className="text-sm text-zinc-500 dark:text-zinc-400">{description}</p>}
        </div>
        {error && <Alert className="mb-4">{error}</Alert>}
        <div className="flex flex-col gap-4">{children}</div>
        <Button type="submit" variant="primary" className="mt-6 w-full" loading={submitting}>
          {submitLabel}
        </Button>
      </form>
      {footer && <div className="mt-6 text-sm text-zinc-500 dark:text-zinc-400">{footer}</div>}
    </div>
  );
}
