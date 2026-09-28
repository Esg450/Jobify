import { Field, Input } from '../../components/ui/fields';

export interface AccountValues {
  username: string;
  displayName: string;
  password: string;
  confirmPassword: string;
}

export const EMPTY_ACCOUNT: AccountValues = {
  username: '',
  displayName: '',
  password: '',
  confirmPassword: '',
};

export const MIN_PASSWORD_LENGTH = 8;

/** Returns an error message if the passwords don't match, before bothering the server. */
export function checkPasswords({ password, confirmPassword }: AccountValues): string | undefined {
  return password === confirmPassword ? undefined : "The passwords don't match";
}

/** Username, name and password inputs shared by account creation screens. */
export function AccountFields({
  values,
  onChange,
}: {
  values: AccountValues;
  onChange: (values: AccountValues) => void;
}) {
  const bind = (key: keyof AccountValues) => ({
    value: values[key],
    onChange: (event: { target: { value: string } }) =>
      onChange({ ...values, [key]: event.target.value }),
  });

  return (
    <>
      <Field label="Username" hint="Letters, numbers, dots, dashes and underscores.">
        {(id) => (
          <Input
            id={id}
            required
            autoFocus
            autoComplete="username"
            pattern={'[a-zA-Z0-9._\\-]{3,32}'}
            {...bind('username')}
          />
        )}
      </Field>
      <Field label="Your name">
        {(id) => (
          <Input id={id} autoComplete="name" placeholder="Optional" {...bind('displayName')} />
        )}
      </Field>
      <Field label="Password" hint={`At least ${MIN_PASSWORD_LENGTH} characters.`}>
        {(id) => (
          <Input
            id={id}
            type="password"
            required
            minLength={MIN_PASSWORD_LENGTH}
            autoComplete="new-password"
            {...bind('password')}
          />
        )}
      </Field>
      <Field label="Confirm password">
        {(id) => (
          <Input
            id={id}
            type="password"
            required
            autoComplete="new-password"
            {...bind('confirmPassword')}
          />
        )}
      </Field>
    </>
  );
}
