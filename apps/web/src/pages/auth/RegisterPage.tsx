import { useState } from 'react';
import { useRegister } from '../../api/hooks';
import { errorText } from '../../components/ui/feedback';
import { AccountFields, checkPasswords, EMPTY_ACCOUNT } from './AccountFields';
import { AuthLayout } from './AuthLayout';

export function RegisterPage({ onSignIn }: { onSignIn: () => void }) {
  const [account, setAccount] = useState(EMPTY_ACCOUNT);
  const [mismatch, setMismatch] = useState<string>();
  const register = useRegister();

  const submit = () => {
    const problem = checkPasswords(account);
    setMismatch(problem);
    if (problem) return;
    register.mutate({
      username: account.username,
      displayName: account.displayName || undefined,
      password: account.password,
    });
  };

  return (
    <AuthLayout
      title="Create your account"
      error={mismatch ?? (register.isError ? errorText(register.error) : undefined)}
      submitLabel="Create account"
      submitting={register.isPending}
      onSubmit={submit}
      footer={
        <>
          Already have an account?{' '}
          <button
            type="button"
            onClick={onSignIn}
            className="font-medium text-indigo-600 hover:underline dark:text-indigo-400"
          >
            Sign in
          </button>
        </>
      }
    >
      <AccountFields values={account} onChange={setAccount} />
    </AuthLayout>
  );
}
