import { Check, Plus, X } from 'lucide-react';
import { useState, type KeyboardEvent } from 'react';
import { useSaveTag, useTagColors, useTags } from '../api/hooks';
import { TAG_COLORS, type TagColor } from '../api/types';
import { cn } from '../lib/cn';
import { TAG_COLOR_LABELS, TAG_STYLES } from '../lib/tagColors';
import { reportError } from '../lib/reportError';

interface TagChipProps {
  name: string;
  color?: TagColor;
  onRemove?: () => void;
  /** Makes the name a button, e.g. to recolor the tag. */
  onSelect?: () => void;
  className?: string;
}

export function TagChip({ name, color = 'gray', onRemove, onSelect, className }: TagChipProps) {
  return (
    <span
      className={cn(
        'inline-flex max-w-full items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset',
        TAG_STYLES[color].chip,
        className,
      )}
    >
      <span
        aria-hidden
        className={cn('size-1.5 shrink-0 rounded-full', TAG_STYLES[color].swatch)}
      />
      {onSelect ? (
        <button
          type="button"
          onClick={onSelect}
          title="Change color"
          className="truncate hover:underline"
        >
          {name}
        </button>
      ) : (
        <span className="truncate">{name}</span>
      )}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${name}`}
          className="-mr-0.5 rounded opacity-60 hover:opacity-100"
        >
          <X className="size-3" aria-hidden />
        </button>
      )}
    </span>
  );
}

/** A job's tags as colored chips. */
export function TagList({ tags, className }: { tags: string[]; className?: string }) {
  const colors = useTagColors();
  if (tags.length === 0) return null;
  return (
    <div className={cn('flex flex-wrap gap-1', className)}>
      {tags.map((tag) => (
        <TagChip key={tag} name={tag} color={colors.get(tag)} />
      ))}
    </div>
  );
}

interface ColorSwatchesProps {
  value: TagColor;
  onChange: (color: TagColor) => void;
  label?: string;
}

export function ColorSwatches({ value, onChange, label = 'Tag color' }: ColorSwatchesProps) {
  return (
    <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={label}>
      {TAG_COLORS.map((color) => (
        <button
          key={color}
          type="button"
          role="radio"
          aria-checked={value === color}
          aria-label={TAG_COLOR_LABELS[color]}
          title={TAG_COLOR_LABELS[color]}
          onClick={() => onChange(color)}
          className={cn(
            'grid size-6 place-items-center rounded-full text-white ring-offset-2 ring-offset-white dark:ring-offset-zinc-900',
            TAG_STYLES[color].swatch,
            value === color && 'ring-2 ring-zinc-900 dark:ring-zinc-100',
          )}
        >
          {value === color && <Check className="size-3.5" aria-hidden />}
        </button>
      ))}
    </div>
  );
}

const cleanName = (text: string) => text.replace(/\s+/g, ' ').trim().slice(0, 50);

interface TagPickerProps {
  id?: string;
  value: string[];
  onChange: (tags: string[]) => void;
}

/**
 * Picks tags for a job: suggests the user's existing tags as they type, and creates a new one
 * (with a color) when nothing matches.
 */
export function TagPicker({ id, value, onChange }: TagPickerProps) {
  const { data: tags = [] } = useTags();
  const saveTag = useSaveTag();
  const colors = useTagColors();
  const [text, setText] = useState('');
  const [open, setOpen] = useState(false);
  const [newColor, setNewColor] = useState<TagColor>('blue');
  const [recoloring, setRecoloring] = useState<string | null>(null);

  const query = cleanName(text);
  const suggestions = tags
    .filter((tag) => !value.includes(tag.name))
    .filter((tag) => tag.name.toLowerCase().includes(query.toLowerCase()))
    .slice(0, 8);
  const exact = tags.find((tag) => tag.name.toLowerCase() === query.toLowerCase());

  const add = (name: string) => {
    if (!value.includes(name)) onChange([...value, name]);
    setText('');
  };

  const save = (name: string, color: TagColor) =>
    saveTag.mutate({ name, color }, { onError: (error) => reportError(error) });

  const create = (color: TagColor) => {
    if (!query) return;
    save(query, color);
    add(query);
  };

  // A pasted list ("a, b, c") becomes one tag per item; existing tags keep their color.
  const addPasted = (pasted: string) => {
    const names = pasted.split(',').map(cleanName).filter(Boolean);
    const added: string[] = [];
    for (const name of names) {
      const known = tags.find((tag) => tag.name.toLowerCase() === name.toLowerCase());
      if (!known) save(name, newColor);
      added.push(known?.name ?? name);
    }
    onChange([...new Set([...value, ...added])]);
    setText('');
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      if (!query) return;
      // Prefer an existing tag: the exact match, else the top suggestion. Create needs a click
      // when something similar exists, so a typo doesn't quietly add a near-duplicate.
      const existing = exact ?? suggestions[0];
      if (existing) add(existing.name);
      else create(newColor);
    } else if (event.key === 'Backspace' && !text && value.length > 0) {
      onChange(value.slice(0, -1));
    } else if (event.key === 'Escape') {
      setOpen(false);
    }
  };

  return (
    <div className="relative">
      <div className="flex min-h-9 flex-wrap items-center gap-1 rounded-lg bg-white px-2 py-1.5 shadow-sm ring-1 ring-zinc-300 ring-inset focus-within:ring-2 focus-within:ring-indigo-500 dark:bg-zinc-900 dark:ring-zinc-700">
        {value.map((tag) => (
          <TagChip
            key={tag}
            name={tag}
            color={colors.get(tag)}
            onSelect={() => setRecoloring(recoloring === tag ? null : tag)}
            onRemove={() => onChange(value.filter((item) => item !== tag))}
          />
        ))}
        <input
          id={id}
          value={text}
          onChange={(event) => {
            setText(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          // Delay so a click on a suggestion lands before the list closes.
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={onKeyDown}
          onPaste={(event) => {
            const pasted = event.clipboardData.getData('text');
            if (!pasted.includes(',')) return;
            event.preventDefault();
            addPasted(pasted);
          }}
          placeholder={value.length === 0 ? 'Add tags, e.g. dream company' : ''}
          role="combobox"
          aria-expanded={open}
          aria-autocomplete="list"
          className="min-w-16 flex-1 border-0 bg-transparent p-0.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:ring-0 focus:outline-none dark:text-zinc-100 dark:placeholder:text-zinc-500"
        />
      </div>

      {recoloring && value.includes(recoloring) && (
        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-zinc-600 dark:text-zinc-300">
          <span>
            Color for <TagChip name={recoloring} color={colors.get(recoloring)} />
          </span>
          <ColorSwatches
            value={colors.get(recoloring) ?? 'gray'}
            onChange={(color) => {
              save(recoloring, color);
              setRecoloring(null);
            }}
          />
        </div>
      )}

      {open && (suggestions.length > 0 || (query && !exact)) && (
        <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-lg bg-white shadow-lg ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-800">
          {suggestions.length > 0 && (
            <ul role="listbox" className="max-h-56 overflow-y-auto py-1">
              {suggestions.map((tag) => (
                <li key={tag.name}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={false}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => add(tag.name)}
                    className="flex w-full items-center justify-between gap-3 px-3 py-1.5 text-left hover:bg-zinc-50 dark:hover:bg-zinc-800"
                  >
                    <TagChip name={tag.name} color={tag.color} />
                    <span className="text-xs text-zinc-400">
                      {tag.count} {tag.count === 1 ? 'job' : 'jobs'}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {query && !exact && (
            <div
              className="flex flex-col gap-2 border-t border-zinc-100 px-3 py-2.5 first:border-t-0 dark:border-zinc-800"
              onMouseDown={(event) => event.preventDefault()}
            >
              <ColorSwatches value={newColor} onChange={setNewColor} label="New tag color" />
              <button
                type="button"
                onClick={() => create(newColor)}
                className="inline-flex items-center gap-1.5 self-start text-sm text-zinc-700 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-100"
              >
                <Plus className="size-4" aria-hidden />
                Create <TagChip name={query} color={newColor} />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface TagChecklistProps {
  value: string[];
  onChange: (tags: string[]) => void;
}

/** Tag search for the job list's Filters panel: chosen tags sit in the search box as chips. */
export function TagChecklist({ value, onChange }: TagChecklistProps) {
  const { data: tags = [], isPending } = useTags();
  const colors = useTagColors();
  const [search, setSearch] = useState('');

  const shown = tags.filter(
    (tag) =>
      !value.includes(tag.name) && tag.name.toLowerCase().includes(search.trim().toLowerCase()),
  );
  const add = (name: string) => {
    onChange([...value, name]);
    setSearch('');
  };
  const remove = (name: string) => onChange(value.filter((item) => item !== name));

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' && shown[0]) {
      event.preventDefault();
      add(shown[0].name);
    } else if (event.key === 'Backspace' && !search && value.length > 0) {
      remove(value[value.length - 1]);
    }
  };

  return (
    <div className="overflow-hidden rounded-lg ring-1 ring-zinc-200 dark:ring-zinc-700">
      <div className="flex flex-wrap items-center gap-1.5 border-b border-zinc-100 bg-zinc-50 p-2 dark:border-zinc-800 dark:bg-zinc-800/50">
        {value.map((name) => (
          <TagChip key={name} name={name} color={colors.get(name)} onRemove={() => remove(name)} />
        ))}
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          onKeyDown={onKeyDown}
          placeholder={value.length === 0 ? 'Search tags' : ''}
          aria-label="Search tags"
          className="min-w-16 flex-1 border-0 bg-transparent p-0.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:ring-0 focus:outline-none dark:text-zinc-100"
        />
      </div>
      <ul className="max-h-48 overflow-y-auto py-1" aria-label="Tags">
        {shown.map((tag) => (
          <li key={tag.name}>
            <button
              type="button"
              onClick={() => add(tag.name)}
              className="flex w-full items-center justify-between gap-2 px-3 py-1.5 hover:bg-zinc-50 dark:hover:bg-zinc-800"
            >
              <TagChip name={tag.name} color={tag.color} />
              <span className="text-xs text-zinc-400">{tag.count}</span>
            </button>
          </li>
        ))}
        {shown.length === 0 && (
          <li className="px-3 py-2 text-sm text-zinc-500 dark:text-zinc-400">
            {isPending
              ? 'Loading tags…'
              : tags.length === 0
                ? 'No tags yet.'
                : search
                  ? 'No tags match.'
                  : 'All tags chosen.'}
          </li>
        )}
      </ul>
    </div>
  );
}
