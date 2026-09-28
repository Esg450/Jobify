import { BriefcaseBusiness } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useLogin } from '../api/hooks';
import { Button } from '../components/ui/Button';
import { Alert, errorText } from '../components/ui/feedback';
import { Field, Input } from '../components/ui/fields';

export function LoginPage() {
  const [password, setPassword] = useState('');
  const login = useLogin();

  const submit = (event: FormEvent) => {
    event.preventDefault();
    login.mutate(password);
  };

  return (
    <div className="flex min-h-dvh items-center justify-center px-4">
      <form
        onSubmit={submit}
        className="w-full max-w-sm rounded-xl bg-white p-8 shadow-sm ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-800"
      >
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <div className="rounded-xl bg-indigo-600 p-2.5 text-white">
            <BriefcaseBusiness className="size-6" aria-hidden />
          </div>
          <h1 className="text-xl font-semibold">Sign in to Jobify</h1>
        </div>
        {login.isError && <Alert className="mb-4">{errorText(login.error)}</Alert>}
        <Field label="Password">
          {(id) => (
            <Input
              id={id}
              type="password"
              autoComplete="current-password"
              autoFocus
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          )}
        </Field>
        <Button type="submit" variant="primary" className="mt-6 w-full" loading={login.isPending}>
          Sign in
        </Button>
      </form>
    </div>
  );
}
