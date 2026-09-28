import { useState, type FormEvent } from 'react';
import {
  useChangePassword,
  useCurrentUser,
  useProfile,
  useUpdateAccount,
  useUpdateProfile,
} from '../../api/hooks';
import type { Profile } from '../../api/types';
import { Button } from '../../components/ui/Button';
import { Card, CardHeader } from '../../components/ui/Card';
import { Alert, errorText } from '../../components/ui/feedback';
import { Field, Input, Textarea } from '../../components/ui/fields';

export function AccountSettings() {
  const profile = useProfile();
  return (
    <div className="flex flex-col gap-6">
      <AccountCard />
      <PasswordCard />
      {profile.data && <ProfileCard profile={profile.data} />}
    </div>
  );
}

function AccountCard() {
  const user = useCurrentUser();
  const [displayName, setDisplayName] = useState(user.displayName);
  const update = useUpdateAccount();

  const save = (event: FormEvent) => {
    event.preventDefault();
    update.mutate({ displayName });
  };

  return (
    <Card>
      <CardHeader
        title="Account"
        description={`Signed in as @${user.username}${user.role === 'admin' ? ' (admin)' : ''}.`}
      />
      <form onSubmit={save} className="flex flex-col gap-4 p-5">
        <Field label="Name">
          {(id) => (
            <Input
              id={id}
              required
              maxLength={100}
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
            />
          )}
        </Field>
        {update.isError && <Alert>{errorText(update.error)}</Alert>}
        {update.isSuccess && <Alert tone="success">Saved.</Alert>}
        <div className="flex justify-end">
          <Button
            type="submit"
            variant="primary"
            loading={update.isPending}
            disabled={displayName === user.displayName}
          >
            Save
          </Button>
        </div>
      </form>
    </Card>
  );
}

function PasswordCard() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [mismatch, setMismatch] = useState(false);
  const change = useChangePassword();

  const save = (event: FormEvent) => {
    event.preventDefault();
    setMismatch(password !== confirmPassword);
    if (password !== confirmPassword) return;
    change.mutate(
      { currentPassword, password },
      {
        onSuccess: () => {
          setCurrentPassword('');
          setPassword('');
          setConfirmPassword('');
        },
      },
    );
  };

  return (
    <Card>
      <CardHeader
        title="Password"
        description="Changing your password signs you out on your other devices."
      />
      <form onSubmit={save} className="flex flex-col gap-4 p-5">
        <Field label="Current password">
          {(id) => (
            <Input
              id={id}
              type="password"
              required
              autoComplete="current-password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
            />
          )}
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="New password" hint="At least 8 characters.">
            {(id) => (
              <Input
                id={id}
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            )}
          </Field>
          <Field label="Confirm new password">
            {(id) => (
              <Input
                id={id}
                type="password"
                required
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
              />
            )}
          </Field>
        </div>
        {mismatch && <Alert>The new passwords don't match.</Alert>}
        {change.isError && <Alert>{errorText(change.error)}</Alert>}
        {change.isSuccess && <Alert tone="success">Password changed.</Alert>}
        <div className="flex justify-end">
          <Button type="submit" variant="primary" loading={change.isPending}>
            Change password
          </Button>
        </div>
      </form>
    </Card>
  );
}

function ProfileCard({ profile }: { profile: Profile }) {
  const [values, setValues] = useState(profile);
  const update = useUpdateProfile();
  const bind = (key: keyof Profile) => ({
    value: values[key],
    onChange: (event: { target: { value: string } }) =>
      setValues((current) => ({ ...current, [key]: event.target.value })),
  });

  return (
    <Card>
      <CardHeader
        title="Profile for AI"
        description="Optional. The AI uses this to tailor cover letters and interview prep to you."
      />
      <form
        onSubmit={(event) => {
          event.preventDefault();
          update.mutate(values);
        }}
        className="flex flex-col gap-4 p-5"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name">{(id) => <Input id={id} {...bind('name')} />}</Field>
          <Field label="Headline">
            {(id) => <Input id={id} placeholder="Senior frontend engineer" {...bind('headline')} />}
          </Field>
        </div>
        <Field label="What you're looking for">
          {(id) => (
            <Textarea
              id={id}
              rows={3}
              placeholder="Remote-first teams, product work, around 150k…"
              {...bind('preferences')}
            />
          )}
        </Field>
        <Field label="Resume" hint="Paste your resume as plain text.">
          {(id) => (
            <Textarea id={id} rows={10} className="font-mono text-[13px]" {...bind('resume')} />
          )}
        </Field>
        {update.isError && <Alert>{errorText(update.error)}</Alert>}
        {update.isSuccess && <Alert tone="success">Profile saved.</Alert>}
        <div className="flex justify-end">
          <Button type="submit" variant="primary" loading={update.isPending}>
            Save profile
          </Button>
        </div>
      </form>
    </Card>
  );
}
