/** The colors a tag can have. The web maps each to light and dark chip styles. */
export const TAG_COLORS = [
  'gray',
  'red',
  'orange',
  'amber',
  'green',
  'teal',
  'sky',
  'blue',
  'violet',
  'pink',
] as const;
export type TagColor = (typeof TAG_COLORS)[number];

/** A stable color for a tag nobody picked a color for, so it looks the same everywhere. */
export function defaultTagColor(name: string): TagColor {
  let hash = 0;
  for (const char of name.toLowerCase()) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  // Skip gray: defaults should look like tags, not disabled ones.
  return TAG_COLORS[1 + (hash % (TAG_COLORS.length - 1))];
}
