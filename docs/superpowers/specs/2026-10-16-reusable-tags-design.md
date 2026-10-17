# Reusable, colored tags

## Why

Tags were a comma-separated text box on each job. Nothing suggested tags you already had, so
users retyped them (and drifted: "Frontend" vs "frontend"), they had no color, and they only
showed on the job detail page.

## What changes

- **Pick, don't retype.** The job form's tag box suggests the user's existing tags as they type.
  An unknown name can be created on the spot with a color. Clicking a tag in the form recolors
  it everywhere.
- **Colors.** Each tag has one of a fixed palette of colors (`TAG_COLORS`), chosen so chips stay
  readable in light and dark mode.
- **Visible everywhere.** Colored chips on the Jobs list, Board cards and job details.
- **Filter.** The Jobs list (and Board) can be filtered by tag from a Tags dropdown (`?tags=a,b`, any match), stored in
  the URL like the other filters.

## How it's stored

- `jobs.tags` stays a JSON array of tag **names**. No job data migration.
- New `tags` table (`user_id`, `name`, `color`, unique per user and name) only holds tags that
  were created or recolored explicitly.
- `GET /tags` returns the union of names used on the user's jobs and rows in `tags`, each with a
  color (saved, or a stable default derived from the name) and a job count. So older jobs' tags
  appear without a backfill, and there is no "every insert must also write a tag row" rule.
- `POST /tags` upserts `{ name, color }`. That's the only write; there is no separate tag
  management page.
- All of it is per user, like every other job query.
- Backups (still version 2) carry an optional `tags` list of colors; older backups import fine.

## Left out on purpose

- A settings page for tags, and renaming or deleting tags. Tags created in the form keep their
  saved color (and stay in suggestions) even when no job uses them. Easy to add later if needed.
- Free color picker (palette only).
- Showing or hiding table columns. "Update what I see" was read as filtering by tag.
