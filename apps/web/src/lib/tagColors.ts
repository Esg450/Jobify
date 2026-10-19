import type { TagColor } from '../api/types';

/** Tag styles per color, same recipe as STATUS_STYLES. Full class names so Tailwind keeps them. */
export const TAG_STYLES: Record<TagColor, { chip: string; swatch: string }> = {
  gray: {
    chip: 'bg-zinc-100 text-zinc-700 ring-zinc-500/20 dark:bg-zinc-800 dark:text-zinc-300',
    swatch: 'bg-zinc-400',
  },
  red: {
    chip: 'bg-red-50 text-red-700 ring-red-600/20 dark:bg-red-950 dark:text-red-300',
    swatch: 'bg-red-500',
  },
  orange: {
    chip: 'bg-orange-50 text-orange-700 ring-orange-600/20 dark:bg-orange-950 dark:text-orange-300',
    swatch: 'bg-orange-500',
  },
  amber: {
    chip: 'bg-amber-50 text-amber-700 ring-amber-600/20 dark:bg-amber-950 dark:text-amber-300',
    swatch: 'bg-amber-400',
  },
  green: {
    chip: 'bg-green-50 text-green-700 ring-green-600/20 dark:bg-green-950 dark:text-green-300',
    swatch: 'bg-green-500',
  },
  teal: {
    chip: 'bg-teal-50 text-teal-700 ring-teal-600/20 dark:bg-teal-950 dark:text-teal-300',
    swatch: 'bg-teal-500',
  },
  sky: {
    chip: 'bg-sky-50 text-sky-700 ring-sky-600/20 dark:bg-sky-950 dark:text-sky-300',
    swatch: 'bg-sky-500',
  },
  blue: {
    chip: 'bg-blue-50 text-blue-700 ring-blue-600/20 dark:bg-blue-950 dark:text-blue-300',
    swatch: 'bg-blue-600',
  },
  violet: {
    chip: 'bg-violet-50 text-violet-700 ring-violet-600/20 dark:bg-violet-950 dark:text-violet-300',
    swatch: 'bg-violet-500',
  },
  pink: {
    chip: 'bg-pink-50 text-pink-700 ring-pink-600/20 dark:bg-pink-950 dark:text-pink-300',
    swatch: 'bg-pink-500',
  },
};

export const TAG_COLOR_LABELS: Record<TagColor, string> = {
  gray: 'Gray',
  red: 'Red',
  orange: 'Orange',
  amber: 'Amber',
  green: 'Green',
  teal: 'Teal',
  sky: 'Sky',
  blue: 'Blue',
  violet: 'Violet',
  pink: 'Pink',
};
