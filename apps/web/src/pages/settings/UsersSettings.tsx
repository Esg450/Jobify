import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import {
  useCreateUser,
  useCurrentUser,
  useDeleteUser,
  useRegistration,
  useSetRegistration,
  useUpdateUser,
  useUsers,
} from '../../api/hooks';
import type { User, UserInput, UserRole } from '../../api/types';
import { Button } from '../../components/ui/Button';
import { Card, CardHeader } from '../../components/ui/Card';
import { Alert, errorText } from '../../components/ui/feedback';
import { Checkbox, Field, Input, Select } from '../../components/ui/fields';
import { Modal } from '../../components/ui/Modal';
import { PageSpinner } from '../../components/ui/Spinner';
import { formatDate } from '../../lib/format';

/** Who is editing what: a new user, an existing one, or nothing. */
type Editing = { mode: 'create' } | { mode: 'edit'; user: User } | null;

export function UsersSettings() {
  const currentUser = useCurrentUser();
  const { data: users, isPending, error } = useUsers();
  const [editing, setEditing] = useState<Editing>(null);
  const [deleting, setDeleting] = useState<User | null>(null);

  if (currentUser.role !== 'admin') return <Alert>Only admins can manage users.</Alert>;

  return (
    <div className="flex flex-col gap-6">
      <RegistrationCard />
      <Card>
        <CardHeader
          title="Users"
          description="Everyone has their own private jobs, timeline and profile."
          actions={
            <Button
              size="sm"
              variant="primary"
              icon={<Plus className="size-3.5" />}
              onClick={() => setEditing({ mode: 'create' })}
            >
              Add user
            </Button>
          }
        />
        {isPending ? (
          <PageSpinner />
        ) : error ? (
          <div className="p-5">
            <Alert>{errorText(error)}</Alert>
          </div>
        ) : (
          <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {users.map((user) => (
              <li key={user.id} className="flex items-center gap-3 px-5 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {user.displayName}
                    {user.id === currentUser.id && (
                      <span className="font-normal text-zinc-500"> (you)</span>
                    )}
                  </p>
                  <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">
                    @{user.username} · joined {formatDate(user.createdAt)}
                  </p>
                </div>
                {user.role === 'admin' && (
                  <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                    Admin
                  </span>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  aria-label={`Edit ${user.username}`}
                  icon={<Pencil className="size-3.5" />}
                  onClick={() => setEditing({ mode: 'edit', user })}
                />
                <Button
                  size="sm"
                  variant="ghost"
                  aria-label={`Delete ${user.username}`}
                  icon={<Trash2 className="size-3.5" />}
                  disabled={user.id === currentUser.id}
                  onClick={() => setDeleting(user)}
                />
              </li>
            ))}
          </ul>
        )}
      </Card>

      {editing && <UserModal editing={editing} onClose={() => setEditing(null)} />}
      {deleting && <DeleteUserModal user={deleting} onClose={() => setDeleting(null)} />}
    </div>
  );
}

function RegistrationCard() {
  const { data } = useRegistration();
  const setRegistration = useSetRegistration();

  return (
    <Card>
      <CardHeader title="Sign-up" />
      <div className="flex flex-col gap-2 p-5">
        <Checkbox
          label="Let people create their own accounts"
          checked={data?.open ?? false}
          disabled={!data || setRegistration.isPending}
          onChange={(event) => setRegistration.mutate(event.target.checked)}
        />
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          When this is on, anyone who can reach this Jobify can sign up from the sign-in page. Leave
          it off to add people yourself.
        </p>
        {setRegistration.isError && <Alert>{errorText(setRegistration.error)}</Alert>}
      </div>
    </Card>
  );
}

function UserModal({ editing, onClose }: { editing: NonNullable<Editing>; onClose: () => void }) {
  const existing = editing.mode === 'edit' ? editing.user : undefined;
  const [username, setUsername] = useState(existing?.username ?? '');
  const [displayName, setDisplayName] = useState(existing?.displayName ?? '');
  const [role, setRole] = useState<UserRole>(existing?.role ?? 'user');
  const [password, setPassword] = useState('');
  const createUser = useCreateUser();
  const updateUser = useUpdateUser();
  const mutation = existing ? updateUser : createUser;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (existing) {
      const changes: Partial<UserInput> = {
        username,
        displayName,
        role,
        ...(password && { password }),
      };
      updateUser.mutate({ id: existing.id, changes }, { onSuccess: onClose });
    } else {
      createUser.mutate(
        { username, displayName: displayName || undefined, role, password },
        { onSuccess: onClose },
      );
    }
  };

  return (
    <Modal open title={existing ? `Edit ${existing.displayName}` : 'Add user'} onClose={onClose}>
      <form onSubmit={submit} className="flex flex-col gap-4">
        {mutation.isError && <Alert>{errorText(mutation.error)}</Alert>}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Username">
            {(id) => (
              <Input
                id={id}
                required
                autoCapitalize="none"
                pattern={'[a-zA-Z0-9._\\-]{3,32}'}
                value={username}
                onChange={(event) => setUsername(event.target.value)}
              />
            )}
          </Field>
          <Field label="Name">
            {(id) => (
              <Input
                id={id}
                placeholder="Optional"
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
              />
            )}
          </Field>
        </div>
        <Field
          label={existing ? 'New password' : 'Password'}
          hint={
            existing
              ? 'Leave blank to keep their current password. Setting one signs them out everywhere.'
              : 'At least 8 characters. Share it with them and ask them to change it.'
          }
        >
          {(id) => (
            <Input
              id={id}
              type="text"
              autoComplete="off"
              required={!existing}
              minLength={8}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          )}
        </Field>
        <Field label="Role" hint="Admins can manage users and the AI provider.">
          {(id) => (
            <Select
              id={id}
              value={role}
              onChange={(event) => setRole(event.target.value as UserRole)}
            >
              <option value="user">User</option>
              <option value="admin">Admin</option>
            </Select>
          )}
        </Field>
        <div className="flex justify-end gap-2">
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" loading={mutation.isPending}>
            {existing ? 'Save' : 'Add user'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function DeleteUserModal({ user, onClose }: { user: User; onClose: () => void }) {
  const deleteUser = useDeleteUser();
  return (
    <Modal
      open
      title={`Delete ${user.displayName}?`}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="danger"
            loading={deleteUser.isPending}
            onClick={() => deleteUser.mutate(user.id, { onSuccess: onClose })}
          >
            Delete user
          </Button>
        </>
      }
    >
      <p className="text-sm text-zinc-600 dark:text-zinc-300">
        @{user.username} and all of their jobs will be deleted permanently.
      </p>
      {deleteUser.isError && <Alert className="mt-3">{errorText(deleteUser.error)}</Alert>}
    </Modal>
  );
}
