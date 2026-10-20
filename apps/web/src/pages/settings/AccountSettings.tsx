import { Sparkles, Undo2, Upload } from 'lucide-react';
import { useRef, useState, type DragEvent, type FormEvent, type ReactNode } from 'react';
import {
  useAiSettings,
  useChangePassword,
  useCurrentUser,
  useProfile,
  useTidyResume,
  useUpdateAccount,
  useUpdateProfile,
  useUploadResume,
} from '../../api/hooks';
import { RESUME_FILE_ACCEPT, RESUME_FILE_MAX_BYTES, type Profile } from '../../api/types';
import { Button } from '../../components/ui/Button';
import { Card, CardHeader } from '../../components/ui/Card';
import { Alert, errorText } from '../../components/ui/feedback';
import { Field, Input, Textarea } from '../../components/ui/fields';
import { cn } from '../../lib/cn';

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
  // Bumped on save so the resume field forgets its "review, then save" notice and undo.
  const [saves, setSaves] = useState(0);
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
          update.mutate(values, { onSuccess: () => setSaves((count) => count + 1) });
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
        <ResumeField
          key={saves}
          value={values.resume}
          onChange={(resume) => setValues((current) => ({ ...current, resume }))}
        />
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

const FORMAT_NAMES = { pdf: 'PDF', docx: 'Word document', text: 'text file' } as const;

/**
 * The resume textarea with two ways to fill it besides typing: uploading a file, whose text the
 * server reads out, and (when AI is set up) a tidy-up pass that repairs the layout without
 * changing the words. Both only change the field; nothing is saved until the form is.
 */
function ResumeField({ value, onChange }: { value: string; onChange: (text: string) => void }) {
  const { data: ai } = useAiSettings();
  const upload = useUploadResume();
  const tidy = useTidyResume();
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [notice, setNotice] = useState<{ tone: 'info' | 'warning'; text: ReactNode } | null>(null);
  const [undo, setUndo] = useState<{ label: string; text: string } | null>(null);
  const [tooLarge, setTooLarge] = useState<string | null>(null);
  const busy = upload.isPending || tidy.isPending;

  /** Replaces the text, remembering what it was so the user can change their mind. */
  const replace = (text: string, undoLabel: string) => {
    setUndo({ label: undoLabel, text: value });
    onChange(text);
  };

  const pick = (file: File | undefined) => {
    if (!file) return;
    upload.reset();
    tidy.reset();
    setNotice(null);
    if (file.size > RESUME_FILE_MAX_BYTES) {
      setTooLarge(`${file.name} is larger than ${RESUME_FILE_MAX_BYTES / 1024 / 1024} MB.`);
      return;
    }
    setTooLarge(null);
    upload.mutate(file, {
      onSuccess: ({ text, format, truncated }) => {
        replace(text, 'Undo upload');
        setNotice(
          truncated
            ? {
                tone: 'warning',
                text: `Read the ${FORMAT_NAMES[format]}, but it was longer than the profile can hold, so the end was left out. Review the text, then save.`,
              }
            : {
                tone: 'info',
                text: `Read ${file.name}. Check that the text came through as expected, then save.`,
              },
        );
      },
    });
  };

  const runTidy = () => {
    upload.reset();
    setNotice(null);
    setTooLarge(null);
    tidy.mutate(value, {
      onSuccess: ({ text }) => {
        replace(text, 'Undo tidy-up');
        setNotice({
          tone: 'info',
          text: 'Tidied up the layout. The wording is unchanged; look it over, then save.',
        });
      },
    });
  };

  const drop = (event: DragEvent) => {
    event.preventDefault();
    setDragging(false);
    pick(event.dataTransfer.files[0]);
  };

  return (
    <Field
      label="Resume"
      hint="Paste your resume as plain text, or upload it as a PDF, Word document (.docx) or text file. Only the text is kept."
    >
      {(id) => (
        <div className="flex flex-col gap-2">
          <div
            onDragOver={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={drop}
            className={cn('rounded-lg', dragging && 'ring-2 ring-indigo-500 ring-offset-2')}
          >
            <Textarea
              id={id}
              rows={10}
              className="font-mono text-[13px]"
              placeholder="Paste your resume here, or drop a file."
              value={value}
              onChange={(event) => {
                setUndo(null);
                onChange(event.target.value);
              }}
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={input}
              type="file"
              accept={RESUME_FILE_ACCEPT}
              className="sr-only"
              tabIndex={-1}
              onChange={(event) => {
                pick(event.target.files?.[0]);
                // Let the same file be chosen again after an undo.
                event.target.value = '';
              }}
            />
            <Button
              size="sm"
              icon={<Upload aria-hidden className="size-3.5" />}
              loading={upload.isPending}
              disabled={busy}
              onClick={() => input.current?.click()}
            >
              Upload file
            </Button>
            {ai?.configured && (
              <Button
                size="sm"
                icon={<Sparkles aria-hidden className="size-3.5" />}
                loading={tidy.isPending}
                disabled={busy || !value.trim()}
                onClick={runTidy}
                title="Fix the layout and spacing without changing any of the words"
              >
                Tidy up with AI
              </Button>
            )}
            {undo && (
              <Button
                size="sm"
                variant="ghost"
                icon={<Undo2 aria-hidden className="size-3.5" />}
                disabled={busy}
                onClick={() => {
                  onChange(undo.text);
                  setUndo(null);
                  setNotice(null);
                }}
              >
                {undo.label}
              </Button>
            )}
          </div>
          {tooLarge && <Alert>{tooLarge}</Alert>}
          {upload.isError && <Alert>{errorText(upload.error)}</Alert>}
          {tidy.isError && <Alert>{errorText(tidy.error)}</Alert>}
          {notice && <Alert tone={notice.tone}>{notice.text}</Alert>}
        </div>
      )}
    </Field>
  );
}
