import { useState } from 'react';
import { useLogin } from '../../api/hooks';
import { errorText } from '../../components/ui/feedback';
import { Field, Input } from '../../components/ui/fields';
import { AuthLayout } from './AuthLayout';

export function LoginPage({ onRegister }: { onRegister?: () => void }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const login = useLogin();

  return (
    <AuthLayout
      title="Sign in to Jobify"
      error={login.isError ? errorText(login.error) : undefined}
      submitLabel="Sign in"
      submitting={login.isPending}
      onSubmit={() => login.mutate({ username, password })}
      footer={
        onRegister && (
          <>
            New here?{' '}
            <button
              type="button"
              onClick={onRegister}
              className="font-medium text-indigo-600 hover:underline dark:text-indigo-400"
            >
              Create an account
            </button>
          </>
        )
      }
    >
      <Field label="Username">
        {(id) => (
          <Input
            id={id}
            required
            autoFocus
            autoComplete="username"
            autoCapitalize="none"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
          />
        )}
      </Field>
      <Field label="Password">
        {(id) => (
          <Input
            id={id}
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        )}
      </Field>
    </AuthLayout>
  );
}
