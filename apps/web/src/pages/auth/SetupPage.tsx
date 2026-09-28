import { useState } from 'react';
import { useSetup } from '../../api/hooks';
import { errorText } from '../../components/ui/feedback';
import { Field, Input } from '../../components/ui/fields';
import { AccountFields, checkPasswords, EMPTY_ACCOUNT } from './AccountFields';
import { AuthLayout } from './AuthLayout';

/** First run: whoever opens Jobify first creates the admin account. */
export function SetupPage({ setupPasswordRequired }: { setupPasswordRequired: boolean }) {
  const [account, setAccount] = useState(EMPTY_ACCOUNT);
  const [setupPassword, setSetupPassword] = useState('');
  const [mismatch, setMismatch] = useState<string>();
  const setup = useSetup();

  const submit = () => {
    const problem = checkPasswords(account);
    setMismatch(problem);
    if (problem) return;
    setup.mutate({
      username: account.username,
      displayName: account.displayName || undefined,
      password: account.password,
      setupPassword: setupPasswordRequired ? setupPassword : undefined,
    });
  };

  return (
    <AuthLayout
      title="Welcome to Jobify"
      description={
        setupPasswordRequired
          ? 'Jobify now has user accounts. Create your admin account; your existing jobs will move into it.'
          : 'Create the admin account. You can invite other people afterwards.'
      }
      error={mismatch ?? (setup.isError ? errorText(setup.error) : undefined)}
      submitLabel="Create account"
      submitting={setup.isPending}
      onSubmit={submit}
    >
      {setupPasswordRequired && (
        <Field
          label="Current Jobify password"
          hint="The JOBIFY_PASSWORD this instance was set up with."
        >
          {(id) => (
            <Input
              id={id}
              type="password"
              required
              value={setupPassword}
              onChange={(event) => setSetupPassword(event.target.value)}
            />
          )}
        </Field>
      )}
      <AccountFields values={account} onChange={setAccount} />
    </AuthLayout>
  );
}
